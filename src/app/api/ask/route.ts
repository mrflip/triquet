import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import * as Z from 'zod'
import { AskContract, type AskReplyT, type AskRequestT } from '../../../lib/ask/contract'
import { bulkItemsBlock } from '../../../lib/ask/prompts'
import { MaxTokensForJob, ModelForTier } from '../../../lib/ask/models'
import { appDb } from '../../../db/client'
import { playerFor, promptFor } from '../../../db/players'
import { approxTokensFor } from '../../../lib/ask/tokens'
import { failurekindFor } from '../../../lib/ask/failures'
import { vetReply } from '../../../lib/ask/replies'
import { IshValidators } from '../../../models/ish'
import type { PlayerT } from '../../../models/player'

/** The shape every single-text ish job constrains the model's answer to */
const IshItemsFormat = Z.object({ items: Z.array(IshValidators.ishItemReply) })

/** The same, one group per tagged text, for the batched job */
const BulkGroupFormat = Z.object({ key: Z.string(), items: Z.array(IshValidators.ishItemReply) })
const BulkGroupsFormat = Z.object({ groups: Z.array(BulkGroupFormat) })

/**
 * The one place this tool reaches outside the browser.
 *
 * The key never leaves the server, so asking has to go through here; everything else in the
 * tool works with the network off. A failure is answered with a kind, never a stack trace and
 * never a bare status code, so the browser always has an author-shaped sentence to show.
 */
export async function POST(request: Request): Promise<Response> {
  const client = anthropicClient()
  if (! client) { return replied({ ok: false, failurekind: 'unavailable' }) }

  const parsed = AskContract.askRequest.safeParse(await request.json())
  if (! parsed.success) { return replied({ ok: false, failurekind: 'unreadable' }, 400) }

  try {
    return replied(vetReply(await answerAsk(client, parsed.data)))
  } catch (err) {
    return replied({ ok: false, failurekind: failurekindFor(err) })
  }
}

/** Whichever job was asked for, answered by the player whose job it is */
async function answerAsk(client: Anthropic, ask: AskRequestT): Promise<AskReplyT> {
  const db = await appDb()
  switch (ask.job) {
  case 'guess': {
    return await answerGuess(client, await playerFor(db, 'dumdum'), ask.clueing)
  }
  case 'ishes': {
    const numnum = await playerFor(db, 'numnum')
    const prompt = promptFor(numnum, ask.textkind, { [ask.textkind]: ask.text })
    const outcome = await extract(client, numnum, prompt, IshItemsFormat, numnum.max_tokens)
    if (! outcome.ok) { return outcome }
    return {
      ok: true, job: 'ishes', items: outcome.parsed.items, truncated: outcome.truncated,
      model_tier_applied: numnum.model_tier, approx_tokens: approxTokensFor(prompt, outcome.raw),
    }
  }
  case 'bulk_ishes': {
    const numnum = await playerFor(db, 'numnum')
    const prompt = promptFor(numnum, 'bulk', { items: bulkItemsBlock(ask.items) })
    const outcome = await extract(client, numnum, prompt, BulkGroupsFormat, MaxTokensForJob.bulk_ishes)
    if (! outcome.ok) { return outcome }
    return {
      ok: true, job: 'bulk_ishes', groups: outcome.parsed.groups, truncated: outcome.truncated,
      model_tier_applied: numnum.model_tier, approx_tokens: approxTokensFor(prompt, outcome.raw),
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

/**
 * The SDK client, or null when this deployment has no credentials.
 *
 * A tool with no key is not broken -- it is a tool whose asking half is unavailable, and the
 * whole rest of the page must keep working. Doppler supplies the key; nothing is read from a
 * file in the repo.
 */
function anthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  return apiKey ? new Anthropic({ apiKey }) : null
}

/** One reply, validated on the way out as well as on the way in */
function replied(reply: AskReplyT, status = 200): Response {
  return Response.json(AskContract.askReply(reply), { status })
}
