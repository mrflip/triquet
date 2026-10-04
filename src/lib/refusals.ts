import * as Z from 'zod'
import { ConvexError, type Value } from 'convex/values'
import { NotApprovedError } from './approve'
import { AppNotices, RefusalNotices, type Refusalkind } from './notices'
import { explain } from './vv/reporting'

/**
 * Why the server refused a change, as a refused function's `ConvexError` carries it: which kind of
 * refusal, and the sentence to show the author. A refusal for something invalid carries its Zod
 * issues too.
 */
export type RefusalT =
  | { failurekind: Refusalkind, message: string }
  | { failurekind: 'invalid', message: string, ZodError: Value[] }

/** A refusal's data, checked, for reading one back out of an error of unknown shape */
const RefusalShape = Z.object({ failurekind: Z.string(), message: Z.string() })

/** The data convex-helpers gives an argument its Zod schema refused */
const ArgIssueShape   = Z.object({ message: Z.string() })
const ArgRefusalShape = Z.object({ ZodError: Z.array(ArgIssueShape).min(1) })

/**
 * Refuse the change in hand: throws the `ConvexError` a caller reads as a notice, and the
 * mutation writes nothing.
 *
 * @param failurekind - Why.
 * @param message - The sentence to show, when it says more than the refusal's own (`RefusalNotices`).
 * @throws Always.
 *
 * @example if (rows.quiz.locked) { refuse('quizLocked') }
 * @example refuse('identUnknown', identUnknownNotice(ident_label))
 */
export function refuse(failurekind: Refusalkind, message: string = RefusalNotices[failurekind]): never {
  throw new ConvexError<RefusalT>({ failurekind, message })
}

/**
 * `err` as a refusal when it is a policy's denial (`Approve.NotApprovedError`), or Zod's: a request
 * the policy turned away, or a row the change would come to that its validator refuses, is the
 * author's to hear about, not a server error. Anything else is handed back as it was.
 *
 * @param err - Whatever a handler threw.
 * @returns A `ConvexError` for a denial or a Zod error; `err` itself otherwise.
 *
 * @example catch (err) { throw refusalFor(err) }
 */
export function refusalFor(err: unknown): unknown {
  if (err instanceof NotApprovedError) { return new ConvexError<RefusalT>({ failurekind: err.denial, message: err.message }) }
  if (! (err instanceof Z.ZodError)) { return err }
  const issues = err.issues.map(({ code, path, message }) => ({ code, message, path: path.map((seg) => (typeof seg === 'number' ? seg : String(seg))) }))
  return new ConvexError<RefusalT>({ failurekind: 'invalid', message: explain(err), ZodError: issues })
}

/**
 * Run `handler`, turning a denial or a Zod error it throws into a refusal: see `refusalFor`.
 *
 * @example handler: async (ctx, args) => await refusingInvalid(async () => await perform(ctx.db, args))
 */
export async function refusingInvalid<TT>(handler: () => Promise<TT>): Promise<TT> {
  try {
    return await handler()
  } catch (err) {
    throw refusalFor(err)
  }
}

/**
 * Why a Convex function call was refused, for a caller that answers one refusal differently from
 * the rest: the refusal's `failurekind` (`invalid` for something invalid), or null for anything
 * that is not a refusal.
 *
 * @example if (failurekindOf(err) === 'labelTaken') { ... try another label }
 */
export function failurekindOf(err: unknown): string | null {
  if (! (err instanceof ConvexError)) { return null }
  const refusal = RefusalShape.safeParse(err.data)
  return refusal.success ? refusal.data.failurekind : null
}

/**
 * The sentence to show the author for an error a Convex function call failed with: a refusal's
 * own message, the first refused argument's, or, for anything the server did not mean to say,
 * that nothing was altered.
 *
 * @param err - Whatever the call rejected with.
 * @returns A sentence.
 *
 * @example noticeOf(err)  // => 'This quiz is locked — unlock it to change it.'
 */
export function noticeOf(err: unknown): string {
  if (! (err instanceof ConvexError)) { return AppNotices.changeFailed }
  const refusal = RefusalShape.safeParse(err.data)
  if (refusal.success) { return refusal.data.message }
  const argRefusal = ArgRefusalShape.safeParse(err.data)
  return argRefusal.success ? argRefusal.data.ZodError.map((issue) => issue.message).join(';; ') : AppNotices.changeFailed
}
