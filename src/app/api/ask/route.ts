import Anthropic from '@anthropic-ai/sdk'
import { AskContract, type AskReplyT, type AskRequestT } from '../../../lib/ask/contract'
import { ModelForTier } from '../../../lib/ask/models'
import * as Approve from '../../../lib/approve'
import * as Credentials from '../../../lib/credentials'
import * as Postmortem from '../../../lib/postmortem'
import { approxTokensFor } from '../../../lib/ask/tokens'
import { failureReplyFor } from '../../../lib/ask/failures'
import { answerOf, vetReply } from '../../../lib/ask/replies'

/**
 * What the model is told beside every prompt: the route keeps an answer only as a JSON object,
 * and each prompt says in its own words which object it wants.
 */
const AnswerAsObject = 'Reply with a single JSON object and nothing else: no prose before or after it, and no code fence.'

/**
 * The one place this tool reaches outside the browser.
 *
 * The key never leaves the server, so asking has to go through here; everything else in the
 * tool works with the network off. The browser sends a prompt it has already filled in, the
 * service and tier to put it to, and the room to answer in; what comes back is the JSON object
 * the model answered with, vetted before the browser keeps it. A failure is answered with a
 * kind, never a stack trace and never a bare status code, so the browser always has an
 * author-shaped sentence to show; the stack goes to the server's log instead, unless the
 * failure is only asking being switched off.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return replied({ ok: false, failurekind: 'unreadable', detail: { name: 'SyntaxError', message: 'The request was not JSON.' } }, 400)
  }
  const parsed = AskContract.askRequest.safeParse(body)
  if (! parsed.success) { return replied({ ok: false, failurekind: 'unreadable' }, 400) }
  const ask = parsed.data

  try {
    Approve.must('ask_anthropic_bot', process.env.ENABLE_ANTHROPIC_BOT)
    if (! Credentials.has(ask.servicelabel)) { return replied({ ok: false, failurekind: 'unavailable' }) }
    const client = new Anthropic({ apiKey: Credentials.get(ask.servicelabel) })
    return replied(vetReply(await answerAsk(client, ask)))
  } catch (err) {
    const failed = failureReplyFor(err)
    if (failed.failurekind !== 'notPermitted') { Postmortem.report(`answer an ask of the ${ask.model_tier} tier`, err, { failurekind: failed.failurekind }) }
    return replied(failed)
  }
}

/**
 * The prompt put to the model of its tier, and the JSON object it answered with.
 *
 * Streamed, then gathered: the SDK refuses to send an unstreamed ask with room for a long answer,
 * and streaming costs nothing here.
 */
async function answerAsk(client: Anthropic, ask: AskRequestT): Promise<AskReplyT> {
  const answer = await client.messages.stream({
    model:      ModelForTier[ask.model_tier],
    max_tokens: ask.max_tokens,
    system:     AnswerAsObject,
    messages:   [{ role: 'user', content: ask.prompt }],
  }).finalMessage()
  if (answer.stop_reason === 'refusal') { return { ok: false, failurekind: 'declined' } }
  const text = textOf(answer.content)
  const truncated = answer.stop_reason === 'max_tokens'
  const read = answerOf(text, truncated)
  if (! read.ok) {
    console.warn('Triquet: a model answer was not a JSON object', { stop_reason: answer.stop_reason, text: text.slice(0, 600) })
    return read
  }
  return { ok: true, value: read.value, truncated, model_tier_applied: ask.model_tier, approx_tokens: approxTokensFor(ask.prompt, text) }
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
