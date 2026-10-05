import type * as Z from 'zod'
import * as UU from '../useful'
import * as PA from '../vv/patterns'
import { Validator } from '../validator'
import { AskValidators } from '../../models/ask'
import { WidgetValidators } from '../../models/widget'
import type { AskFailurekind } from '../notices'

/** Every reason an ask can fail, named so the browser can pick the author's sentence */
export const AskFailurekindVals = [
  'notPermitted', 'rateLimited', 'declined', 'emptyAnswer', 'unreadable', 'cutShort',
  'accountOff', 'sessionExpired', 'connection', 'unknown', 'unavailable',
] as const satisfies readonly AskFailurekind[]

export const AskContract = Validator(({ obj, oneof, str, uint, bool, lit, union, rec, zod }) => {
  const failurekind = oneof(AskFailurekindVals)

  const prompt = str.min(1).max(PA.Promptish.max).regex(PA.Promptish.re, PA.Promptish.msg)
    .describe('The prompt as it is put to the model: a widget\'s template, already filled in by the browser from its input.')

  const askRequest = obj({ prompt, ...WidgetValidators.aibotConfig.shape })
    .describe('What the browser is asking the model: a rendered prompt, the service it goes to, the tier of model, and how much room it has to answer. Validated on the way in, because this is the one place in the tool where data crosses a process boundary.')

  const failureDetail = obj({
    name:    str.max(120).optional(),
    status:  uint.min(PA.Httpstatus.min).max(PA.Httpstatus.max).optional(),
    message: str.max(600).optional(),
  })
    .describe('What the SDK or the runtime said, kept so the author can read what really happened; never anything from the request, and so never a credential.')

  const askFailed = obj({ ok: lit(false), failurekind, detail: failureDetail.optional() })

  const answer = rec(str, zod.json())
    .refine((val) => UU.jsonify(val).length <= PA.WidgetedJson.max, PA.WidgetedJson.msg)
    .describe('The JSON object the model answered with, vetted on the server before it was sent: what the cell keeps as its value.')

  const askDone = obj({
    ok:                 lit(true),
    value:              answer,
    truncated:          bool,
    model_tier_applied: AskValidators.model_tier,
    approx_tokens:      uint.max(PA.Quantity.max),
  })

  const askReply = union([askDone, askFailed])
    .describe('What came back. A failure names a kind rather than carrying a sentence, so the wording stays in one place on the browser side.')

  return { failurekind, prompt, askRequest, askReply, askDone, askFailed }
})

export type AskRequestDNA = Z.input<typeof AskContract.askRequest>
export type AskRequestT   = Z.output<typeof AskContract.askRequest>
export type AskReplyT     = Z.output<typeof AskContract.askReply>
export type AskDoneT      = Z.output<typeof AskContract.askDone>
export type AskFailedT    = Z.output<typeof AskContract.askFailed>

/** Where the browser sends an ask */
export const AskRoutepath = '/api/ask'
