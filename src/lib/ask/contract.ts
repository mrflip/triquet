import * as Z from 'zod'
import { Validator } from '../validator'
import { IshValidators } from '../../models/ish'
import { AskValidators } from '../../models/ask'
import type { AskFailurekind } from '../notices'

/** Which text an extraction is about; picks the prompt and the placeholder */
export const TextkindVals = ['clueing', 'hint'] as const
export type Textkind = typeof TextkindVals[number]

/** Every reason an ask can fail, named so the browser can pick the author's sentence */
export const AskFailurekindVals = [
  'notPermitted', 'rateLimited', 'declined', 'emptyAnswer', 'unreadable',
  'accountOff', 'sessionExpired', 'connection', 'unknown', 'unavailable',
] as const satisfies readonly AskFailurekind[]

export const AskContract = Validator(({ obj, arr, oneof, str, textish, uint, bool, lit, discrim, union }) => {
  const textkind    = oneof(TextkindVals)
  const failurekind = oneof(AskFailurekindVals)
  const askable     = textish.min(1)

  const guessAsk = obj({ job: lit('guess'), clueing: askable })
  const ishesAsk = obj({ job: lit('ishes'), textkind, text: askable })
  const askRequest = discrim('job', [guessAsk, ishesAsk])
    .describe('What the browser is asking the model for. Validated on the way in, because this is the one place in the tool where data crosses a process boundary.')

  const failureDetail = obj({
    name:    str.max(120).optional(),
    status:  uint.optional(),
    message: str.max(600).optional(),
  })
    .describe('What the SDK or the runtime said, kept so the author can read what really happened; never anything from the request, and so never a credential.')

  const askFailed = obj({ ok: lit(false), failurekind, detail: failureDetail.optional() })

  const guessDone = obj({
    ok:                 lit(true),
    job:                lit('guess'),
    text:               textish,
    truncated:          bool,
    model_tier_applied: AskValidators.model_tier,
    approx_tokens:      uint,
  })

  const ishesDone = obj({
    ok:                 lit(true),
    job:                lit('ishes'),
    items:              arr(IshValidators.ishItem),
    truncated:          bool,
    model_tier_applied: AskValidators.model_tier,
    approx_tokens:      uint,
  })

  const askReply = union([guessDone, ishesDone, askFailed])
    .describe('What came back. A failure names a kind rather than carrying a sentence, so the wording stays in one place on the browser side.')

  return { textkind, failurekind, askRequest, askReply, guessDone, ishesDone, askFailed }
})

export type AskRequestDNA = Z.input<typeof AskContract.askRequest>
export type AskRequestT   = Z.output<typeof AskContract.askRequest>
export type AskReplyT     = Z.output<typeof AskContract.askReply>
export type GuessReplyT   = Z.output<typeof AskContract.guessDone>
export type IshesReplyT   = Z.output<typeof AskContract.ishesDone>
export type AskFailedT    = Z.output<typeof AskContract.askFailed>

/** Where the browser sends an ask */
export const AskRoutepath = '/api/ask'
