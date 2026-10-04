import { getAuthSessionId, getAuthUserId } from '@convex-dev/auth/server'
import type { Auth } from 'convex/server'
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4'
import type { Id } from './_generated/dataModel'
import { internalMutation, mutation, query } from './_generated/server'
import * as Actor from '../src/lib/actor'
import * as Approve from '../src/lib/approve'
import { installErrorMap } from '../src/lib/vv/reporting'
import { identFor, type Reader } from './reading'

/**
 * Who is asking, as every public function's `ctx` carries it.
 *
 * * `actor` -- who the request is from: the ident its session asserted last, or `Actor.anonymous`.
 * * `user_id` -- the session's Convex Auth user; null for a request with no session, which may
 *   read nothing and write nothing, but needs no actor of its own to be told so.
 */
export type AskerT = { actor: Actor.ActorT, user_id: Id<'users'> | null }

/** A request with no session: no user, and nobody acting */
const NoSession: AskerT = Object.freeze({ actor: Actor.anonymous, user_id: null })

/**
 * Who is asking: the session the request's token names, if Convex Auth still holds it; its user;
 * and the ident that user asserted last. A token outliving its session (signed out, or the
 * backend emptied) is no session. One round of reads, made once per request by the builders
 * below; a builder layered over them calls this rather than reading identity a second way.
 *
 * @param ctx - A query's or mutation's context.
 * @returns The actor, and the session's user.
 *
 * @example const { actor, user_id } = await askerOf(ctx)
 */
export async function askerOf(ctx: { auth: Auth, db: Reader }): Promise<AskerT> {
  const [user_id, session_id] = await Promise.all([getAuthUserId(ctx), getAuthSessionId(ctx)])
  if (user_id === null || session_id === null) { return NoSession }
  const [session, ident] = await Promise.all([ctx.db.get('authSessions', session_id), identFor(ctx.db, user_id)])
  if (session === null) { return NoSession }
  return { user_id, actor: ident ? Actor.asIdent(user_id, ident) : Actor.anonymous }
}

/**
 * Run a query function's `read`, answering a denial with `empty`, the facet's empty value (`null`
 * or `[]`): a watch that throws takes the page down with it, and a reader turned away is owed
 * nothing more than what someone with nothing to see is shown. A denial is what the `affirm…`
 * functions throw (`Approve.NotApprovedError`: a stale or forged affirm, or a policy's no);
 * anything else is thrown on. A mutation refuses instead (`refusingInvalid`).
 *
 * @param empty - What the query answers when the reader is turned away.
 * @param read - The query's work, affirmations first.
 * @returns What `read` returned, or `empty`.
 *
 * @example handler: async (ctx, { affirms }) => await emptyIfDenied(null, async () => { const claims = await affirmReadHunt(ctx.db, affirms, ctx.actor); ... })
 */
export async function emptyIfDenied<TT, ET>(empty: ET, read: () => Promise<TT>): Promise<TT | ET> {
  try {
    return await read()
  } catch (err) {
    if (err instanceof Approve.NotApprovedError) { return empty }
    throw err
  }
}

/** Our Zod error map, put in place before a function's arguments are parsed, so a refusal reads in our words */
const InOurWords = {
  args:  {},
  input: () => {
    installErrorMap()
    return { ctx: {}, args: {} }
  },
}

/** As `InOurWords`, and who is asking (`askerOf`) added to `ctx` */
const Asking = {
  args:  {},
  input: async (ctx: { auth: Auth, db: Reader }) => {
    installErrorMap()
    return { ctx: await askerOf(ctx), args: {} }
  },
}

/**
 * The builders every public function here is made with: Convex's own, taking Zod schemas as
 * `args` (and `returns`), parsed in full before the handler runs, with who is asking on `ctx`
 * (`ctx.actor`, `ctx.user_id`: see `AskerT`). A refused argument reaches the caller as a
 * `ConvexError` whose data is `{ ZodError: [issue, ...] }`, in our words. An internal function
 * has nobody asking.
 *
 * @example export const open = zQuery({ args: { quiz_id: zid('quizzes') }, handler: async (ctx, { quiz_id }) => ... ctx.actor ... })
 */
export const zQuery            = zCustomQuery(query, Asking)
export const zMutation         = zCustomMutation(mutation, Asking)
export const zInternalMutation = zCustomMutation(internalMutation, InOurWords)
