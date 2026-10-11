import type { Id } from '../../convex/_generated/dataModel'
import type { HuntRole } from '../models/huntship'
import type { QuizRowT } from '../models/quiz'
import { User, type UserRowT } from '../models/user'

/** Who a request is from before its user holds a userlabel, or when it has no session at all */
export type UnlabelledActorT = { kind: 'unlabelled' }

/**
 * Who a request is from once its user holds a userlabel: the user, its userlabel and title,
 * whether it is an admin (`ofUser`), and whether it is anonymous, signed in with no proof, and so
 * sealed in its sandbox (`Approve`).
 */
export type UserActorT = {
  kind:      'user'
  user_id:   Id<'users'>
  userlabel: string
  usertitle: string
  admin:     boolean
  anonymous: boolean
}

/**
 * Who a request is from, built once per request on the server and handed to every function as
 * `ctx.actor`: a tagged value, so that "nobody has said who they are" is a state with a name
 * rather than a null that might compare equal to another.
 */
export type ActorT = UnlabelledActorT | UserActorT

/** The actor of a request whose user holds no userlabel: there is only one */
export const unlabelled: UnlabelledActorT = Object.freeze({ kind: 'unlabelled' })

/** What of a deployment `ofUser` reads beside the user: whether every user of it is an admin, as a local backend's every user is */
export type DeploymentT = { everyoneAdmin: boolean }

/**
 * Whether `user` is signed in with Google: not anonymous. The one predicate for it, which sealing
 * (`isSealed`, through the actor's `anonymous`), the admin flag (`ofUser`) and the command line's
 * grants all ask. A Google sign-in is the only write that makes an anonymous user no longer so
 * (`userForSignIn`); a test backend's `testing:vouchFor` stands in for it.
 *
 * @example Actor.isSignedInWithGoogle({ isAnonymous: false })  // => true
 * @example Actor.isSignedInWithGoogle({ isAnonymous: true })   // => false
 */
export function isSignedInWithGoogle(user: Pick<UserRowT, 'isAnonymous'>): boolean {
  return ! User.isAnonymous(user)
}

/**
 * The actor of a request whose user is `user`: unlabelled until it holds a userlabel, and then the
 * user, with its userlabel and title. **The one place the `admin` flag is read**: a user is an
 * admin where its row says so and it is signed in with Google (an anonymous user's flag counts for
 * nothing), or where the deployment makes everyone one (a local backend:
 * `TRIQUET_EVERYONE_ADMIN`, which production never has).
 *
 * @param user_id - The user's row id.
 * @param user - Its row.
 * @param deployment - What the deployment says beside it.
 *
 * @example Actor.ofUser(user_id, { userlabel: 'flip_kromer', title: 'Flip', isAnonymous: true }, { everyoneAdmin: false })  // => { kind: 'user', user_id, userlabel: 'flip_kromer', usertitle: 'Flip', admin: false, anonymous: true }
 * @example Actor.ofUser(user_id, { userlabel: 'flip_kromer', title: 'Flip', admin: true, isAnonymous: true }, { everyoneAdmin: false })  // => { ..., admin: false, anonymous: true }
 * @example Actor.ofUser(user_id, { isAnonymous: true }, { everyoneAdmin: true })  // => Actor.unlabelled
 */
export function ofUser(user_id: Id<'users'>, user: Pick<UserRowT, 'userlabel' | 'title' | 'admin' | 'isAnonymous'>, deployment: DeploymentT): ActorT {
  const { userlabel } = user
  if (userlabel === undefined) { return unlabelled }
  return {
    kind:      'user',
    user_id,
    userlabel,
    usertitle: user.title ?? userlabel,
    admin:     (user.admin === true && isSignedInWithGoogle(user)) || deployment.everyoneAdmin,
    anonymous: user.isAnonymous === true,
  }
}

/**
 * Whether `actor`'s user holds no userlabel: a request with no session, or one whose user has not
 * yet chosen one.
 *
 * @example if (Actor.isUnlabelled(ctx.actor)) { return null }
 */
export function isUnlabelled(actor: ActorT): actor is UnlabelledActorT {
  return actor.kind === 'unlabelled'
}

/**
 * Whether `actor` is sealed: a user signed in with no proof (`anonymous`), who may hold a
 * userlabel and its one sandbox, and nothing more -- never on another hunt, never adding anyone to
 * its own, never reviewing. Every sealing policy asks here (`Approve`). An unlabelled actor is not
 * sealed: it is refused for having no userlabel first.
 *
 * @example Actor.isSealed(actor)  // => true, for an anonymous user
 */
export function isSealed(actor: ActorT): actor is UserActorT & { anonymous: true } {
  return actor.kind === 'user' && actor.anonymous
}

/**
 * Whether `actor` is an admin: one who looks after what belongs to no hunt, the library of widgets
 * every hunt shares. Every policy that turns on it asks here (`Approve.mayChangeLibrary`). Decided
 * on the server as it builds the actor (`ofUser`), and carried on it to the browser, whose offers
 * follow it.
 *
 * @example Actor.isAdmin(actor)  // => true, for a user whose row says so
 */
export function isAdmin(actor: UserActorT): boolean {
  return actor.admin
}

/** An actor's place on one hunt: a smith or reviewer there, by its huntship, or a stranger to it */
export const HuntStandingVals = ['smith', 'reviewer', 'stranger'] as const
export type HuntStanding = typeof HuntStandingVals[number]

/**
 * What the server has verified of an actor on one hunt, and what a policy decides from: who they
 * are, which hunt, and their standing there. An actor without a userlabel is a stranger to every
 * hunt.
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

/** A user named by an action: by its id, or by its userlabel */
export type UserRefT = { user_id: Id<'users'> } | { userlabel: string }

/**
 * The claims of `actor` on `hunt_id`, from its huntship there.
 *
 * @param actor - Who is asking.
 * @param hunt_id - Which hunt.
 * @param huntship - The actor's huntship on it; null when it has none, as for an actor without a userlabel.
 *
 * @example Actor.claimsOn(actor, hunt_id, { role: 'reviewer' })   // => { ...actor, hunt_id, standing: 'reviewer' }
 * @example Actor.claimsOn(Actor.unlabelled, hunt_id, null)        // => { kind: 'unlabelled', hunt_id, standing: 'stranger' }
 */
export function claimsOn(actor: ActorT, hunt_id: Id<'hunts'>, huntship: { role: HuntRole } | null): HuntClaimsT {
  return { ...actor, hunt_id, standing: huntship?.role ?? 'stranger' }
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
 * Whether `target` names the user `actor` is, by id or by userlabel. Nobody is an actor without a
 * userlabel.
 *
 * @example Actor.isOneself(actor, { userlabel: actor.userlabel })  // => true
 * @example Actor.isOneself(actor, { user_id: someone_else_id })     // => false
 */
export function isOneself(actor: ActorT, target: UserRefT): boolean {
  if (isUnlabelled(actor)) { return false }
  if ('user_id' in target) { return target.user_id === actor.user_id }
  return target.userlabel === actor.userlabel
}
