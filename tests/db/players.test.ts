import { afterEach, describe, expect, it, vi } from 'vitest'
import { openDb } from '../../src/db/client'
import { playerFor, playerStatuses, promptFor } from '../../src/db/players'
import { QuickGuessPrompt } from '../../src/lib/ask/prompts'

describe('playerFor', () => {
  it('finds each seeded player', async () => {
    const db = await openDb(':memory:')
    const dumdum = await playerFor(db, 'dumdum')
    expect(dumdum.model_tier).to.eq('quick')
    expect(dumdum.prompts.clueing).to.eq(QuickGuessPrompt)
    const numnum = await playerFor(db, 'numnum')
    expect(Object.keys(numnum.prompts)).to.have.members(['clueing', 'hint', 'bulk'])
  })
})

describe('promptFor', () => {
  it('fills the player\'s prompt for that kind of text', async () => {
    const dumdum = await playerFor(await openDb(':memory:'), 'dumdum')
    expect(promptFor(dumdum, 'clueing', { clueing: 'Which region?' })).to.contain('Question: Which region?')
  })

  it('refuses a kind of text the player is never asked about', async () => {
    const dumdum = await playerFor(await openDb(':memory:'), 'dumdum')
    expect(() => promptFor(dumdum, 'hint', { hint: 'BUT NOT' })).to.throw('no hint prompt')
  })
})

describe('playerStatuses', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('says both players can play when the server holds credentials for their service', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    const statuses = await playerStatuses(await openDb(':memory:'))
    expect(statuses.map((status) => [status.label, status.servicelabel, status.credentialed])).to.deep.eq([
      ['dumdum', 'claude', true],
      ['numnum', 'claude', true],
    ])
  })

  it('says neither can when it does not', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const statuses = await playerStatuses(await openDb(':memory:'))
    expect(statuses.map((status) => status.credentialed)).to.deep.eq([false, false])
  })

  it('never carries the credential itself', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-secret')
    const statuses = await playerStatuses(await openDb(':memory:'))
    expect(JSON.stringify(statuses)).not.to.contain('sk-secret')
  })
})
