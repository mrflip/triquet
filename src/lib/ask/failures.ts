import Anthropic from '@anthropic-ai/sdk'
import type { AskFailurekind } from '../notices'

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
  if (err instanceof Anthropic.AuthenticationError) { return 'sessionExpired' }
  if (err instanceof Anthropic.PermissionDeniedError) { return 'accountOff' }
  if (err instanceof Anthropic.RateLimitError) { return 'rateLimited' }
  if (err instanceof Anthropic.APIConnectionError) { return 'connection' }
  if (err instanceof Anthropic.APIError) { return 'unknown' }
  return 'unknown'
}
