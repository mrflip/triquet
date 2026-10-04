import type { Id } from '../../convex/_generated/dataModel'

/** Who a request is from, before they have asserted a username, signed in or not */
export type AnonymousActorT = { kind: 'anonymous' }

/** Who a request is from, once their session has asserted a username: the session's user, and the ident it took on last */
export type IdentActorT = {
  kind:        'ident'
  user_id:     Id<'users'>
  ident_id:    Id<'idents'>
  ident_label: string
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
 *
 * @example Actor.asIdent(user_id, { _id: ident_id, label: 'flip_kromer' })  // => { kind: 'ident', user_id, ident_id, ident_label: 'flip_kromer' }
 */
export function asIdent(user_id: Id<'users'>, ident: { _id: Id<'idents'>, label: string }): IdentActorT {
  return { kind: 'ident', user_id, ident_id: ident._id, ident_label: ident.label }
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
