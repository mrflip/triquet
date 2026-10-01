import { afterEach, describe, expect, it, vi } from 'vitest'
import { serviceStatuses } from '../../../src/lib/ask/bots'

describe('serviceStatuses', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('says a service can be asked when the server holds credentials for it', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    expect(serviceStatuses()).to.deep.eq([{ servicelabel: 'claude', credentialed: true }])
  })

  it('says it cannot when the server does not', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect(serviceStatuses()).to.deep.eq([{ servicelabel: 'claude', credentialed: false }])
  })

  it('never carries the credential itself', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-secret')
    expect(JSON.stringify(serviceStatuses())).not.to.contain('sk-secret')
  })
})
