import { describe, expect, it } from 'vitest'
import { openDb } from '../../src/db/client'
import { playerFor, promptFor } from '../../src/db/players'
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
