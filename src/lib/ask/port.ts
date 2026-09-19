import { AskContract, AskRoutepath, type AskReplyT, type AskRequestDNA } from './contract'

/**
 * Ask the model, from the browser.
 *
 * Never throws: a network failure, an unreachable route, or an answer this build does not
 * recognise all come back as a failure kind, because every one of them has to reach the author
 * as a sentence in a cell rather than as a broken screen.
 *
 * @param ask - What to ask for.
 * @returns The answer, or the kind of failure it was.
 *
 * @example await askModel({ job: 'guess', clueing: 'Which region?' })
 */
export async function askModel(ask: AskRequestDNA): Promise<AskReplyT> {
  try {
    const answer = await fetch(AskRoutepath, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(ask),
    })
    const reply = AskContract.askReply.safeParse(await answer.json())
    return reply.success ? reply.data : { ok: false, failurekind: 'unreadable' }
  } catch (err) {
    return { ok: false, failurekind: 'connection', detail: { message: err instanceof Error ? err.message.slice(0, 600) : 'The request did not complete' } }
  }
}
