import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../../../../src/app/api/ask/route'
import { ApprovalNotices } from '../../../../src/lib/notices'

/** A guess, asked of the route as the browser would */
function askGuess(): Request {
  return new Request('http://localhost/api/ask', { method: 'POST', body: JSON.stringify({ job: 'guess', clueing: 'Who was Danish?' }) })
}

// The SDK reaches the model through the global fetch, so a route that never calls it never asked.
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
})
