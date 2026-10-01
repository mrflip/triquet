import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../../../../src/app/api/ask/route'
import { ApprovalNotices } from '../../../../src/lib/notices'

/** A guess, asked of the route as the browser would */
function askGuess(): Request {
  return new Request('http://localhost/api/ask', { method: 'POST', body: JSON.stringify({ job: 'guess', clueing: 'Who was Danish?' }) })
}

/** A hint's ishes, asked of the route as the browser would */
function askHintIshes(): Request {
  return new Request('http://localhost/api/ask', { method: 'POST', body: JSON.stringify({ job: 'ishes', textkind: 'hint', text: 'Think a dozen minus five' }) })
}

/** What the model found in `askHintIshes`'s hint, as a live run answered it */
const HintItems = [{ text: 'dozen', value: 12, kind: 'wordish' }, { text: 'five', value: 5, kind: 'wordish' }]

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
function sentBody(): { stream?: boolean, max_tokens?: number, messages: { content: string }[] } {
  const [, init] = fetched.mock.calls[0] as [unknown, { body: string }]
  return JSON.parse(init.body) as { stream?: boolean, max_tokens?: number, messages: { content: string }[] }
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
  vi.restoreAllMocks()
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

  it("puts a guess to the model as dumdum's prompt, with dumdum's small room", async () => {
    vi.stubEnv('ENABLE_ANTHROPIC_BOT', 'allow')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-not-a-real-key')
    fetched.mockResolvedValue(Response.json({
      id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-test', content: [{ type: 'text', text: 'Hamlet' }],
      stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 80, output_tokens: 2 },
    }))
    const answer = await POST(askGuess())
    expect(await answer.json()).to.deep.include({ ok: true, job: 'guess', text: 'Hamlet', truncated: false, model_tier_applied: 'quick' })
    expect(sentBody()).to.include({ max_tokens: 256 })
    expect(sentBody().messages[0]?.content).to.include('Question: Who was Danish?')
  })

  it("puts an extraction to the model as its seeded widget's prompt and room, streamed so the SDK allows the room", async () => {
    vi.stubEnv('ENABLE_ANTHROPIC_BOT', 'allow')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-not-a-real-key')
    fetched.mockResolvedValue(streamedAnswer(JSON.stringify({ items: HintItems })))
    const answer = await POST(askHintIshes())
    const reply = await answer.json() as { ok: boolean, job: string, items: unknown, truncated: boolean, model_tier_applied: string }
    expect(reply).to.include({ ok: true, job: 'ishes', truncated: false, model_tier_applied: 'careful' })
    expect(reply.items).to.deep.eq(HintItems)
    expect(fetched).toHaveBeenCalledOnce()
    expect(sentBody()).to.include({ stream: true, max_tokens: 4000 })
    expect(sentBody().messages[0]?.content).to.include('Hint: Think a dozen minus five')
  })

  it("answers a failure with its kind, and logs what the SDK threw on the server", async () => {
    vi.stubEnv('ENABLE_ANTHROPIC_BOT', 'allow')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-not-a-real-key')
    const logged = vi.spyOn(console, 'error').mockImplementation(() => null)
    // A status the SDK does not retry, so the test waits on no backoff.
    fetched.mockResolvedValue(Response.json({ type: 'error', error: { type: 'permission_error', message: 'nope' } }, { status: 403 }))
    const answer = await POST(askHintIshes())
    const reply = await answer.json() as { failurekind: string }
    expect(reply.failurekind).to.eq('accountOff')
    expect(logged).toHaveBeenCalledOnce()
    expect(logged.mock.calls[0]?.[0]).to.match(/^Triquet: could not answer a ishes ask — Error: 403 .*permission_error/)
  })

  it("logs nothing when asking is only switched off", async () => {
    vi.stubEnv('ENABLE_ANTHROPIC_BOT', undefined)
    const logged = vi.spyOn(console, 'error').mockImplementation(() => null)
    await POST(askHintIshes())
    expect(logged).not.toHaveBeenCalled()
  })
})
