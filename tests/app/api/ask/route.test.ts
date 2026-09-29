import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../../../../src/app/api/ask/route'
import { MaxTokensForJob } from '../../../../src/lib/ask/models'
import { ApprovalNotices } from '../../../../src/lib/notices'

/** A guess, asked of the route as the browser would */
function askGuess(): Request {
  return new Request('http://localhost/api/ask', { method: 'POST', body: JSON.stringify({ job: 'guess', clueing: 'Who was Danish?' }) })
}

/** A whole quiz's ishes in one run, asked of the route as the browser would */
function askBulk(): Request {
  const items = [{ key: 'c:q1', text: 'Snow White kept house for seven dwarfs' }, { key: 'h:q1', text: 'Think a dozen minus five' }]
  return new Request('http://localhost/api/ask', { method: 'POST', body: JSON.stringify({ job: 'bulk_ishes', items }) })
}

/** What the model found in `askBulk`'s texts, as a live run answered it */
const BulkGroups = [
  { key: 'c:q1', items: [{ text: 'seven', value: 7, kind: 'wordish' }] },
  { key: 'h:q1', items: [{ text: 'dozen', value: 12, kind: 'wordish' }, { text: 'five', value: 5, kind: 'wordish' }] },
]

/**
 * The Messages API's answer as it streams one: `text` in a single delta, then a clean stop.
 * Every event the SDK needs to put the final message together is here, and nothing more.
 */
function streamedAnswer(text: string): Response {
  const events = [
    { type: 'message_start', message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-test', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 400, output_tokens: 1 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 60 } },
    { type: 'message_stop' },
  ]
  const body = events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } })
}

/** The body the route sent the model, as the SDK handed it to fetch */
function sentBody(): { stream?: boolean, max_tokens?: number } {
  const [, init] = fetched.mock.calls[0] as [unknown, { body: string }]
  return JSON.parse(init.body) as { stream?: boolean, max_tokens?: number }
}

// The SDK reaches the model through the global fetch, so a route that never calls it never asked,
// and whatever fetch answers is all the model a test ever meets: nothing here can reach Anthropic.
const fetched = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetched)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  fetched.mockReset()
})

describe('POST /api/ask', () => {
  it('declines politely, and asks nobody, when the server has not switched asking on', async () => {
    vi.stubEnv('ENABLE_ANTHROPIC_BOT', undefined)
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-not-a-real-key')
    const answer = await POST(askGuess())
    expect(await answer.json()).to.deep.eq({ ok: false, failurekind: 'notPermitted', detail: { name: 'NotApprovedError', message: ApprovalNotices.anthropic_bot } })
    expect(fetched).not.toHaveBeenCalled()
  })

  it('says asking is unavailable, and asks nobody, when switched on but holding no key', async () => {
    vi.stubEnv('ENABLE_ANTHROPIC_BOT', 'allow')
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const answer = await POST(askGuess())
    expect(await answer.json()).to.deep.eq({ ok: false, failurekind: 'unavailable' })
    expect(fetched).not.toHaveBeenCalled()
  })

  it("puts a whole-quiz run to the model, streamed so the SDK lets it have room for a long answer", async () => {
    vi.stubEnv('ENABLE_ANTHROPIC_BOT', 'allow')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-not-a-real-key')
    fetched.mockResolvedValue(streamedAnswer(JSON.stringify({ groups: BulkGroups })))
    const answer = await POST(askBulk())
    const reply = await answer.json() as { ok: boolean, job: string, groups: unknown, truncated: boolean, text_count: number }
    expect(reply).to.include({ ok: true, job: 'bulk_ishes', truncated: false, text_count: 2 })
    expect(reply.groups).to.deep.eq(BulkGroups)
    expect(fetched).toHaveBeenCalledOnce()
    expect(sentBody()).to.include({ stream: true, max_tokens: MaxTokensForJob.bulk_ishes })
  })

})
