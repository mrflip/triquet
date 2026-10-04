import type { Doc, Id } from './_generated/dataModel'
import * as Actor from '../src/lib/actor'
import { isReviewAction, type AccountActionT, type HuntActionT, type OpenQuizT } from '../src/models/actions'
import type { HuntRole } from '../src/models/hunting'
import { huntingFor, huntingsFor, huntIdOf, reviewFor, type Reader } from './reading'
import * as Approval from '../src/lib/approval'

// The only place authorization is written. Who is asking is the actor every function is handed
// (`ctx.actor`, built in `functions.ts`): the ident the request's session asserted last, or
// nobody. An ident's hunting on a hunt says what it may do there: a smith reads and changes
// everything of the hunt, a reviewer reads it and writes their own reviews (and reads the others'
// shared ones once their own is shared), and anyone else is shown nothing of it but who to ask.
// A username belongs to the session that claimed it (`writing/account_actions`), so a rule here
// asks who the ident is and trusts that the session holding it is theirs.
//
// The library of widgets belongs to no hunt: every hunt sees the same one. Any browser that has
// said who it is may read it (`mayReadLibrary`): it holds formulas and prompts, nothing of any
// hunt. Changing it rides `hunts.perform` from a quiz on screen, like every layout action, and is
// authorized as any non-review action is, as a smith of the open hunt: being a smith of the hunt
// on screen is what "a smith of any hunt" comes to while the library is reached from a quiz. How
// far a widget is put to work reads widgetings of every hunt, so it is counted only, and only for
// a smith of some hunt (`mayCountUsage`), who may change the widget.
//
// Two kinds of row are private by what the functions offer rather than by a rule. A session's
// identings are read only through its own token, so no session sees which idents another has
// taken on. An ident may be made by any session, which then holds it; no function hands it to
// another or removes it, so a username someone holds cannot be pulled from under them.

/**
 * The role `actor` has on `hunt_id`: what every rule here turns on.
 *
 * @param db - The function's database.
 * @param hunt_id - Which hunt.
 * @param actor - Who is asking.
 * @returns Its role; null when it is not on the hunt, or has asserted no username.
 *
 * @example await roleOn(ctx.db, hunt._id, ctx.actor)  // => 'reviewer'
 */
export async function roleOn(db: Reader, hunt_id: Id<'hunts'>, actor: Actor.ActorT): Promise<HuntRole | null> {
  if (Actor.isAnonymous(actor)) { return null }
  const hunting = await huntingFor(db, hunt_id, actor.ident_id)
  return hunting?.role ?? null
}

/**
 * Whether `actor` may read the library of widgets: anyone who has asserted a username.
 *
 * @example if (! mayReadLibrary(ctx.actor)) { return [] }
 */
export function mayReadLibrary(actor: Actor.ActorT): boolean {
  return ! Actor.isAnonymous(actor)
}

/**
 * Whether `actor` may count how far a widget of the library is put to work, across every hunt:
 * anyone who may change the library, which is any smith of any hunt. The count says how many, never
 * which, so a hunt the actor is not on shows them nothing of itself.
 *
 * @example if (! await mayCountUsage(ctx.db, ctx.actor)) { return null }
 */
export async function mayCountUsage(db: Reader, actor: Actor.ActorT): Promise<boolean> {
  if (Actor.isAnonymous(actor)) { return false }
  const huntings = await huntingsFor(db, actor.ident_id)
  return huntings.some((hunting) => hunting.role === 'smith')
}

/**
 * Whether `actor` may read `hunt_id` and all it holds: its realms, quizzes and questions,
 * and members. Anyone on it may, in either role.
 *
 * @example if (! await mayReadHunt(ctx.db, row.hunt_id, ctx.actor)) { return null }
 */
export async function mayReadHunt(db: Reader, hunt_id: Id<'hunts'>, actor: Actor.ActorT): Promise<boolean> {
  return (await roleOn(db, hunt_id, actor)) !== null
}

/**
 * Whether `actor` may change `hunt_id`: its quizzes, their questions and layout, and who is on
 * it; and, from one of its quizzes, the library. Its smiths may.
 */
export async function mayChangeHunt(db: Reader, hunt_id: Id<'hunts'>, actor: Actor.ActorT): Promise<boolean> {
  return (await roleOn(db, hunt_id, actor)) === 'smith'
}

/**
 * Whether `actor` may read `review`, with its verdicts: nobody who has asserted no username; their
 * own, always; another's only once it is shared, and then by a smith of its hunt, or by a
 * reviewer there whose own review of the quiz is shared too, so no reviewer reads the others'
 * before they have made up their own mind.
 */
export async function mayReadReview(db: Reader, review: Doc<'reviews'>, actor: Actor.ActorT): Promise<boolean> {
  if (Actor.isAnonymous(actor))          { return false }
  if (review.ident_id === actor.ident_id) { return true }
  if (review.phase !== 'shared')         { return false }
  const role = await roleOn(db, review.hunt_id, actor)
  if (role !== 'reviewer') { return role === 'smith' }
  const own = await reviewFor(db, review.quiz_id, actor.ident_id)
  return own?.phase === 'shared'
}

/**
 * Whether `actor` may write a review of a quiz of `hunt_id`. A review is always the writer's
 * own, so anyone on the hunt may, in either role.
 */
export async function mayWriteReview(db: Reader, hunt_id: Id<'hunts'>, actor: Actor.ActorT): Promise<boolean> {
  return await mayReadHunt(db, hunt_id, actor)
}

/**
 * Whether `actor` may carry out `action` from the quiz: a review action as someone who
 * may write a review there, anything else as someone who may change the hunt.
 *
 * The rule is asked of `quiz.hunt_id`, so `quiz` must truly be of that hunt: its realm is the
 * hunt's and its quiz the realm's, and any quiz the action names by id is the hunt's too. A
 * browser that says otherwise is refused, as for a hunt it is not on. A quiz or realm that is gone
 * passes here and is the action's to refuse, as it would be for anyone.
 *
 * @param db - The mutation's database.
 * @param quiz - The quiz object
 * @param actor - Who is acting.
 * @param action - What they did.
 * @returns Whether they may.
 *
 * @example if (! await mayPerform(ctx.db, quiz, ctx.actor, action)) { refuse('notPermitted') }
 */
export async function mayPerform(db: Reader, quiz: OpenQuizT, actor: Actor.ActorT, action: HuntActionT): Promise<boolean> {
  const named = 'quiz_id' in action ? action.quiz_id : null
  const verdicts = await Promise.all([
    isReviewAction(action) ? mayWriteReview(db, quiz.hunt_id, actor) : mayChangeHunt(db, quiz.hunt_id, actor),
    isPlaced(db, quiz),
    named === null || isQuizOfHunt(db, named, quiz.hunt_id),
  ])
  return Approval.every(verdicts)
}

/**
 * Whether `actor` may carry out the account action `action`: one that names a hunt as someone
 * who may change it, anything else as anyone at all (it acts only on the session's own ident).
 *
 * @param db - The mutation's database.
 * @param actor - Who is acting.
 * @param action - What they did.
 * @returns Whether they may.
 *
 * @example if (! await mayActOnAccount(ctx.db, ctx.actor, action)) { refuse('notPermitted') }
 */
export async function mayActOnAccount(db: Reader, actor: Actor.ActorT, action: AccountActionT): Promise<boolean> {
  return 'hunt_id' in action ? await mayChangeHunt(db, action.hunt_id, actor) : true
}

/**
 * Whether the realm `open` names is its hunt's, and the quiz it names the realm's. A quiz that is
 * gone passes, and so does a realm that is gone with it; a quiz whose realm is gone does not,
 * since nothing then says whose it is.
 */
async function isPlaced(db: Reader, open: OpenQuizT): Promise<boolean> {
  const [realm, quiz] = await Promise.all([db.get('realms', open.realm_id), db.get('quizzes', open.quiz_id)])
  if (realm === null) { return quiz === null }
  return realm.hunt_id === open.hunt_id && (quiz === null || quiz.realm_id === open.realm_id)
}

/** Whether the quiz `quiz_id` belongs to `hunt_id`; one that is gone passes */
async function isQuizOfHunt(db: Reader, quiz_id: Id<'quizzes'>, hunt_id: Id<'hunts'>): Promise<boolean> {
  const quiz = await db.get('quizzes', quiz_id)
  return quiz === null || (await huntIdOf(db, quiz)) === hunt_id
}
