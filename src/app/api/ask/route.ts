import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type * as Z from 'zod'
import { AskContract, type AskReplyT, type AskRequestT } from '../../../lib/ask/contract'
import { renderPrompt } from '../../../lib/ask/prompts'
import { ModelForTier } from '../../../lib/ask/models'
import * as Approval from '../../../lib/approval'
import * as Credentials from '../../../lib/credentials'
import * as Postmortem from '../../../lib/postmortem'
import { seededWidgetFor } from '../../../lib/ask/bots'
import { approxTokensFor } from '../../../lib/ask/tokens'
import { failureReplyFor } from '../../../lib/ask/failures'
import { vetReply } from '../../../lib/ask/replies'
import { ValidatorKit } from '../../../lib/validator'
import { IshValidators } from '../../../models/ish'
import type { AibotWidgetT } from '../../../models/widget'
import type { ModelTier } from '../../../models/ask'

const { obj, arr } = ValidatorKit

/** The shape every ish job constrains the model's answer to */
const IshItemsFormat = obj({ items: arr(IshValidators.ishItemReply) })

/**
 * The one place this tool reaches outside the browser.
 *
 * The key never leaves the server, so asking has to go through here; everything else in the
 * tool works with the network off. A failure is answered with a kind, never a stack trace and
 * never a bare status code, so the browser always has an author-shaped sentence to show; the
 * stack goes to the server's log instead, unless the failure is only asking being switched off.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = AskContract.askRequest.safeParse(await request.json())
  if (! parsed.success) { return replied({ ok: false, failurekind: 'unreadable' }, 400) }

  try {
    const widget = seededWidgetFor(parsed.data)
    Approval.need(null, { act: 'anthropic_bot' }, { job: parsed.data.job })
    if (! Credentials.has(widget.config.servicelabel)) { return replied({ ok: false, failurekind: 'unavailable' }) }
    const client = new Anthropic({ apiKey: Credentials.get(widget.config.servicelabel) })
    return replied(vetReply(await answerAsk(client, widget, parsed.data)))
  } catch (err) {
    const failed = failureReplyFor(err)
    if (failed.failurekind !== 'notPermitted') { Postmortem.report(`answer a ${parsed.data.job} ask`, err, { failurekind: failed.failurekind }) }
    return replied(failed)
  }
}

/** Whichever job was asked for, answered by the seeded widget it was put as */
async function answerAsk(client: Anthropic, widget: AibotWidgetT, ask: AskRequestT): Promise<AskReplyT> {
  const { model_tier, max_tokens } = widget.config
  switch (ask.job) {
  case 'guess': {
    return await answerGuess(client, widget, ask.clueing)
  }
  case 'ishes': {
    const prompt = renderPrompt(widget.formula, { [ask.textkind]: ask.text })
    const outcome = await extract(client, model_tier, prompt, IshItemsFormat, max_tokens)
    if (! outcome.ok) { return outcome }
    return {
      ok: true, job: 'ishes', items: outcome.parsed.items, truncated: outcome.truncated,
      model_tier_applied: model_tier, approx_tokens: approxTokensFor(prompt, outcome.raw),
    }
  }
  }
}

/** Dumdum's hasty first-instinct read, with no thinking to slow it down */
async function answerGuess(client: Anthropic, dumdum: AibotWidgetT, clueing: string): Promise<AskReplyT> {
  const prompt = renderPrompt(dumdum.formula, { clueing })
  const { model_tier, max_tokens } = dumdum.config
  const answer = await client.messages.create({
    model:      ModelForTier[model_tier],
    max_tokens,
    messages:   [{ role: 'user', content: prompt }],
  })
  if (answer.stop_reason === 'refusal') { return { ok: false, failurekind: 'declined' } }
  const text = textOf(answer.content)
  if (text.trim() === '') { return { ok: false, failurekind: 'emptyAnswer' } }
  return {
    ok: true, job: 'guess', text,
    truncated:          answer.stop_reason === 'max_tokens',
    model_tier_applied: model_tier,
    approx_tokens:      approxTokensFor(prompt, text),
  }
}

type Extracted<SC extends Z.ZodType> =
  | { ok: true, parsed: Z.output<SC>, raw: string, truncated: boolean }
  | { ok: false, failurekind: 'declined' | 'unreadable' }

/**
 * One structured extraction from the model of `model_tier`, or the reason there was not one.
 *
 * Streamed, then gathered: the SDK refuses to send an unstreamed ask with room for a long answer,
 * and streaming costs nothing here.
 */
async function extract<SC extends Z.ZodType>(client: Anthropic, model_tier: ModelTier, prompt: string, format: SC, max_tokens: number): Promise<Extracted<SC>> {
  const answer = await client.messages.stream({
    model: ModelForTier[model_tier],
    max_tokens,
    messages:      [{ role: 'user', content: prompt }],
    output_config: { format: zodOutputFormat(format) },
  }).finalMessage()
  if (answer.stop_reason === 'refusal') { return { ok: false, failurekind: 'declined' } }
  // The model answered, but not in the shape the format asked for.
  const { parsed_output } = answer
  if (! parsed_output) {
    console.warn('Triquet: a model answer did not fit the format asked for', { stop_reason: answer.stop_reason, text: textOf(answer.content).slice(0, 600) })
    return { ok: false, failurekind: 'unreadable' }
  }
  return { ok: true, parsed: parsed_output, raw: textOf(answer.content), truncated: answer.stop_reason === 'max_tokens' }
}

/** Every text block of an answer, run together */
function textOf(content: readonly { type: string }[]): string {
  return content
    .filter((block): block is { type: 'text', text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

/** One reply, validated on the way out as well as on the way in */
function replied(reply: AskReplyT, status = 200): Response {
  return Response.json(AskContract.askReply(reply), { status })
}
