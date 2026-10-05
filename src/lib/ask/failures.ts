import Anthropic from '@anthropic-ai/sdk'
import type { AskFailedT } from './contract'
import type { AskFailurekind } from '../notices'
import * as Approve from '../approve'

/**
 * Why an ask failed, as a kind rather than as a sentence.
 *
 * The wording lives in `lib/notices` on the browser side; this only has to decide which of the
 * author's sentences fits. Anything it cannot place is `unknown`, which is honest -- better than
 * guessing at a cause and telling the author something untrue.
 *
 * @param err - Whatever the SDK or the runtime threw.
 * @returns The failure kind to send back.
 *
 * @example failurekindFor(new Anthropic.RateLimitError(...))  // => 'rateLimited'
 */
export function failurekindFor(err: unknown): AskFailurekind {
  if (err instanceof Approve.NotApprovedError) { return 'notPermitted' }
  if (err instanceof Anthropic.AuthenticationError) { return 'sessionExpired' }
  if (err instanceof Anthropic.PermissionDeniedError) { return 'accountOff' }
  if (err instanceof Anthropic.RateLimitError) { return 'rateLimited' }
  if (err instanceof Anthropic.APIConnectionError) { return 'connection' }
  if (err instanceof Anthropic.APIError) { return 'unknown' }
  return 'unknown'
}

/**
 * A failed reply for `err`: its kind, and what it said.
 *
 * @param err - Whatever the SDK or the runtime threw.
 * @returns The reply to send back.
 *
 * @example failureReplyFor(new Error('boom'))  // => { ok: false, failurekind: 'unknown', detail: { name: 'Error', message: 'boom' } }
 */
export function failureReplyFor(err: unknown): AskFailedT {
  const thrown = err instanceof Error ? err : null
  const status = err instanceof Anthropic.APIError && typeof err.status === 'number' && err.status >= 0 ? err.status : undefined
  return {
    ok:          false,
    failurekind: failurekindFor(err),
    detail:      {
      ...(thrown && { name: thrown.name.slice(0, 120), message: thrown.message.slice(0, 600) }),
      ...(status !== undefined && { status }),
    },
  }
}
