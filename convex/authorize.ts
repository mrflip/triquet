import type { Doc, Id } from './_generated/dataModel'
import { isReviewAction, type AccountActionT, type HuntActionT, type OpenQuizT } from '../src/models/actions'
import type { HuntRole } from '../src/models/hunting'
import { huntingFor, huntIdOf, reviewFor, type Reader } from './reading'

// The only place authorization is written. Who is asking is the ident a browser is now
// (`identFor`), and an ident's hunting on a hunt says what it may do there: a smith reads and
// changes everything of the hunt, a reviewer reads it and writes their own reviews (and reads the
// others' shared ones once their own is shared), and anyone
// else is shown nothing of it but who to ask. Anyone may still take on any ident, so this is as
// strong as that: a rule here asks who the ident is, never how the browser came to be it.
//
// Two kinds of row are private by what the functions offer rather than by a rule. A browser's
// identings are read only through its own key, so no browser sees which idents another has taken
// on. An ident may be made by anyone, but no function changes or removes one, so an ident
// someone has taken on cannot be pulled from under them.

/**
 * The role `ident_id` has on `hunt_id`: what every rule here turns on.
 *
 * @param db - The function's database.
 * @param hunt_id - Which hunt.
 * @param ident_id - Who is asking; null for a browser that has not said who it is.
 * @returns Its role; null when it is not on the hunt, or nobody is asking.
 *
 * @example await roleOn(ctx.db, hunt._id, ident?._id ?? null)  // => 'reviewer'
 */
export async function roleOn(db: Reader, hunt_id: Id<'hunts'>, ident_id: Id<'idents'> | null): Promise<HuntRole | null> {
  if (ident_id === null) { return null }
  const hunting = await huntingFor(db, hunt_id, ident_id)
  return hunting?.role ?? null
}

/**
 * Whether `ident_id` may read `hunt_id` and all it holds: its realms, quizzes and questions,
 * expressions and members. Anyone on it may, in either role.
 *
 * @example if (! await mayReadHunt(ctx.db, row.hunt_id, ident?._id ?? null)) { return null }
 */
export async function mayReadHunt(db: Reader, hunt_id: Id<'hunts'>, ident_id: Id<'idents'> | null): Promise<boolean> {
  return (await roleOn(db, hunt_id, ident_id)) !== null
}

/**
 * Whether `ident_id` may change `hunt_id`: its quizzes, their questions and layout, its
 * expressions, and who is on it. Its smiths may.
 */
export async function mayChangeHunt(db: Reader, hunt_id: Id<'hunts'>, ident_id: Id<'idents'> | null): Promise<boolean> {
  return (await roleOn(db, hunt_id, ident_id)) === 'smith'
}

/**
 * Whether `ident_id` may read `review`, with its verdicts: always their own; another's only once
 * it is shared, and then by a smith of its hunt, or by a reviewer there whose own review of the
 * quiz is shared too, so no reviewer reads the others' before they have made up their own mind.
 */
export async function mayReadReview(db: Reader, review: Doc<'reviews'>, ident_id: Id<'idents'> | null): Promise<boolean> {
  if (review.ident_id === ident_id) { return true }
  if (ident_id === null || review.phase !== 'shared') { return false }
  const role = await roleOn(db, review.hunt_id, ident_id)
  if (role !== 'reviewer') { return role === 'smith' }
  const own = await reviewFor(db, review.quiz_id, ident_id)
  return own?.phase === 'shared'
}

/**
 * Whether `ident_id` may write a review of a quiz of `hunt_id`. A review is always the writer's
 * own, so anyone on the hunt may, in either role.
 */
export async function mayWriteReview(db: Reader, hunt_id: Id<'hunts'>, ident_id: Id<'idents'> | null): Promise<boolean> {
  return await mayReadHunt(db, hunt_id, ident_id)
}

/**
 * Whether `ident_id` may carry out `action` from the quiz `open`: a review action as someone who
 * may write a review there, anything else as someone who may change the hunt.
 *
 * The rule is asked of `open.hunt_id`, so `open` must truly be of that hunt: its realm is the
 * hunt's and its quiz the realm's, and any quiz the action names by id is the hunt's too. A
 * browser that says otherwise is refused, as for a hunt it is not on. A quiz or realm that is gone
 * passes here and is the action's to refuse, as it would be for anyone.
 *
 * @param db - The mutation's database.
 * @param open - The quiz on the actor's screen, as their browser names it.
 * @param ident_id - Who is acting.
 * @param action - What they did.
 * @returns Whether they may.
 *
 * @example if (! await mayPerform(ctx.db, open, ident._id, action)) { refuse('notPermitted') }
 */
export async function mayPerform(db: Reader, open: OpenQuizT, ident_id: Id<'idents'>, action: HuntActionT): Promise<boolean> {
  const named = 'quiz_id' in action ? action.quiz_id : null
  const verdicts = await Promise.all([
    isReviewAction(action) ? mayWriteReview(db, open.hunt_id, ident_id) : mayChangeHunt(db, open.hunt_id, ident_id),
    isPlaced(db, open),
    named === null || isQuizOfHunt(db, named, open.hunt_id),
  ])
  return verdicts.every(Boolean)
}

/**
 * Whether `ident_id` may carry out the account action `action`: one that names a hunt as someone
 * who may change it, anything else as anyone at all (it acts only on the ident the browser is).
 *
 * @param db - The mutation's database.
 * @param ident_id - Who is acting; null for a browser that has not said who it is.
 * @param action - What they did.
 * @returns Whether they may.
 *
 * @example if (! await mayActOnAccount(ctx.db, ident?._id ?? null, action)) { refuse('notPermitted') }
 */
export async function mayActOnAccount(db: Reader, ident_id: Id<'idents'> | null, action: AccountActionT): Promise<boolean> {
  return 'hunt_id' in action ? await mayChangeHunt(db, action.hunt_id, ident_id) : true
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
