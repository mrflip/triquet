import { getAuthSessionId, getAuthUserId } from '@convex-dev/auth/server'
import type { Auth } from 'convex/server'
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4'
import type * as Z from 'zod'
import type { Id } from './_generated/dataModel'
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import * as Actor from '../src/lib/actor'
import * as Approve from '../src/lib/approve'
import { refusingInvalid } from '../src/lib/refusals'
import { installErrorMap } from '../src/lib/vv/reporting'
import { libraryWriter, scopedReader, scopedWriter, type ScopeClaimsT } from './policy_rules'
import { censusOf, identFor, type CensusT, type Reader } from './reading'
import { triggers } from './stamping'

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

/** Our Zod error map, put in place before a function's arguments are parsed, so a refusal reads in our words; and who is asking (`askerOf`) added to `ctx` */
const Asking = {
  args:  {},
  input: async (ctx: { auth: Auth, db: Reader }) => {
    installErrorMap()
    return { ctx: await askerOf(ctx), args: {} }
  },
}

/** As `Asking`, with a database that runs the triggers (`stamping.ts`: every row written is stamped) */
const AskingToWrite = {
  args:  {},
  input: async (ctx: MutationCtx) => {
    installErrorMap()
    return { ctx: { ...await askerOf(ctx), db: triggers.wrapDB(ctx).db }, args: {} }
  },
}

/** Our Zod error map alone, for an internal mutation, which nobody asks; with a database that runs the triggers */
const InOurWordsToWrite = {
  args:  {},
  input: (ctx: MutationCtx) => {
    installErrorMap()
    return { ctx: { db: triggers.wrapDB(ctx).db }, args: {} }
  },
}

/**
 * The builders every public function here is made with: Convex's own, taking Zod schemas as
 * `args` (and `returns`), parsed in full before the handler runs, with who is asking on `ctx`
 * (`ctx.actor`, `ctx.user_id`: see `AskerT`). A refused argument reaches the caller as a
 * `ConvexError` whose data is `{ ZodError: [issue, ...] }`, in our words. A mutation's database,
 * internal or public, runs the triggers, which stamp every row written (`stamping.ts`); so every
 * mutation of the app is made here, and nowhere else imports Convex's own `mutation` or
 * `internalMutation` (`eslint.config.mjs`), but the migrations, whose backfills write raw. An
 * internal function has nobody asking.
 *
 * @example export const open = zQuery({ args: { quiz_id: zid('quizzes') }, handler: async (ctx, { quiz_id }) => ... ctx.actor ... })
 */
export const zQuery            = zCustomQuery(query, Asking)
export const zMutation         = zCustomMutation(mutation, AskingToWrite)
export const zInternalMutation = zCustomMutation(internalMutation, InOurWordsToWrite)

// --- A hunt's functions

/** A query's context as `zQuery` hands it on: Convex's own, and who is asking */
export type AskingQueryCtx = QueryCtx & AskerT

/** A mutation's context as `zMutation` hands it on: Convex's own, and who is asking */
export type AskingMutationCtx = MutationCtx & AskerT

/** A hunt's query's context: its `db` sees only the hunt (`policy_rules.ts`), and `claims` are what was checked to get there */
export type HuntQueryCtx<CT extends ScopeClaimsT> = AskingQueryCtx & { claims: CT }

/** A hunt's mutation's context: as a hunt's query's, its `db` writing only the hunt, and `census` for what spans every hunt (`reading.ts`) */
export type HuntMutationCtx<CT extends ScopeClaimsT> = AskingMutationCtx & { claims: CT, census: CensusT }

/** A function's arguments, as Zod schemas by name */
type ZodFieldsT = Record<string, Z.ZodType>

/** Those arguments, parsed */
type ArgsOfT<AV extends ZodFieldsT> = Z.output<Z.ZodObject<AV>>

/** What a scoped builder holds a function's database to: one hunt, or the library */
export type ScopeT = 'hunt' | 'library'

/** The public functions built by a scoped builder, and what each one's database is scoped to */
const Scoped = new WeakMap<object, ScopeT>()

/** `fn`, remembered as built by a builder scoping its database to `scope` */
function scopedTo<FT extends object>(scope: ScopeT, fn: FT): FT {
  Scoped.set(fn, scope)
  return fn
}

/**
 * What `fn`'s database is scoped to: one hunt, for a function built by a hunt's builder
 * (`zHuntQuery`, `zHuntMutation`); the library, for one built by `zLibraryMutation`; null for any
 * other, which holds the whole database. Every public function is scoped, or is named in
 * `Unscoped` (`authorize.ts`) with why it is not.
 *
 * @example scopeOf(whole)    // => 'hunt', for `hunts.whole`
 * @example scopeOf(library)  // => null, for `widgets.library`
 */
export function scopeOf(fn: unknown): ScopeT | null {
  if (typeof fn !== 'function') { return null }
  return Scoped.get(fn) ?? null
}

/**
 * The builder of a query about one hunt. Its `affirm` checks what the browser affirms and hands
 * back the claims (an `affirm…` of `authorize.ts`, given the plain database); its `handler` runs
 * on those claims (`ctx.claims`) with a database that sees only their hunt (`ctx.db`: see
 * `ReadingRules`). A denial, from `affirm` or anywhere after, answers `empty`, the facet's empty
 * value (`emptyIfDenied`).
 *
 * @example
 *   export const open = zHuntQuery({
 *     args:    { affirms: ActionValidators.quizAffirms },
 *     empty:   null,
 *     affirm:  async (ctx, { affirms }) => await affirmReadHunt(ctx.db, affirms, ctx.actor),
 *     handler: async (ctx) => ctx.claims.quiz && await layoutOf(ctx.db, ctx.claims.quiz),
 *   })
 */
export function zHuntQuery<AV extends ZodFieldsT, CT extends ScopeClaimsT, RT, ET>(def: {
  args:    AV
  empty:   ET
  affirm:  (ctx: AskingQueryCtx, args: ArgsOfT<AV>) => Promise<CT>
  handler: (ctx: HuntQueryCtx<CT>, args: ArgsOfT<AV>) => Promise<RT>
}) {
  const { args, empty, affirm, handler } = def
  return scopedTo('hunt', zQuery({
    args,
    handler: async (ctx, parsed): Promise<RT | ET> => await emptyIfDenied(empty, async () => {
      const claims = await affirm(ctx, parsed as ArgsOfT<AV>)
      return await handler({ ...ctx, db: scopedReader(ctx.db, claims), claims }, parsed as ArgsOfT<AV>)
    }),
  }))
}

/**
 * The builder of a mutation about one hunt: as `zHuntQuery`, its `handler` writing through a
 * database that touches only the claims' hunt (`WritingRules`), and asking `ctx.census` what spans
 * every hunt. A denial, or a Zod error, is refused (`refusingInvalid`); nothing is written.
 *
 * @example
 *   export const perform = zHuntMutation({
 *     args:    { affirms: ActionValidators.affirms, action: ActionValidators.huntAction },
 *     returns: zod.null(),
 *     affirm:  async (ctx, { affirms, action }) => await affirmPerform(ctx.db, affirms, ctx.actor, action),
 *     handler: async (ctx, { action }) => { await perform(ctx.db, ctx.census, ctx.claims, action); return null },
 *   })
 */
export function zHuntMutation<AV extends ZodFieldsT, RV extends Z.ZodType, CT extends ScopeClaimsT>(def: {
  args:    AV
  returns: RV
  affirm:  (ctx: AskingMutationCtx, args: ArgsOfT<AV>) => Promise<CT>
  handler: (ctx: HuntMutationCtx<CT>, args: ArgsOfT<AV>) => Promise<Z.input<RV>>
}) {
  const { args, returns, affirm, handler } = def
  return scopedTo('hunt', zMutation({
    args,
    returns,
    // What `handler` returns is what `returns` takes in, which zMutation cannot see through `RV` until it is named.
    handler: async (ctx, parsed): Promise<never> => await refusingInvalid(async () => {
      const claims = await affirm(ctx, parsed as ArgsOfT<AV>)
      return await handler({ ...ctx, db: scopedWriter(ctx.db, claims), census: censusOf(ctx.db), claims }, parsed as ArgsOfT<AV>) as never
    }),
  }))
}

// --- The library's function

/** The library's mutation's context: its `db` sees and writes only the library (`LibraryRules`), and `census` says what spans every hunt */
export type LibraryMutationCtx = AskingMutationCtx & { census: CensusT }

/**
 * The builder of a mutation on the library of widgets, which belongs to no hunt. Its `affirm`
 * goes on only when the actor may take the action (an `affirm…` of `authorize.ts`); its `handler`
 * then writes through a database that reaches the library's widgets and nothing of any hunt
 * (`LibraryRules`), asking `ctx.census` whether a widget is worked anywhere. A denial, or a Zod
 * error, is refused (`refusingInvalid`); nothing is written.
 *
 * @example
 *   export const perform = zLibraryMutation({
 *     args:    { action: ActionValidators.libraryAction },
 *     returns: zod.null(),
 *     affirm:  (ctx, { action }) => { affirmLibraryAction(ctx.actor, action) },
 *     handler: async (ctx, { action }) => { await performLibrary(ctx.db, ctx.census, action); return null },
 *   })
 */
export function zLibraryMutation<AV extends ZodFieldsT, RV extends Z.ZodType>(def: {
  args:    AV
  returns: RV
  affirm:  (ctx: AskingMutationCtx, args: ArgsOfT<AV>) => void | Promise<void>
  handler: (ctx: LibraryMutationCtx, args: ArgsOfT<AV>) => Promise<Z.input<RV>>
}) {
  const { args, returns, affirm, handler } = def
  return scopedTo('library', zMutation({
    args,
    returns,
    // As in `zHuntMutation`: what `handler` returns is what `returns` takes in.
    handler: async (ctx, parsed): Promise<never> => await refusingInvalid(async () => {
      await affirm(ctx, parsed as ArgsOfT<AV>)
      return await handler({ ...ctx, db: libraryWriter(ctx.db, ctx.actor), census: censusOf(ctx.db) }, parsed as ArgsOfT<AV>) as never
    }),
  }))
}
