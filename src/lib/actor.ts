import type { Id } from '../../convex/_generated/dataModel'
import type { HuntRole } from '../models/hunting'
import type { QuizRowT } from '../models/quiz'

/** Who a request is from, before they have asserted a username, signed in or not */
export type AnonymousActorT = { kind: 'anonymous' }

/** Who a request is from, once their session has asserted a username: the session's user, the ident it took on last, and whether the deployment names that username an admin (`namesAdmin`) */
export type IdentActorT = {
  kind:        'ident'
  user_id:     Id<'users'>
  ident_id:    Id<'idents'>
  ident_label: string
  admin:       boolean
}

/**
 * Who a request is from, built once per request on the server and handed to every function as
 * `ctx.actor`: a tagged value, so that "nobody has said who they are" is a state with a name
 * rather than a null that might compare equal to another.
 */
export type ActorT = AnonymousActorT | IdentActorT

/** The actor of a request that has asserted no username: there is only one */
export const anonymous: AnonymousActorT = Object.freeze({ kind: 'anonymous' })

/**
 * The actor of a session that has asserted a username: the ident it took on last.
 *
 * @param user_id - The session's user.
 * @param ident - The ident it took on last.
 * @param admin - Whether the deployment names its username an admin (`namesAdmin`), as only the server can say.
 *
 * @example Actor.asIdent(user_id, { _id: ident_id, label: 'flip_kromer' }, false)  // => { kind: 'ident', user_id, ident_id, ident_label: 'flip_kromer', admin: false }
 */
export function asIdent(user_id: Id<'users'>, ident: { _id: Id<'idents'>, label: string }, admin: boolean): IdentActorT {
  return { kind: 'ident', user_id, ident_id: ident._id, ident_label: ident.label, admin }
}

/** What in a deployment's list of admins names every username */
export const EveryUsername = '*'

/**
 * Whether `admins`, a deployment's list of admins (its `TRIQUET_ADMINS`), names the username
 * `label`: usernames parted by commas or spaces, or `*` for every username. Unset or blank names
 * nobody. A local backend sets `*` unless told otherwise (`scripts/convex_dev`); production names
 * its admins outright.
 *
 * @example Actor.namesAdmin('mrflip', 'mrflip')            // => true
 * @example Actor.namesAdmin('mrflip, ada_l', 'ada_l')      // => true
 * @example Actor.namesAdmin('mrflip', 'mrflip_two')        // => false
 * @example Actor.namesAdmin('*', 'anyone_at_all')          // => true
 * @example Actor.namesAdmin(undefined, 'mrflip')           // => false
 */
export function namesAdmin(admins: string | undefined, label: string): boolean {
  const named = new Set((admins ?? '').split(/[\s,]+/).filter((each) => each !== ''))
  return named.has(EveryUsername) || named.has(label)
}

/**
 * Whether `actor` has asserted no username: a request with no session, or one whose session has
 * not yet taken on an ident.
 *
 * @example if (Actor.isAnonymous(ctx.actor)) { return null }
 */
export function isAnonymous(actor: ActorT): actor is AnonymousActorT {
  return actor.kind === 'anonymous'
}

/**
 * Whether `actor` is an admin: one who looks after what belongs to no hunt, the library of widgets
 * every hunt shares. Every policy that turns on it asks here (`Approve.mayChangeLibrary`). Who is
 * an admin is the deployment's to say (`namesAdmin`, over its `TRIQUET_ADMINS`), decided on the
 * server as it builds the actor, and carried on it to the browser, whose offers follow it.
 *
 * @example Actor.isAdmin(actor)  // => true, for a username the deployment names an admin
 */
export function isAdmin(actor: IdentActorT): boolean {
  return actor.admin
}

/** An actor's place on one hunt: a smith or reviewer there, by its hunting, or a stranger to it */
export const HuntStandingVals = ['smith', 'reviewer', 'stranger'] as const
export type HuntStanding = typeof HuntStandingVals[number]

/**
 * What the server has verified of an actor on one hunt, and what a policy decides from: who they
 * are, which hunt, and their standing there. An actor who has asserted no username is a stranger
 * to every hunt.
 */
export type HuntClaimsT = ActorT & { hunt_id: Id<'hunts'>, standing: HuntStanding }

/**
 * Claims on a hunt, and the quiz of it an action lands on, as last read: what a policy on revising
 * a quiz decides from. The quiz is null when it is gone, which the write refuses as it would for
 * anyone.
 */
export type QuizClaimsT = HuntClaimsT & { quiz: Pick<QuizRowT, 'locked'> | null }

/** Claims on a hunt held by one of its members: their standing is their role */
export type MemberClaimsT = HuntClaimsT & { standing: HuntRole }

/** An ident named by an action: by its id, or by the label it chose */
export type IdentRefT = { ident_id: Id<'idents'> } | { ident_label: string }

/**
 * The claims of `actor` on `hunt_id`, from its hunting there.
 *
 * @param actor - Who is asking.
 * @param hunt_id - Which hunt.
 * @param hunting - The actor's hunting on it; null when it has none, as for an actor who has asserted no username.
 *
 * @example Actor.claimsOn(actor, hunt_id, { role: 'reviewer' })  // => { ...actor, hunt_id, standing: 'reviewer' }
 * @example Actor.claimsOn(Actor.anonymous, hunt_id, null)        // => { kind: 'anonymous', hunt_id, standing: 'stranger' }
 */
export function claimsOn(actor: ActorT, hunt_id: Id<'hunts'>, hunting: { role: HuntRole } | null): HuntClaimsT {
  return { ...actor, hunt_id, standing: hunting?.role ?? 'stranger' }
}

/**
 * Whether `claims` are a smith's of their hunt.
 *
 * @example if (Actor.isSmith(claims)) { return Allow }
 */
export function isSmith(claims: HuntClaimsT): boolean {
  return claims.standing === 'smith'
}

/**
 * Whether `claims` are a reviewer's of their hunt.
 *
 * @example if (Actor.isReviewer(claims)) { ... }
 */
export function isReviewer(claims: HuntClaimsT): boolean {
  return claims.standing === 'reviewer'
}

/**
 * Whether `claims` are a member's of their hunt, in either role.
 *
 * @example if (Actor.isMember(claims)) { return Allow }
 */
export function isMember(claims: HuntClaimsT): claims is MemberClaimsT {
  return claims.standing !== 'stranger'
}

/**
 * The role a member holds on their hunt.
 *
 * @throws For a stranger to the hunt, who holds none: a caller asks only once a policy has let a member through.
 *
 * @example Actor.roleOf(claims)  // => 'reviewer'
 */
export function roleOf(claims: HuntClaimsT): HuntRole {
  if (! isMember(claims)) { throw new Error('A stranger to a hunt holds no role on it') }
  return claims.standing
}

/**
 * Whether `target` names the ident `actor` is, by id or by label. Nobody is an actor who has
 * asserted no username.
 *
 * @example Actor.isOneself(actor, { ident_label: actor.ident_label })  // => true
 * @example Actor.isOneself(actor, { ident_id: someone_else_id })        // => false
 */
export function isOneself(actor: ActorT, target: IdentRefT): boolean {
  if (isAnonymous(actor))   { return false }
  if ('ident_id' in target) { return target.ident_id === actor.ident_id }
  return target.ident_label === actor.ident_label
}
