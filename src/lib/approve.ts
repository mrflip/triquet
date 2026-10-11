/* eslint-disable unicorn/prefer-combined-guards -- one guard per rule, each beside its rule, as notes/policy_approve.md asks */
import type { HuntActionT, LibraryActionT, OuterHuntActionT, QuizRevisionKind, UserActionT } from '../models/actions'
import { Quiz, type QuizRowT } from '../models/quiz'
import { Review, type ReviewPolicyT } from '../models/review'
import type { UserFaceT } from '../models/user'
import { Validator } from './validator'
import * as Actor from './actor'
import { AuthorizationError, type Story } from './errors'
import { RefusalNotices, type Refusalkind } from './notices'

// Every policy decision, and nothing else: each `may…` function decides from the evidence it is
// handed, reads nothing, and runs in the browser and on the server alike. Gathering that evidence
// is `convex/authorize`'s; acting on a verdict is the caller's. A decision reads as its doc
// block's list of rules: one guard per line, in that order, each with its rule beside it.

/** The verdict that lets a request go ahead */
export const Allow = 'allow'

/** Why a policy said no: each a refusal kind, so its sentence is the refusal's (`RefusalNotices`) */
export const DenialkindVals = [
  'notIdentified', 'notPermitted', 'ownHuntship', 'quizLocked', 'botsOff', 'userlabelSet',
  'sealedHunts', 'sealedRelabel', 'sealedMembers', 'sealedJoin', 'sealedReview',
] as const satisfies readonly Refusalkind[]
export type Denialkind = typeof DenialkindVals[number]

/** What a policy decides: `'allow'`, or why not */
export type VerdictT = typeof Allow | Denialkind

/** The one value of the environment switch that lets this server ask Claude: anything else, or nothing, leaves it off */
const SwitchedOn = 'allow'

/** The one value of `EXPOSE_INTERNAL_STATS_TO_ALL` that shows the stats page's backfills to everyone: `false`, anything else, or nothing keeps them an admin's */
const ExposedToAll = 'true'

const ApproveValidators = Validator(({ arr, bool }) => {
  const verdicts = arr(bool).nonempty().describe('List of permission check results')
  return { verdicts }
})

/**
 * A policy said no to what `must` was asked. Its message is the denial's sentence for the author
 * (`RefusalNotices`), safe to send back to the browser; which policy said no rides in the story,
 * and the evidence it was handed in the backstory, which never leaves the server.
 */
export class NotApprovedError extends AuthorizationError {
  static override readonly flavor:  string = 'NotApprovedError'
  static override readonly subhead: string = 'A policy declined what the request asked for'

  /** Why the policy said no */
  declare readonly denial: Denialkind

  constructor(denial: Denialkind, story: Story = {}, backstory: Story = {}) {
    super(RefusalNotices[denial], { ...story, denial }, backstory)
    Object.defineProperty(this, 'denial', { value: denial, enumerable: true })
  }
}

// --- The policies

/**
 * Whether the claimed actor may read their hunt and all it holds: its realms, quizzes and
 * questions, and who is on it. In order:
 *
 * * Nobody without a userlabel
 * * Anyone on the hunt, in either role
 * * Nobody else
 *
 * @example Approve.mayReadHunt(claims)  // => 'allow', for a reviewer
 */
export function mayReadHunt(claims: Actor.HuntClaimsT): VerdictT {
  if (Actor.isUnlabelled(claims)) { return 'notIdentified' } // Nobody without a userlabel
  if (Actor.isMember(claims))     { return Allow }           // Anyone on the hunt, in either role
  return 'notPermitted'                                      // Nobody else
}

/**
 * Whether the claimed actor may change their hunt: make, delete, lock and unlock its quizzes,
 * retitle, relabel or delete it. Revising a quiz asks `mayReviseQuiz`, which also holds to the
 * quiz's lock; relabelling the hunt asks `mayRelabelHunt`, which also holds a sealed user's sandbox
 * to its label. In order:
 *
 * * Nobody without a userlabel
 * * A smith of the hunt
 * * Nobody else
 *
 * @example Approve.mayChangeHunt(claims)  // => 'notPermitted', for a reviewer
 */
export function mayChangeHunt(claims: Actor.HuntClaimsT): VerdictT {
  if (Actor.isUnlabelled(claims)) { return 'notIdentified' } // Nobody without a userlabel
  if (Actor.isSmith(claims))      { return Allow }           // A smith of the hunt
  return 'notPermitted'                                      // Nobody else
}

/**
 * Whether the claimed actor may relabel their hunt. A sealed user's one hunt is its sandbox,
 * `~label/label`, and the label that makes it one is the only one it may hold (`Hunt.isSandbox`):
 * a relabel could only break the sandbox or change nothing, so none is offered. In order:
 *
 * * Whoever may change the hunt (`mayChangeHunt`): a smith of it
 * * Nobody sealed (`Actor.isSealed`) relabels its sandbox
 * * Any other smith
 *
 * @example Approve.mayRelabelHunt(claims)  // => 'allow', for a smith signed in with Google
 * @example Approve.mayRelabelHunt(claims)  // => 'sealedRelabel', for an anonymous smith of its sandbox
 */
export function mayRelabelHunt(claims: Actor.HuntClaimsT): VerdictT {
  const changing = mayChangeHunt(claims)
  if (changing !== Allow)     { return changing }        // Whoever may change the hunt (`mayChangeHunt`): a smith of it
  if (Actor.isSealed(claims)) { return 'sealedRelabel' } // Nobody sealed relabels its sandbox
  return Allow                                           // Any other smith
}

/**
 * Whether the claimed actor may export their hunt: every quiz whole, every field of every question
 * and what its widgetings stored, as the Export box emits it. The export is the authors' way out
 * with their work; a reviewer is sent what a review needs (`Question.sentTo`), never the whole. In
 * order:
 *
 * * Whoever may change the hunt (`mayChangeHunt`): a smith of it
 *
 * @example Approve.mayExportHunt(claims)  // => 'notPermitted', for a reviewer
 */
export function mayExportHunt(claims: Actor.HuntClaimsT): VerdictT {
  return mayChangeHunt(claims) // Whoever may change the hunt (`mayChangeHunt`): a smith of it
}

/**
 * Whether the claimed actor may revise `quiz`, a quiz of their hunt: its fields, its questions and
 * what they stored, and its widgetings and columns. A locked quiz is a finished draft sent out for
 * playtesting, and holds still until a smith unlocks it; the refusal says so, so the author knows
 * what to do. In order:
 *
 * * Nobody without a userlabel
 * * Only a smith of the hunt
 * * A quiz that is gone is the write's to refuse (`quizGone`), as it would be for anyone
 * * Nothing in a locked quiz changes
 * * A smith, in an unlocked quiz
 *
 * @param quiz - The quiz, as last read; null when it is gone.
 * @param claims - The actor's claims on its hunt.
 *
 * @example Approve.mayReviseQuiz({ locked: true }, claims)  // => 'quizLocked', for a smith
 */
export function mayReviseQuiz(quiz: Pick<QuizRowT, 'locked'> | null, claims: Actor.HuntClaimsT): VerdictT {
  if (Actor.isUnlabelled(claims)) { return 'notIdentified' } // Nobody without a userlabel
  if (! Actor.isSmith(claims))    { return 'notPermitted' }  // Only a smith of the hunt
  if (quiz === null)              { return Allow }           // A quiz that is gone is the write's to refuse (`quizGone`), as it would be for anyone
  if (Quiz.isLocked(quiz))        { return 'quizLocked' }    // Nothing in a locked quiz changes
  return Allow                                               // A smith, in an unlocked quiz
}

/**
 * Whether the claimed actor may revise the quiz their claims hold (`mayReviseQuiz`): the dispatch
 * table's row for every action that revises the quiz on screen.
 *
 * @example Approve.verdictOn('add_question', { ...claims, quiz }, { kind: 'add_question' })
 */
function mayReviseClaimedQuiz(claims: Actor.QuizClaimsT): VerdictT {
  return mayReviseQuiz(claims.quiz, claims)
}

/**
 * Whether the claimed actor may write their own review of a quiz of their hunt. In order:
 *
 * * Nobody without a userlabel
 * * Nobody sealed (`Actor.isSealed`): an anonymous user reviews nothing, its own sandbox's quizzes included
 * * Anyone who may read the hunt: a review is always its writer's own
 *
 * @example Approve.mayWriteReview(claims)  // => 'allow', for a smith or a reviewer signed in with Google
 * @example Approve.mayWriteReview(claims)  // => 'sealedReview', for an anonymous user
 */
export function mayWriteReview(claims: Actor.HuntClaimsT): VerdictT {
  if (Actor.isUnlabelled(claims)) { return 'notIdentified' } // Nobody without a userlabel
  if (Actor.isSealed(claims))     { return 'sealedReview' }  // Nobody sealed: an anonymous user reviews nothing, its own sandbox's quizzes included
  return mayReadHunt(claims)                                 // Anyone who may read the hunt: a review is always its writer's own
}

/**
 * Whether the claimed actor may read `review`, with its verdicts. No reviewer reads the others'
 * before they have made up their own mind. In order:
 *
 * * Nobody without a userlabel
 * * Claims on another hunt say nothing of this one
 * * One's own review, while one is on its hunt
 * * Nobody else reads a review that is not shared
 * * A smith of the hunt reads every shared review
 * * Nobody off the hunt reads one
 * * A reviewer who has no review of the quiz reads no other
 * * A reviewer reads the shared reviews while their own is shared
 * * ...and not while it is not
 *
 * @param review - The review to read.
 * @param claims - The reader's claims on the review's hunt.
 * @param ownReview - The reader's own review of the same quiz; null when they have none.
 *
 * @example Approve.mayReadReview(review, claims, ownReview)  // => 'allow', for a reviewer whose own is shared too
 */
export function mayReadReview(review: ReviewPolicyT, claims: Actor.HuntClaimsT, ownReview: ReviewPolicyT | null): VerdictT {
  if (Actor.isUnlabelled(claims))           { return 'notIdentified' } // Nobody without a userlabel
  if (review.hunt_id !== claims.hunt_id)    { return 'notPermitted' }  // Claims on another hunt say nothing of this one
  if (Review.isActiveOwner(review, claims)) { return Allow }           // One's own review, while one is on its hunt
  if (Review.isHidden(review))              { return 'notPermitted' }  // Nobody else reads a review that is not shared
  if (Actor.isSmith(claims))                { return Allow }           // A smith of the hunt reads every shared review
  if (! Actor.isReviewer(claims))           { return 'notPermitted' }  // Nobody off the hunt reads one
  if (ownReview === null)                   { return 'notPermitted' }  // A reviewer who has no review of the quiz reads no other
  if (Review.isShared(ownReview))           { return Allow }           // A reviewer reads the shared reviews while their own is shared
  return 'notPermitted'                                                // ...and not while it is not
}

/**
 * Whether the claimed actor may put someone on their hunt, change their role, or take them off.
 * Whether the one put on may be is the user's own to say (`mayJoinHunt`), asked once the write
 * has found them. In order:
 *
 * * Nobody without a userlabel
 * * Nobody sealed (`Actor.isSealed`): an anonymous user's sandbox is its own alone
 * * Only a smith of the hunt
 * * Nobody changes their own place on it: another smith does
 * * A smith, anyone else's
 *
 * @param claims - The actor's claims on the hunt.
 * @param target - Whose place, by user id or by userlabel.
 *
 * @example Approve.mayChangeMembership(claims, { userlabel: 'bob_reviews' })  // => 'allow', for a smith
 * @example Approve.mayChangeMembership(claims, { user_id: claims.user_id })    // => 'ownHuntship'
 */
export function mayChangeMembership(claims: Actor.HuntClaimsT, target: Actor.UserRefT): VerdictT {
  if (Actor.isUnlabelled(claims))      { return 'notIdentified' } // Nobody without a userlabel
  if (Actor.isSealed(claims))          { return 'sealedMembers' } // Nobody sealed: an anonymous user's sandbox is its own alone
  if (! Actor.isSmith(claims))         { return 'notPermitted' }  // Only a smith of the hunt
  if (Actor.isOneself(claims, target)) { return 'ownHuntship' }   // Nobody changes their own place on it: another smith does
  return Allow                                                    // A smith, anyone else's
}

/**
 * Whether `user` may be put on a hunt, as a member in either role: what a smith adding them asks
 * once the write has found them by their userlabel. In order:
 *
 * * Nobody anonymous: a user with no proof of who holds it is sealed in its sandbox
 * * Anyone else
 *
 * @param user - Who would be put on, as anyone else is told of them.
 *
 * @example Approve.mayJoinHunt({ anonymous: true })   // => 'sealedJoin'
 * @example Approve.mayJoinHunt({ anonymous: false })  // => 'allow'
 */
export function mayJoinHunt(user: Pick<UserFaceT, 'anonymous'>): VerdictT {
  if (user.anonymous) { return 'sealedJoin' } // Nobody anonymous: a user with no proof of who holds it is sealed in its sandbox
  return Allow                                // Anyone else
}

/**
 * Whether `actor` may read the library of widgets, which holds formulas and prompts and nothing of
 * any hunt. In order:
 *
 * * Nobody without a userlabel
 * * Anyone who has
 *
 * @example Approve.mayReadLibrary(Actor.unlabelled)  // => 'notIdentified'
 */
export function mayReadLibrary(actor: Actor.ActorT): VerdictT {
  if (Actor.isUnlabelled(actor)) { return 'notIdentified' } // Nobody without a userlabel
  return Allow                                              // Anyone who has
}

/**
 * Whether `actor` may change the library of widgets: add, revise, move, remove and import them.
 * The library belongs to no hunt, and an edit to a widget changes every quiz that works it, in
 * every hunt, so changing it is an admin's act, not a smith's; who is an admin is
 * `Actor.isAdmin`'s to say. In order:
 *
 * * Nobody without a userlabel
 * * An admin
 * * Nobody else
 *
 * @example Approve.mayChangeLibrary(actor)  // => 'allow', for an admin
 */
export function mayChangeLibrary(actor: Actor.ActorT): VerdictT {
  return adminVerdict(actor) // Nobody without a userlabel; an admin; nobody else
}

/** The verdict of a policy that is an admin's alone: nobody without a userlabel, an admin (`Actor.isAdmin`), and nobody else */
function adminVerdict(actor: Actor.ActorT): VerdictT {
  if (Actor.isUnlabelled(actor)) { return 'notIdentified' } // Nobody without a userlabel
  if (Actor.isAdmin(actor))      { return Allow }           // An admin
  return 'notPermitted'                                     // Nobody else
}

/**
 * Whether `actor` may count how far a widget of the library is put to work across every hunt. The
 * count says how many, never which, so a hunt the actor is not on shows them nothing of itself; it
 * is for whoever weighs changing or removing the widget. In order:
 *
 * * Whoever may change the library (`mayChangeLibrary`)
 *
 * @example Approve.mayCountUsage(actor)  // => 'allow', for an admin
 */
export function mayCountUsage(actor: Actor.ActorT): VerdictT {
  return mayChangeLibrary(actor) // Whoever may change the library (`mayChangeLibrary`)
}

/**
 * Whether `actor` may read how far each backfill has run on the deployment (the stats page). The
 * counts say roughly how many rows the deployment holds, of every hunt, so they are an admin's,
 * unless the deployment says to show them to all. In order:
 *
 * * Anyone, where the deployment's `EXPOSE_INTERNAL_STATS_TO_ALL` says exactly `true`
 * * Nobody without a userlabel
 * * An admin (`Actor.isAdmin`)
 * * Nobody else
 *
 * @param actor - Who is asking.
 * @param exposeval - The value of `EXPOSE_INTERNAL_STATS_TO_ALL`; undefined when it is unset.
 *
 * @example Approve.mayReadBackfills(actor, undefined)  // => 'allow', for an admin
 * @example Approve.mayReadBackfills(Actor.unlabelled, 'true')  // => 'allow'
 * @example Approve.mayReadBackfills(Actor.unlabelled, 'false')  // => 'notIdentified'
 */
export function mayReadBackfills(actor: Actor.ActorT, exposeval: string | undefined): VerdictT {
  if (exposeval === ExposedToAll) { return Allow } // Anyone, where the deployment says exactly `true`
  return adminVerdict(actor)                       // Nobody without a userlabel; an admin; nobody else
}

/**
 * Whether `actor` may take the userlabel `action` names: anyone whose user holds none yet, an
 * anonymous one included. Whether it is free is the write's to say (`userlabelClaimed`), since it
 * turns on the rows of every user, ghosting and hunt. In order:
 *
 * * A user holds one userlabel, set once: taking it again is no change, and nothing else is offered
 * * Anyone whose user holds none yet
 *
 * @example Approve.mayAssertUserlabel(Actor.unlabelled, { kind: 'assume_userlabel', userlabel: 'flip_kromer', title: '' })  // => 'allow'
 * @example Approve.mayAssertUserlabel(flip, { kind: 'assume_userlabel', userlabel: 'flip_other', title: '' })               // => 'userlabelSet'
 */
export function mayAssertUserlabel(actor: Actor.ActorT, action: Extract<UserActionT, { kind: 'assume_userlabel' }>): VerdictT {
  if (! Actor.isUnlabelled(actor) && actor.userlabel !== action.userlabel) { return 'userlabelSet' } // A user holds one userlabel, set once
  return Allow                                                                                       // Anyone whose user holds none yet
}

/**
 * Whether `actor` may retitle the user they are. In order:
 *
 * * Nobody without a userlabel: they are nobody yet
 * * Anyone who has
 *
 * @example Approve.mayRetitleUser(actor)  // => 'allow'
 */
export function mayRetitleUser(actor: Actor.ActorT): VerdictT {
  if (Actor.isUnlabelled(actor)) { return 'notIdentified' } // Nobody without a userlabel: they are nobody yet
  return Allow                                              // Anyone who has
}

/**
 * Whether `actor` may make the hunt `action` names, of which they become the first smith, under
 * their own org. A sealed user makes only its sandbox, labelled with its own userlabel; its org
 * holding one already is the write's to refuse (`newHunt`), as two hunts of one org never share a
 * label. In order:
 *
 * * Nobody without a userlabel: a hunt nobody is on is one nobody can open
 * * Nobody sealed (`Actor.isSealed`) makes any hunt but its sandbox, `~label/label`
 * * Anyone who has
 *
 * @example Approve.mayMakeHunt(actor, { kind: 'new_hunt', label: 'loud_heron' })  // => 'allow', for a user signed in with Google
 * @example Approve.mayMakeHunt(actor, { kind: 'new_hunt', label: 'loud_heron' })  // => 'sealedHunts', for an anonymous one
 */
export function mayMakeHunt(actor: Actor.ActorT, action: Extract<OuterHuntActionT, { kind: 'new_hunt' }>): VerdictT {
  if (Actor.isUnlabelled(actor))                                 { return 'notIdentified' } // Nobody without a userlabel: a hunt nobody is on is one nobody can open
  if (Actor.isSealed(actor) && action.label !== actor.userlabel) { return 'sealedHunts' }   // Nobody sealed makes any hunt but its sandbox, `~label/label`
  return Allow                                                                              // Anyone who has
}

/**
 * Whether this server may put a question to Claude, as its environment's switch says. Server-only
 * in effect: only the server holds the switch, and hands its value in. In order:
 *
 * * The switch says exactly `allow`
 * * Unset, blank, or any other word leaves it off: a deployment that has said nothing says no
 *
 * @param switchval - The value of `ENABLE_ANTHROPIC_BOT`; undefined when it is unset.
 *
 * @example Approve.mayAskAnthropicBot(process.env.ENABLE_ANTHROPIC_BOT)  // => 'allow', where ENABLE_ANTHROPIC_BOT=allow
 * @example Approve.mayAskAnthropicBot(undefined)                         // => 'botsOff'
 */
export function mayAskAnthropicBot(switchval: string | undefined): VerdictT {
  if (switchval === SwitchedOn) { return Allow } // The switch says exactly `allow`
  return 'botsOff'                               // Unset, blank, or any other word leaves it off
}

// --- The dispatch table

/** Every action a request can carry: from inside a quiz, to a hunt from outside any quiz, to the library, or as the visitor themselves */
type ActionT = HuntActionT | OuterHuntActionT | LibraryActionT | UserActionT
type ActionKind = ActionT['kind']
/** The action of one kind */
type ActionOfKind<KK extends ActionKind> = Extract<ActionT, { kind: KK }>
/** The kinds of action decided of the actor alone: on the library, which no hunt owns, or before any hunt is in play (a user action, or making a hunt) */
type HuntlessKind = Exclude<LibraryActionT['kind'] | UserActionT['kind'] | Exclude<OuterHuntActionT, { hunt_id: unknown }>['kind'], HuntActionT['kind']>

/**
 * What each policy is handed, by key. An action's policy is handed the claims on the hunt it
 * lands on (the actor alone, for one on the library or one decided before any hunt is in play;
 * with the quiz on screen, for one that revises it) and the action; the outer hunt actions that
 * name a hunt share the row of the hunt action of their kind, where there is one, and are handed
 * the claims on that hunt all the same where there is not (arranging its categories).
 */
type EvidenceT = {
  [KK in ActionKind]: KK extends HuntlessKind ? [actor: Actor.ActorT, action: ActionT]
    : KK extends QuizRevisionKind ? [claims: Actor.QuizClaimsT, action: ActionT]
      : [claims: Actor.HuntClaimsT, action: ActionT]
} & {
  read_hunt:         [claims: Actor.HuntClaimsT]
  export_hunt:       [claims: Actor.HuntClaimsT]
  read_review:       [review: ReviewPolicyT, claims: Actor.HuntClaimsT, ownReview: ReviewPolicyT | null]
  read_library:      [actor: Actor.ActorT]
  change_library:    [actor: Actor.ActorT]
  count_usage:       [actor: Actor.ActorT]
  read_backfills:    [actor: Actor.ActorT, exposeval: string | undefined]
  join_hunt:         [user: Pick<UserFaceT, 'anonymous'>]
  ask_anthropic_bot: [switchval: string | undefined]
}

/** The key of a policy: an action's kind, or the name of a read or an ask */
export type PolicyKey = keyof EvidenceT

/** One row of the dispatch table: the policy for `KK`, each action's taking an action of that kind */
type PolicyRowT<KK extends PolicyKey> = KK extends ActionKind
  ? (claims: EvidenceT[KK][0], action: ActionOfKind<KK>) => VerdictT
  : (...evidence: EvidenceT[KK]) => VerdictT

type PolicyRowsT<KS extends PolicyKey> = { [KK in KS]: PolicyRowT<KK> }

/** The actions that revise a quiz's widgetings and columns, and which of its sources it templates: refused while it is locked */
const LayoutPolicies = {
  add_widgeting:    mayReviseClaimedQuiz,
  edit_widgeting:   mayReviseClaimedQuiz,
  delete_widgeting: mayReviseClaimedQuiz,
  move_widgeting:   mayReviseClaimedQuiz,
  add_column:       mayReviseClaimedQuiz,
  edit_column:      mayReviseClaimedQuiz,
  delete_column:    mayReviseClaimedQuiz,
  move_column:      mayReviseClaimedQuiz,
  set_templateable: mayReviseClaimedQuiz,
} as const satisfies Partial<PolicyRowsT<PolicyKey>>

/** The actions that revise the library every hunt shares: an admin's, of the actor alone, with no hunt or quiz in play */
const LibraryPolicies = {
  add_widget:     mayChangeLibrary,
  edit_widget:    mayChangeLibrary,
  delete_widget:  mayChangeLibrary,
  move_widget:    mayChangeLibrary,
  import_widgets: mayChangeLibrary,
} as const satisfies Partial<PolicyRowsT<PolicyKey>>

/** The actions that revise the quiz on screen and its questions: refused while it is locked */
const ContentPolicies = {
  retitle_quiz:        mayReviseClaimedQuiz,
  relabel_quiz:        mayReviseClaimedQuiz,
  set_smiths_note:     mayReviseClaimedQuiz,
  set_q1_preamble:     mayReviseClaimedQuiz,
  set_recap_head:      mayReviseClaimedQuiz,
  set_recap_tail:      mayReviseClaimedQuiz,
  set_recap_template:  mayReviseClaimedQuiz,
  edit_question:       mayReviseClaimedQuiz,
  add_question:        mayReviseClaimedQuiz,
  delete_questions:    mayReviseClaimedQuiz,
  set_viz:             mayReviseClaimedQuiz,
  sort_questions:      mayReviseClaimedQuiz,
  renumber_qnums:      mayReviseClaimedQuiz,
  move_question:       mayReviseClaimedQuiz,
  set_chain:           mayReviseClaimedQuiz,
  sort_by_chain_order: mayReviseClaimedQuiz,
  record_widgeted:     mayReviseClaimedQuiz,
  enter_widgeted:      mayReviseClaimedQuiz,
  enter_quiz_widgeted: mayReviseClaimedQuiz,
  import_questions:    mayReviseClaimedQuiz,
} as const satisfies Partial<PolicyRowsT<PolicyKey>>

/**
 * The actions that make, delete, lock and unlock a realm's quizzes. A locked quiz refuses none of
 * them: locking is never a trap, and one can always make another quiz, delete one, or unlock.
 */
const RealmPolicies = {
  new_quiz:    mayChangeHunt,
  delete_quiz: mayChangeHunt,
  set_lock:    mayChangeHunt,
} as const satisfies Partial<PolicyRowsT<PolicyKey>>

/** The actions on one's own review of a quiz: never refused for a lock, since reviewing a finished draft is the point of one */
const ReviewPolicies = {
  open_review:      mayWriteReview,
  set_overall:      mayWriteReview,
  set_review_phase: mayWriteReview,
  set_reviewing:    mayWriteReview,
  peek_answer:      mayWriteReview,
} as const satisfies Partial<PolicyRowsT<PolicyKey>>

/** The actions on the hunt itself, and who is on it, and making one */
const HuntPolicies = {
  add_huntship:    mayChangeMembership,
  remove_huntship: mayChangeMembership,
  retitle_hunt:   mayChangeHunt,
  relabel_hunt:   mayRelabelHunt,
  delete_hunt:    mayChangeHunt,
  arrange_categories: mayChangeHunt,
  rebranch_hunt:  mayChangeHunt,
  new_hunt:       mayMakeHunt,
} as const satisfies Partial<PolicyRowsT<PolicyKey>>

/** The user actions: the visitor as themselves, of the actor alone */
const UserPolicies = {
  assume_userlabel: mayAssertUserlabel,
  retitle_user:     mayRetitleUser,
} as const satisfies Partial<PolicyRowsT<PolicyKey>>

/** The reads, and the ask, by name */
const ReadPolicies = {
  read_hunt:         mayReadHunt,
  export_hunt:       mayExportHunt,
  read_review:       mayReadReview,
  read_library:      mayReadLibrary,
  count_usage:       mayCountUsage,
  read_backfills:    mayReadBackfills,
  join_hunt:         mayJoinHunt,
  ask_anthropic_bot: mayAskAnthropicBot,
} as const satisfies Partial<PolicyRowsT<PolicyKey>>

/**
 * What a scoped database asks of a row it is to write (`convex/policy_rules`), and a view asks
 * before it opens a door to the library: changing the library's widgets, as its actions do.
 */
const RowPolicies = {
  change_library: mayChangeLibrary,
} as const satisfies Partial<PolicyRowsT<PolicyKey>>

/** The policy of every action, by its kind */
const ActionPolicies = {
  ...LayoutPolicies, ...LibraryPolicies, ...ContentPolicies, ...RealmPolicies,
  ...ReviewPolicies, ...HuntPolicies, ...UserPolicies,
} as const satisfies PolicyRowsT<ActionKind>

/** Every policy, by key: a key with no row fails to compile, and so does a row with no key */
const Policies = { ...ActionPolicies, ...ReadPolicies, ...RowPolicies } as const satisfies PolicyRowsT<PolicyKey>

/** Every policy key, in the table's order */
export const PolicyKeys = Object.keys(Policies) as PolicyKey[]

/**
 * The verdict of the policy `key` on `evidence`.
 *
 * @param key - Which policy: an action's kind, or the name of a read.
 * @param evidence - What the policy is handed: for an action, the claims (or actor) and the action.
 * @returns `'allow'`, or why not.
 * @throws When no policy answers to `key`, or an action is handed under another kind's key: a
 *   programming error, never a denial.
 *
 * @example Approve.verdictOn('retitle_quiz', claims, action)  // => 'notPermitted', for a reviewer
 * @example Approve.verdictOn('read_hunt', claims)             // => 'allow', for a reviewer
 */
export function verdictOn<KK extends PolicyKey>(key: KK, ...evidence: EvidenceT[KK]): VerdictT {
  if (! Object.hasOwn(Policies, key)) { throw new Error(`No policy answers to ${key}`) }
  if (Object.hasOwn(ActionPolicies, key)) { assertKind(key, evidence[1] as ActionT) }
  // Each action's row takes its own kind's action, which `assertKind` has just made sure of
  const policy = Policies[key] as (...given: EvidenceT[KK]) => VerdictT
  return policy(...evidence)
}

/**
 * Whether the policy `key` allows what `evidence` describes: see `verdictOn`.
 *
 * @example if (Approve.may('read_hunt', claims)) { ... }
 * @example Approve.may('retitle_quiz', claims, { kind: 'retitle_quiz', title: 'Kings' })  // => true, for a smith
 */
export function may<KK extends PolicyKey>(key: KK, ...evidence: EvidenceT[KK]): boolean {
  return verdictOn(key, ...evidence) === Allow
}

/**
 * Go ahead only when the policy `key` allows what `evidence` describes (see `verdictOn`);
 * otherwise decline politely.
 *
 * @returns `'allow'`, when it may go ahead.
 * @throws `NotApprovedError`, with the denial's sentence, when it may not.
 *
 * @example Approve.must('ask_anthropic_bot', process.env.ENABLE_ANTHROPIC_BOT)  // => 'allow', where ENABLE_ANTHROPIC_BOT=allow
 * @example Approve.must('ask_anthropic_bot', undefined)                         // throws "Asking Claude is switched off on this server ..."
 */
export function must<KK extends PolicyKey>(key: KK, ...evidence: EvidenceT[KK]): typeof Allow {
  const verdict = verdictOn(key, ...evidence)
  if (verdict === Allow) { return Allow }
  throw new NotApprovedError(verdict, { policy: key }, { evidence })
}

/** The kinds of action whose policy decides from the claims alone, reading nothing of the action itself */
export type OfferableKind = {
  [KK in ActionKind]: Parameters<typeof ActionPolicies[KK]> extends [] | [unknown] ? KK : never
}[ActionKind]

/**
 * Whether a view should offer the holder of `claims` an action of `kind`: the verdict the server
 * would reach on any action of that kind, asked before the author has said what it is (a field
 * left editable, a button shown). Only for a kind whose policy reads nothing of the action; one
 * whose does (who a membership action names) is asked with the action itself, through `may`.
 *
 * @throws When no action answers to `kind`, or its policy reads the action: a programming error.
 *
 * @example Approve.mayOffer('edit_question', claims)  // => false, for a smith of a locked quiz
 * @example Approve.mayOffer('open_review', claims)    // => true, for a reviewer
 */
export function mayOffer<KK extends OfferableKind>(kind: KK, claims: EvidenceT[KK][0]): boolean {
  if (! Object.hasOwn(ActionPolicies, kind)) { throw new Error(`No action answers to ${kind}`) }
  const policy = ActionPolicies[kind] as (claims: EvidenceT[KK][0], ...rest: unknown[]) => VerdictT
  // The compiler holds a caller to the kinds whose policy takes the claims alone; this holds an untyped one.
  if (policy.length > 1) { throw new Error(`The policy for ${kind} reads the action: ask it with one`) }
  return policy(claims) === Allow
}

/**
 * Whether all the `verdicts` are true.
 *
 * @param verdicts - The verdicts to check -- booleans or promises of booleans.
 * @returns Whether all the `verdicts` are true.
 *
 * @example await Approve.every([true, Promise.resolve(false)])  // => false
 */
export async function every(verdicts: (boolean | Promise<boolean>)[]): Promise<boolean> {
  const verdictsA = await Promise.all(verdicts as Promise<boolean>[])
  return ApproveValidators.verdicts(verdictsA).every(Boolean)
}

/** Refuse, as a programming error, an action handed to the policy of another kind */
function assertKind(key: PolicyKey, action: ActionT): void {
  if (action.kind !== key) { throw new Error(`A ${action.kind} action was handed to the policy for ${key}`) }
}
