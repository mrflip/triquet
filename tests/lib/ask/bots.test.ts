import { afterEach, describe, expect, it, vi } from 'vitest'
import { botFor, botStatuses, promptFor } from '../../../src/lib/ask/bots'
import { QuickGuessPrompt } from '../../../src/lib/ask/prompts'

describe('botFor', () => {
  it('finds each seeded bot', () => {
    const dumdum = botFor('dumdum')
    expect(dumdum.model_tier).to.eq('quick')
    expect(dumdum.prompts.clueing).to.eq(QuickGuessPrompt)
    const numnum = botFor('numnum')
    expect(Object.keys(numnum.prompts)).to.have.members(['clueing', 'hint', 'bulk'])
  })
})

describe('promptFor', () => {
  it('fills the bot\'s prompt for that kind of text', () => {
    const dumdum = botFor('dumdum')
    expect(promptFor(dumdum, 'clueing', { clueing: 'Which region?' })).to.contain('Question: Which region?')
  })

  it('refuses a kind of text the bot is never asked about', () => {
    const dumdum = botFor('dumdum')
    expect(() => promptFor(dumdum, 'hint', { hint: 'BUT NOT' })).to.throw('no hint prompt')
  })
})

describe('botStatuses', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('says both bots can play when the server holds credentials for their service', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    const statuses = botStatuses()
    expect(statuses.map((status) => [status.label, status.servicelabel, status.credentialed])).to.deep.eq([
      ['dumdum', 'claude', true],
      ['numnum', 'claude', true],
    ])
  })

  it('says neither can when it does not', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const statuses = botStatuses()
    expect(statuses.map((status) => status.credentialed)).to.deep.eq([false, false])
  })

  it('never carries the credential itself', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-secret')
    const statuses = botStatuses()
    expect(JSON.stringify(statuses)).not.to.contain('sk-secret')
  })
})
