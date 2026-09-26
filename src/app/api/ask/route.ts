import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type * as Z from 'zod'
import { AskContract, type AskReplyT, type AskRequestT } from '../../../lib/ask/contract'
import { bulkItemsBlock } from '../../../lib/ask/prompts'
import { MaxTokensForJob, ModelForTier, PlayerForJob } from '../../../lib/ask/models'
import * as Credentials from '../../../lib/credentials'
import { playerFor, promptFor } from '../../../lib/ask/players'
import { approxTokensFor } from '../../../lib/ask/tokens'
import { failureReplyFor } from '../../../lib/ask/failures'
import { vetReply } from '../../../lib/ask/replies'
import { ValidatorKit } from '../../../lib/validator'
import { IshValidators } from '../../../models/ish'
import type { PlayerT } from '../../../models/player'

const { obj, arr, str } = ValidatorKit

/** The shape every single-text ish job constrains the model's answer to */
const IshItemsFormat = obj({ items: arr(IshValidators.ishItemReply) })

/** The same, one group per tagged text, for the batched job */
const BulkGroupFormat = obj({ key: str, items: arr(IshValidators.ishItemReply) })
const BulkGroupsFormat = obj({ groups: arr(BulkGroupFormat) })

/**
 * The one place this tool reaches outside the browser.
 *
 * The key never leaves the server, so asking has to go through here; everything else in the
 * tool works with the network off. A failure is answered with a kind, never a stack trace and
 * never a bare status code, so the browser always has an author-shaped sentence to show.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = AskContract.askRequest.safeParse(await request.json())
  if (! parsed.success) { return replied({ ok: false, failurekind: 'unreadable' }, 400) }

  try {
    const player = playerFor(PlayerForJob[parsed.data.job])
    if (! Credentials.has(player.servicelabel)) { return replied({ ok: false, failurekind: 'unavailable' }) }
    const client = new Anthropic({ apiKey: Credentials.get(player.servicelabel) })
    return replied(vetReply(await answerAsk(client, player, parsed.data)))
  } catch (err) {
    return replied(failureReplyFor(err))
  }
}

/** Whichever job was asked for, answered by the player it was put to */
async function answerAsk(client: Anthropic, player: PlayerT, ask: AskRequestT): Promise<AskReplyT> {
  switch (ask.job) {
  case 'guess': {
    return await answerGuess(client, player, ask.clueing)
  }
  case 'ishes': {
    const prompt = promptFor(player, ask.textkind, { [ask.textkind]: ask.text })
    const outcome = await extract(client, player, prompt, IshItemsFormat, player.max_tokens)
    if (! outcome.ok) { return outcome }
    return {
      ok: true, job: 'ishes', items: outcome.parsed.items, truncated: outcome.truncated,
      model_tier_applied: player.model_tier, approx_tokens: approxTokensFor(prompt, outcome.raw),
    }
  }
  case 'bulk_ishes': {
    const prompt = promptFor(player, 'bulk', { items: bulkItemsBlock(ask.items) })
    const outcome = await extract(client, player, prompt, BulkGroupsFormat, MaxTokensForJob.bulk_ishes)
    if (! outcome.ok) { return outcome }
    return {
      ok: true, job: 'bulk_ishes', groups: outcome.parsed.groups, truncated: outcome.truncated,
      model_tier_applied: player.model_tier, approx_tokens: approxTokensFor(prompt, outcome.raw),
      text_count: ask.items.length,
    }
  }
  }
}

/** Dumdum's hasty first-instinct read, with no thinking to slow it down */
async function answerGuess(client: Anthropic, dumdum: PlayerT, clueing: string): Promise<AskReplyT> {
  const prompt = promptFor(dumdum, 'clueing', { clueing })
  const answer = await client.messages.create({
    model:      ModelForTier[dumdum.model_tier],
    max_tokens: dumdum.max_tokens,
    messages:   [{ role: 'user', content: prompt }],
  })
  if (answer.stop_reason === 'refusal') { return { ok: false, failurekind: 'declined' } }
  const text = textOf(answer.content)
  if (text.trim() === '') { return { ok: false, failurekind: 'emptyAnswer' } }
  return {
    ok: true, job: 'guess', text,
    truncated:          answer.stop_reason === 'max_tokens',
    model_tier_applied: dumdum.model_tier,
    approx_tokens:      approxTokensFor(prompt, text),
  }
}

type Extracted<SC extends Z.ZodType> =
  | { ok: true, parsed: Z.output<SC>, raw: string, truncated: boolean }
  | { ok: false, failurekind: 'declined' | 'unreadable' }

/** One structured extraction from `player`, or the reason there was not one */
async function extract<SC extends Z.ZodType>(client: Anthropic, player: PlayerT, prompt: string, format: SC, max_tokens: number): Promise<Extracted<SC>> {
  const answer = await client.messages.parse({
    model: ModelForTier[player.model_tier],
    max_tokens,
    messages:      [{ role: 'user', content: prompt }],
    output_config: { format: zodOutputFormat(format) },
  })
  if (answer.stop_reason === 'refusal') { return { ok: false, failurekind: 'declined' } }
  // The model answered, but not in the shape the format asked for.
  const { parsed_output } = answer
  if (! parsed_output) { return { ok: false, failurekind: 'unreadable' } }
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
