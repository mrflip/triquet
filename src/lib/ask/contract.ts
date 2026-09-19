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
  'accountOff', 'sessionExpired', 'connection', 'unknown', 'unavailable', 'missingFromRun',
] as const satisfies readonly AskFailurekind[]

export const AskContract = Validator(({ obj, arr, oneof, str, textish, uint, bool, lit, discrim, union }) => {
  const textkind    = oneof(TextkindVals)
  const failurekind = oneof(AskFailurekindVals)
  const askable     = textish.min(1)

  const guessAsk = obj({ job: lit('guess'), clueing: askable })
  const ishesAsk = obj({ job: lit('ishes'), textkind, text: askable })
  const bulkItem = obj({ key: str.min(1).max(80), text: askable })
  const bulkAsk  = obj({ job: lit('bulk_ishes'), items: arr(bulkItem).min(1).max(400) })
  const askRequest = discrim('job', [guessAsk, ishesAsk, bulkAsk])
    .describe('What the browser is asking the model for. Validated on the way in, because this is the one place in the tool where data crosses a process boundary.')

  const askFailed = obj({ ok: lit(false), failurekind })

  const guessDone = obj({
    ok:                 lit(true),
    job:                lit('guess'),
    text:               str,
    truncated:          bool,
    model_tier_applied: AskValidators.modelTier,
    approx_tokens:      uint,
  })

  const ishesDone = obj({
    ok:                 lit(true),
    job:                lit('ishes'),
    items:              arr(IshValidators.ishItem),
    truncated:          bool,
    model_tier_applied: AskValidators.modelTier,
    approx_tokens:      uint,
  })

  const bulkGroup = obj({ key: str.min(1), items: arr(IshValidators.ishItem) })
  const bulkDone = obj({
    ok:                 lit(true),
    job:                lit('bulk_ishes'),
    groups:             arr(bulkGroup),
    truncated:          bool,
    model_tier_applied: AskValidators.modelTier,
    approx_tokens:      uint,
    text_count:         uint,
  })

  const askReply = union([guessDone, ishesDone, bulkDone, askFailed])
    .describe('What came back. A failure names a kind rather than carrying a sentence, so the wording stays in one place on the browser side.')

  return { textkind, failurekind, askRequest, askReply, guessDone, ishesDone, bulkDone, askFailed }
})

export type AskRequestDNA = Z.input<typeof AskContract.askRequest>
export type AskRequestT   = Z.output<typeof AskContract.askRequest>
export type AskReplyT     = Z.output<typeof AskContract.askReply>
export type GuessReplyT   = Z.output<typeof AskContract.guessDone>
export type IshesReplyT   = Z.output<typeof AskContract.ishesDone>
export type BulkReplyT    = Z.output<typeof AskContract.bulkDone>
export type AskFailedT    = Z.output<typeof AskContract.askFailed>

/** Where the browser sends an ask */
export const AskRoutepath = '/api/ask'
