import type { Doc, Id } from './_generated/dataModel'
import * as Actor from '../src/lib/actor'
import * as Approve from '../src/lib/approve'
import type { AccountActionT, HuntActionT, OpenQuizT } from '../src/models/actions'
import { Review } from '../src/models/review'
import { huntingFor, huntingsFor, huntIdOf, type Reader } from './reading'

// Where the evidence for every authorization is gathered. Who is asking is the actor every
// function is handed (`ctx.actor`, built in `functions.ts`): the ident the request's session
// asserted last, or nobody. Each `affirm…` function here reads what its decision needs, builds the
// claims, and hands them to a policy in `src/lib/approve`, which decides; nothing here decides.
// A query answers a denial with its empty value, a mutation with a refusal.
//
// An ident's hunting on a hunt is its standing there: a smith reads and changes everything of the
// hunt, a reviewer reads it and writes their own reviews (and reads the others' shared ones once
// their own is shared), and a stranger is shown nothing of it but who to ask. A username belongs
// to the session that claimed it (`writing/account_actions`), so the claims trust that the
// session holding the ident is theirs.
//
// The library of widgets belongs to no hunt: every hunt sees the same one. Reading it needs no
// evidence beyond the actor (`Approve.mayReadLibrary`, asked in `widgets.ts`). Changing it rides
// `hunts.perform` from a quiz on screen, like every layout action, and is authorized as a smith of
// the open hunt: being a smith of the hunt on screen is what "a smith of any hunt" comes to while
// the library is reached from a quiz. How far a widget is put to work reads widgetings of every
// hunt, so it is counted only, and only for a smith of some hunt (`affirmCountUsage`).
//
// Two kinds of row are private by what the functions offer rather than by a rule. A session's
// identings are read only through its own token, so no session sees which idents another has
// taken on. An ident may be made by any session, which then holds it; no function hands it to
// another or removes it, so a username someone holds cannot be pulled from under them.

/**
 * The claims of `actor` on `hunt_id`: who they are, and their standing there, from their hunting.
 * One read; none for an actor who has asserted no username, a stranger to every hunt.
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
 * Whether `actor` may read `hunt_id` and all it holds (`Approve.mayReadHunt`).
 *
 * @example if (! await affirmReadHunt(ctx.db, row.hunt_id, ctx.actor)) { return null }
 */
export async function affirmReadHunt(db: Reader, hunt_id: Id<'hunts'>, actor: Actor.ActorT): Promise<boolean> {
  return Approve.may('read_hunt', await claimsFor(db, hunt_id, actor))
}

/**
 * The reviews of `reviews`, all of one quiz, that `actor` may read (`Approve.mayReadReview`). The
 * actor's standing is read once for them all, and their own review found among them.
 *
 * @param db - The function's database.
 * @param reviews - Every review of one quiz.
 * @param actor - Who is asking.
 * @returns The readable ones, in the order given.
 *
 * @example const readable = await affirmReadReviews(ctx.db, await reviewsOf(ctx.db, quiz_id), ctx.actor)
 */
export async function affirmReadReviews(db: Reader, reviews: readonly Doc<'reviews'>[], actor: Actor.ActorT): Promise<Doc<'reviews'>[]> {
  const [first] = reviews
  if (first === undefined) { return [] }
  const claims = await claimsFor(db, first.hunt_id, actor)
  const ownReview = Review.ownOf(reviews, actor)
  return reviews.filter((review) => Approve.may('read_review', review, claims, ownReview))
}

/**
 * Whether `actor` may count how far a widget of the library is put to work (`Approve.mayCountUsage`).
 *
 * @example if (! await affirmCountUsage(ctx.db, ctx.actor)) { return null }
 */
export async function affirmCountUsage(db: Reader, actor: Actor.ActorT): Promise<boolean> {
  const huntings = Actor.isAnonymous(actor) ? [] : await huntingsFor(db, actor.ident_id)
  return Approve.may('count_usage', actor, huntings)
}

/**
 * The verdict on `actor` carrying out `action` from the quiz `place` names, by the policy of the
 * action's kind (`Approve.verdictOn`), asked of `place.hunt_id`.
 *
 * So `place` must truly be of that hunt: its realm is the hunt's and its quiz the realm's, and any
 * quiz the action names by id is the hunt's too. A browser that says otherwise is denied, as for
 * a hunt it is not on. A quiz or realm that is gone passes here and is the action's to refuse, as
 * it would be for anyone.
 *
 * @param db - The mutation's database.
 * @param place - The quiz on the author's screen, and the realm and hunt it says it belongs to.
 * @param actor - Who is acting.
 * @param action - What they did.
 * @returns `'allow'`, or why not.
 *
 * @example const verdict = await affirmPerform(ctx.db, place, ctx.actor, action)  // => 'notPermitted', for a reviewer retitling a quiz
 */
export async function affirmPerform(db: Reader, place: OpenQuizT, actor: Actor.ActorT, action: HuntActionT): Promise<Approve.VerdictT> {
  const named = 'quiz_id' in action ? action.quiz_id : null
  const [claims, placed, ofHunt] = await Promise.all([
    claimsFor(db, place.hunt_id, actor),
    isPlaced(db, place),
    named === null || isQuizOfHunt(db, named, place.hunt_id),
  ])
  if (! placed) { return 'notPermitted' } // The place is not of the hunt it names
  // eslint-disable-next-line unicorn/prefer-combined-guards -- one guard per rule, each beside its rule, as notes/policy_approve.md asks
  if (! ofHunt) { return 'notPermitted' } // The quiz the action names is not of that hunt
  return Approve.verdictOn(action.kind, claims, action)
}

/**
 * The verdict on `actor` carrying out the account action `action`, by the policy of its kind: one
 * that names a hunt asked of the actor's claims on it, anything else of the actor alone.
 *
 * @param db - The mutation's database.
 * @param actor - Who is acting.
 * @param action - What they did.
 * @returns `'allow'`, or why not.
 *
 * @example const verdict = await affirmAccountAction(ctx.db, ctx.actor, action)  // => 'notIdentified', for retitle_ident before any username
 */
export async function affirmAccountAction(db: Reader, actor: Actor.ActorT, action: AccountActionT): Promise<Approve.VerdictT> {
  if ('hunt_id' in action) { return Approve.verdictOn(action.kind, await claimsFor(db, action.hunt_id, actor), action) }
  return Approve.verdictOn(action.kind, actor, action)
}

/**
 * Whether the realm `open` names is its hunt's, and the quiz it names the realm's. A quiz that is
 * gone passes, and so does a realm that is gone with it; a quiz whose realm is gone does not,
 * since nothing then says whose it is.
 */
async function isPlaced(db: Reader, open: OpenQuizT): Promise<boolean> {
  const [realm, quiz] = await Promise.all([db.get('realms', open.realm_id), db.get('quizzes', open.quiz_id)])
  if (realm === null)                { return quiz === null }
  if (realm.hunt_id !== open.hunt_id) { return false }
  if (quiz === null)                 { return true }
  return quiz.realm_id === open.realm_id
}

/** Whether the quiz `quiz_id` belongs to `hunt_id`; one that is gone passes */
async function isQuizOfHunt(db: Reader, quiz_id: Id<'quizzes'>, hunt_id: Id<'hunts'>): Promise<boolean> {
  const quiz = await db.get('quizzes', quiz_id)
  if (quiz === null) { return true }
  return (await huntIdOf(db, quiz)) === hunt_id
}
