import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../../../../src/app/api/bots/route'
import { ServiceStatusValidators } from '../../../../src/models/service-status'

afterEach(() => { vi.unstubAllEnvs() })

describe('GET /api/bots', () => {
  it('reports each service, and that it can be asked, when the server holds its credentials', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-not-a-real-key')
    const answer = await GET().json() as unknown
    expect(answer).to.deep.eq({ services: [{ servicelabel: 'claude', credentialed: true }] })
  })

  it('reports that it cannot when the server does not', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect(await GET().json()).to.deep.eq({ services: [{ servicelabel: 'claude', credentialed: false }] })
  })

  it('answers in the shape the browser reads it in, and never with the credential', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-not-a-real-key')
    const text = await GET().text()
    expect(ServiceStatusValidators.serviceStatuses.safeParse(JSON.parse(text)).success).to.be.true
    expect(text).not.to.contain('sk-ant-not-a-real-key')
  })
})
