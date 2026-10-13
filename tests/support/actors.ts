import type { Id } from '../../convex/_generated/dataModel'
import * as Labelmaker from '../../src/lib/labelmaker'
import type * as Actor from '../../src/lib/actor'

/** What else an actor `userActor` builds says of its user: whether it is an admin, and whether it is anonymous; neither, unless said */
export type UserActorOpts = { admin?: boolean, anonymous?: boolean }

/**
 * The actor of a request from the user `user_id`, holding the userlabel `userlabel`, as the server
 * builds one (`Actor.ofUser`), for a test of a policy or a view that is handed one: titled with
 * its userlabel titleized, an admin or not, anonymous or not, as `opts` says.
 *
 * @example userActor(user_id, 'alice_smiths', { admin: true })  // => { kind: 'user', user_id, userlabel: 'alice_smiths', usertitle: 'Alice Smiths', admin: true, anonymous: false }
 */
export function userActor(user_id: Id<'users'>, userlabel: string, { admin = false, anonymous = false }: UserActorOpts = {}): Actor.UserActorT {
  return { kind: 'user', user_id, userlabel, usertitle: Labelmaker.titleize(userlabel), admin, anonymous }
}
