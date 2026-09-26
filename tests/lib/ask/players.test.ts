import { afterEach, describe, expect, it, vi } from 'vitest'
import { playerFor, playerStatuses, promptFor } from '../../../src/lib/ask/players'
import { QuickGuessPrompt } from '../../../src/lib/ask/prompts'

describe('playerFor', () => {
  it('finds each seeded player', () => {
    const dumdum = playerFor('dumdum')
    expect(dumdum.model_tier).to.eq('quick')
    expect(dumdum.prompts.clueing).to.eq(QuickGuessPrompt)
    const numnum = playerFor('numnum')
    expect(Object.keys(numnum.prompts)).to.have.members(['clueing', 'hint', 'bulk'])
  })
})

describe('promptFor', () => {
  it('fills the player\'s prompt for that kind of text', () => {
    const dumdum = playerFor('dumdum')
    expect(promptFor(dumdum, 'clueing', { clueing: 'Which region?' })).to.contain('Question: Which region?')
  })

  it('refuses a kind of text the player is never asked about', () => {
    const dumdum = playerFor('dumdum')
    expect(() => promptFor(dumdum, 'hint', { hint: 'BUT NOT' })).to.throw('no hint prompt')
  })
})

describe('playerStatuses', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('says both players can play when the server holds credentials for their service', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    const statuses = playerStatuses()
    expect(statuses.map((status) => [status.label, status.servicelabel, status.credentialed])).to.deep.eq([
      ['dumdum', 'claude', true],
      ['numnum', 'claude', true],
    ])
  })

  it('says neither can when it does not', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const statuses = playerStatuses()
    expect(statuses.map((status) => status.credentialed)).to.deep.eq([false, false])
  })

  it('never carries the credential itself', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-secret')
    const statuses = playerStatuses()
    expect(JSON.stringify(statuses)).not.to.contain('sk-secret')
  })
})
