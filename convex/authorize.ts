import * as EST from 'es-toolkit'
import type { Doc, Id } from './_generated/dataModel'
import * as Actor from '../src/lib/actor'
import * as Approve from '../src/lib/approve'
import type { AccountActionT, AffirmsT, HuntActionT, HuntAffirmsT, LibraryActionT, QuizAffirmsT } from '../src/models/actions'
import { huntingFor, reviewFor, type Reader } from './reading'

// Where the evidence for every authorization is gathered. Who is asking is the actor every
// function is handed (`ctx.actor`, built in `functions.ts`): the ident the request's session
// asserted last, or nobody. Each `affirm…` function here reads what its decision needs, builds the
// claims, and hands them to a policy in `src/lib/approve`, which decides; nothing here decides.
//
// A browser on a hunt sends its **affirms** with every request about it: who it is, which hunt, its
// standing there, and the quiz (and realm) it has on screen, all things it already holds from the
// hunt it opened. `affirmForHunt` checks every one against the database in one parallel round,
// with whatever else the decision needs read beside them, and hands on the **claims**: the affirms
// as checked, and the rows read. Code handed claims trusts them. An affirm the database does not
// bear out (stale, or forged) is turned away like any other denial: a query answers it with its
// empty value (`emptyIfDenied` in `functions.ts`), a mutation with a refusal (`refusingInvalid`).
//
// An ident's hunting on a hunt is its standing there: a smith reads and changes everything of the
// hunt, a reviewer reads it and writes their own reviews (and reads the others' shared ones once
// their own is shared), and a stranger is shown nothing of it but who to ask. A username belongs
// to the session that claimed it (`writing/account_actions`), so the claims trust that the
// session holding the ident is theirs.
//
// The library of widgets belongs to no hunt: every hunt sees the same one, and no hunt's function
// writes it. Reading it needs no evidence beyond the actor (`Approve.mayReadLibrary`, asked in
// `widgets.ts`). Changing it is an admin's act, on a mutation of its own (`widgets.perform`) that
// needs no hunt or quiz in play, decided of the actor alone (`Approve.mayChangeLibrary`, and
// `Actor.isAdmin`, the one place that says who is an admin). How far a widget is put to work
// reads widgetings of every hunt, so it is counted only, and only for whoever may change the
// library (`Approve.mayCountUsage`).
//
// Once affirmed, a function about one hunt holds a database that reaches nothing else
// (`policy_rules.ts`): the backstop behind every check here. The few that hold the whole database
// are listed below (`Unscoped`), each with why.
//
// Two kinds of row are private by what the functions offer rather than by a rule. A session's
// identings are read only through its own token (and no hunt's database reaches them), so no
// session sees which idents another has taken on. An ident may be made by any session, which then
// holds it; no function hands it to another or removes it, so a username someone holds cannot be
// pulled from under them.

/**
 * The public functions that hold the whole database, each with why. Every other public function
 * is scoped (`scopeOf` in `functions.ts`): about one hunt, built by `zHuntQuery` or
 * `zHuntMutation`, it affirms first, and its handler holds a database that sees and writes only
 * that hunt; or a change to the library, built by `zLibraryMutation`, whose handler holds a
 * database that reaches only the library (`policy_rules.ts`). These act before any hunt is in
 * play, across hunts, or only read what no hunt owns, and each checks what it needs itself.
 */
export const Unscoped = {
  "auth:isAuthenticated":  "Convex Auth's own, of the session alone",
  "auth:signIn":           "Convex Auth's own, of the session alone",
  "auth:signOut":          "Convex Auth's own, of the session alone",
  "idents:current":        "Who the session is: asked before any hunt is in play",
  "idents:performAccount": "A username, or a hunt from the hunts list, before any quiz is open: a hunt it names is asked of the actor's claims on it (`claimsFor`)",
  "hunts:list":            "The hunts the actor is on, read through the actor's own huntings: many hunts, none affirmed",
  "hunts:open":            "Finds a hunt by its label and tells the browser its standing there, which is what the browser goes on to affirm",
  "widgets:library":       "The library belongs to no hunt: every hunt sees the same one",
  "widgets:usage":         "Counts the widgetings of every hunt, and hands back counts only (`Approve.mayCountUsage`)",
} as const satisfies Record<string, string>

/** Affirms of any shape `affirmForHunt` checks: of a hunt, and perhaps a quiz of it, and that quiz's realm */
type AffirmableT = HuntAffirmsT & { quiz_id?: Id<'quizzes'>, realm_id?: Id<'realms'> }

/** Reads to make in the same round as the evidence, by the name each result is to go by */
type PendingT = Record<string, Promise<unknown>>

/** Those reads, made */
type SettledT<QQ extends PendingT> = { [KK in keyof QQ]: Awaited<QQ[KK]> }

/** The rows `affirmForHunt` reads to check what was affirmed: the quiz, when one was, and the realm, when one was; each null when gone */
type AffirmedRowsT<AT extends AffirmableT> =
  & (AT extends { quiz_id: Id<'quizzes'> } ? { quiz: Doc<'quizzes'> | null } : unknown)
  & (AT extends { realm_id: Id<'realms'> } ? { realm: Doc<'realms'> | null } : unknown)

/**
 * What `affirmForHunt` hands on for affirms of the shape `AT`: who is asking, every affirm, each
 * now checked, and the rows read to check them. A hunt's claims (`Actor.HuntClaimsT`), and with a
 * quiz affirmed, a quiz's (`Actor.QuizClaimsT`).
 */
export type ClaimsOf<AT extends AffirmableT> = Actor.IdentActorT & AT & AffirmedRowsT<AT>

/** The claims an action is carried out on: the quiz on screen, its realm and hunt, and the quiz the action names by id, if any */
export type PerformClaimsT = ClaimsOf<AffirmsT> & { named: Doc<'quizzes'> | null }

/**
 * Check what a browser affirms of itself on a hunt against the database, in one parallel round of
 * reads, and hand on the claims. Read together: the actor's hunting on the affirmed hunt, the
 * quiz and realm when they are affirmed, and every one of `queries`, which come back beside the
 * claims under their own names. Then, in order, each turned away as a denial when it fails:
 *
 * * Nobody who has asserted no username has claims on any hunt (`notIdentified`)
 * * The browser is the ident it says
 * * ...and stands on the hunt as it says: its hunting's role, or a stranger with none
 * * The quiz it names is of the hunt
 * * ...and of the realm, where it names one
 * * The realm it names is of the hunt
 *
 * A quiz or realm that is gone holds nothing to the contrary, and passes: what then refuses it is
 * the write that comes to it, as it would for anyone (`quizGone`).
 *
 * @param db - The function's database.
 * @param affirms - What the browser says: a hunt's affirms, a quiz's, or an action's.
 * @param actor - Who is asking (`ctx.actor`).
 * @param queries - Reads the decision needs beside the evidence, made in the same round; `{}` for none.
 * @returns The claims, and what `queries` read.
 * @throws `Approve.NotApprovedError` when an affirm is not borne out: `notIdentified` for an
 *   actor who has asserted no username, `notPermitted` for anything else.
 *
 * @example const claims = await affirmForHunt(ctx.db, affirms, ctx.actor, {})                 // => { ...actor, hunt_id, standing: 'smith', quiz_id, quiz }
 * @example const { question } = await affirmForHunt(ctx.db, affirms, ctx.actor, { question: ctx.db.get('questions', question_id) })
 */
export async function affirmForHunt<AT extends AffirmableT, QQ extends PendingT>(db: Reader, affirms: AT, actor: Actor.ActorT, queries: QQ): Promise<ClaimsOf<AT> & SettledT<QQ>> {
  if (Actor.isAnonymous(actor)) { deny('notIdentified', 'actor') }
  const { hunting, quiz, realm, fetched } = await EST.allKeyed({
    hunting: huntingFor(db, affirms.hunt_id, actor.ident_id),
    quiz:    affirms.quiz_id === undefined ? null : db.get('quizzes', affirms.quiz_id),
    realm:   affirms.realm_id === undefined ? null : db.get('realms', affirms.realm_id),
    fetched: EST.allKeyed(queries),
  })
  const { standing } = Actor.claimsOn(actor, affirms.hunt_id, hunting)
  if (affirms.ident_id !== actor.ident_id)          { deny('notPermitted', 'ident_id') } // The browser is the ident it says
  if (affirms.standing !== standing)                { deny('notPermitted', 'standing') } // ...and stands on the hunt as it says
  if (! holdsTo(quiz, 'hunt_id', affirms.hunt_id))   { deny('notPermitted', 'quiz_id') }  // The quiz it names is of the hunt
  if (! holdsTo(quiz, 'realm_id', affirms.realm_id)) { deny('notPermitted', 'quiz_id') }  // ...and of the realm, where it names one
  if (! holdsTo(realm, 'hunt_id', affirms.hunt_id))  { deny('notPermitted', 'realm_id') } // The realm it names is of the hunt
  const rows = { ...(affirms.quiz_id !== undefined && { quiz }), ...(affirms.realm_id !== undefined && { realm }) }
  // The rows are there exactly when their ids were affirmed, which is what `AffirmedRowsT` says of `AT`.
  return { ...actor, ...affirms, ...rows, ...fetched } as ClaimsOf<AT> & SettledT<QQ>
}

/**
 * The claims of `actor` on `hunt_id`, from its hunting there, for a request that affirms nothing:
 * one that finds its hunt by label (`hunts.open`), or an account action naming a hunt. One read;
 * none for an actor who has asserted no username, a stranger to every hunt.
 *
 * @param db - The function's database.
 * @param hunt_id - Which hunt.
 * @param actor - Who is asking.
 *
 * @example await claimsFor(ctx.db, hunt._id, ctx.actor)  // => { ...ctx.actor, hunt_id, standing: 'reviewer' }
 */
export async function claimsFor(db: Reader, hunt_id: Id<'hunts'>, actor: Actor.ActorT): Promise<Actor.HuntClaimsT> {
  const hunting = Actor.isAnonymous(actor) ? null : await huntingFor(db, hunt_id, actor.ident_id)
  return Actor.claimsOn(actor, hunt_id, hunting)
}

/**
 * The claims of `actor` on the affirmed hunt, once they may read it and all it holds
 * (`Approve.mayReadHunt`): with a quiz affirmed, that quiz as read, null when it is gone.
 *
 * @throws `Approve.NotApprovedError` when an affirm is not borne out, or the policy says no.
 *
 * @example const { quiz } = await affirmReadHunt(ctx.db, affirms, ctx.actor)
 */
export async function affirmReadHunt<AT extends AffirmableT>(db: Reader, affirms: AT, actor: Actor.ActorT): Promise<ClaimsOf<AT>> {
  const claims = await affirmForHunt(db, affirms, actor, {})
  Approve.must('read_hunt', claims)
  return claims
}

/**
 * The claims of `actor` on the affirmed hunt, once they may export it, every quiz whole
 * (`Approve.mayExportHunt`): a smith of it. With a quiz affirmed, that quiz as read, null when it
 * is gone: what a smith's record of the hunt reads one quiz at a time.
 *
 * @throws `Approve.NotApprovedError` when an affirm is not borne out, or the policy says no.
 *
 * @example const { hunt_id } = await affirmExportHunt(ctx.db, affirms, ctx.actor)
 * @example const { quiz } = await affirmExportHunt(ctx.db, quizAffirms, ctx.actor)
 */
export async function affirmExportHunt<AT extends AffirmableT>(db: Reader, affirms: AT, actor: Actor.ActorT): Promise<ClaimsOf<AT>> {
  const claims = await affirmForHunt(db, affirms, actor, {})
  Approve.must('export_hunt', claims)
  return claims
}

/**
 * The claims of `actor` on the affirmed hunt, and its question `question_id` as read (null when it
 * is gone), once they may read the hunt (`Approve.mayReadHunt`) and the question is of it. One
 * round: the question is read beside the evidence.
 *
 * @throws `Approve.NotApprovedError` when an affirm is not borne out, the question is another
 *   hunt's, or the policy says no.
 *
 * @example const { question } = await affirmReadQuestion(ctx.db, affirms, ctx.actor, question_id)
 */
export async function affirmReadQuestion(db: Reader, affirms: HuntAffirmsT, actor: Actor.ActorT, question_id: Id<'questions'>): Promise<ClaimsOf<HuntAffirmsT> & { question: Doc<'questions'> | null }> {
  const claims = await affirmForHunt(db, affirms, actor, { question: db.get('questions', question_id) })
  if (! holdsTo(claims.question, 'hunt_id', claims.hunt_id)) { deny('notPermitted', 'question_id') } // The question is of the hunt
  Approve.must('read_hunt', claims)
  return claims
}

/** The claims a quiz's reviews are read on: of the hunt and the quiz, and the reader's own review of it, null when they have none */
export type ReviewClaimsT = ClaimsOf<QuizAffirmsT> & { own_review: Doc<'reviews'> | null }

/**
 * The claims of `actor` on the affirmed quiz, to read its reviews on, with their own review of it.
 * One round: their own review is read beside the evidence, so a database scoped to these claims
 * judges each review (`Approve.mayReadReview`, in `policy_rules.ts`) with nothing more read.
 *
 * @param db - The function's database.
 * @param affirms - What the browser says of itself, and the quiz.
 * @param actor - Who is asking.
 * @returns The claims, and their own review of the quiz.
 * @throws `Approve.NotApprovedError` when an affirm is not borne out.
 *
 * @example const claims = await affirmReadReviews(ctx.db, affirms, ctx.actor)  // => { ...claims, own_review }
 */
export async function affirmReadReviews(db: Reader, affirms: QuizAffirmsT, actor: Actor.ActorT): Promise<ReviewClaimsT> {
  if (Actor.isAnonymous(actor)) { deny('notIdentified', 'actor') }
  return await affirmForHunt(db, affirms, actor, { own_review: reviewFor(db, affirms.quiz_id, actor.ident_id) })
}

/**
 * Go on only when `actor` may carry out `action` on the library, by the policy of its kind
 * (`Approve.mayChangeLibrary`). The library belongs to no hunt, so the decision is of the actor
 * alone, and there is nothing to read: who is an admin is `Actor.isAdmin`'s to say.
 *
 * @param actor - Who is acting.
 * @param action - What they did to the library.
 * @throws `Approve.NotApprovedError` when the policy says no: `notIdentified` before any username,
 *   `notPermitted` for one who is no admin.
 *
 * @example affirmLibraryAction(ctx.actor, { kind: 'move_widget', label: 'dumdum', onto_idx: 0 })
 */
export function affirmLibraryAction(actor: Actor.ActorT, action: LibraryActionT): void {
  Approve.must(action.kind, actor, action)
}

/**
 * The claims `actor` carries out `action` on, once the policy of the action's kind allows it
 * (`Approve.verdictOn`): the affirmed quiz, realm and hunt, checked, and the quiz the action names
 * by id, read in the same round and held to the same hunt. A browser that says otherwise is
 * turned away, as for a hunt it is not on; a quiz the action names that is gone passes, and is the
 * write's to refuse.
 *
 * @param db - The mutation's database.
 * @param affirms - What the browser says of itself, and the quiz on its screen.
 * @param actor - Who is acting.
 * @param action - What they did.
 * @returns The claims the write trusts.
 * @throws `Approve.NotApprovedError` when an affirm is not borne out, or the policy says no:
 *   `notPermitted` for a reviewer retitling a quiz, `quizLocked` for a smith revising a locked one.
 *
 * @example const claims = await affirmPerform(ctx.db, affirms, ctx.actor, action)
 */
export async function affirmPerform(db: Reader, affirms: AffirmsT, actor: Actor.ActorT, action: HuntActionT): Promise<PerformClaimsT> {
  const claims = await affirmForHunt(db, affirms, actor, { named: namedQuizOf(db, action) })
  if (! holdsTo(claims.named, 'hunt_id', claims.hunt_id)) { deny('notPermitted', 'action.quiz_id') } // The quiz the action names is of the hunt
  Approve.must(action.kind, claims, action)
  return claims
}

/**
 * Go on only when `actor` may carry out the account action `action`, by the policy of its kind:
 * one that names a hunt asked of the actor's claims on it, anything else of the actor alone. An
 * account action is taken from the hunts list, before any quiz is open, so it affirms nothing:
 * the one read its claims need is made here.
 *
 * @param db - The mutation's database.
 * @param actor - Who is acting.
 * @param action - What they did.
 * @throws `Approve.NotApprovedError` when the policy says no: `notIdentified` for retitle_ident before any username.
 *
 * @example await affirmAccountAction(ctx.db, ctx.actor, action)
 */
export async function affirmAccountAction(db: Reader, actor: Actor.ActorT, action: AccountActionT): Promise<void> {
  if ('hunt_id' in action) {
    Approve.must(action.kind, await claimsFor(db, action.hunt_id, actor), action)
    return
  }
  Approve.must(action.kind, actor, action)
}

/** The quiz `action` names by id, as read; null when it names none, or that quiz is gone */
async function namedQuizOf(db: Reader, action: HuntActionT): Promise<Doc<'quizzes'> | null> {
  return 'quiz_id' in action ? await db.get('quizzes', action.quiz_id) : null
}

/**
 * Whether `row` holds `fieldname` as it was affirmed. A row that is gone holds nothing to the
 * contrary (its write refuses it, as for anyone), and nor does anything about a field nobody
 * affirmed.
 */
function holdsTo<RT extends object, FK extends keyof RT>(row: RT | null, fieldname: FK, affirmed: RT[FK] | undefined): boolean {
  if (row === null)           { return true } // A row that is gone holds nothing to the contrary
  // eslint-disable-next-line unicorn/prefer-combined-guards -- one guard per rule, each beside its rule, as notes/policy_approve.md asks
  if (affirmed === undefined) { return true } // ...nor does anything about a field nobody affirmed
  return row[fieldname] === affirmed
}

/** Turn the request away, saying which affirm was not borne out: a query answers with its empty value, a mutation refuses */
function deny(denial: Approve.Denialkind, affirmed: string): never {
  throw new Approve.NotApprovedError(denial, { affirm: affirmed })
}
