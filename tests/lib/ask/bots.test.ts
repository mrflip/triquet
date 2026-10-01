import { afterEach, describe, expect, it, vi } from 'vitest'
import { seededWidgetFor, serviceStatuses } from '../../../src/lib/ask/bots'
import type { AskRequestT } from '../../../src/lib/ask/contract'

describe('seededWidgetFor', () => {
  const SeededCases: [AskRequestT, string, string][] = [
    [{ job: 'guess', clueing: 'Who?' },                      'dumdum',         'a guess is put as dumdum'],
    [{ job: 'ishes', textkind: 'clueing', text: 'Two' },     'numnum_clueing', 'an extraction from a clueing is put as the clueing number spotter'],
    [{ job: 'ishes', textkind: 'hint', text: 'Two' },        'numnum_hint',    'an extraction from a hint is put as the hint number spotter'],
  ]
  for (const [ask, label, describes] of SeededCases) {
    it(describes, () => {
      expect(seededWidgetFor(ask).label).to.eq(label)
    })
  }

  it('hands back the whole aibot widget, its prompt and its tier with it', () => {
    const dumdum = seededWidgetFor({ job: 'guess', clueing: 'Who?' })
    expect(dumdum.formulary).to.eq('aibot')
    expect(dumdum.formula).to.include('{{clueing}}')
    expect(dumdum.config).to.deep.eq({ servicelabel: 'claude', model_tier: 'quick', max_tokens: 256 })
  })

  it('refuses an ask no seeded widget answers', () => {
    expect(() => seededWidgetFor({ job: 'ishes', textkind: 'answer', text: 'Two' } as never)).to.throw('No seeded widget answers the ishes job for the answer')
  })
})

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
