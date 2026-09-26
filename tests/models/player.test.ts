import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { PlayerValidators, SeedPlayers } from '../../src/models/player'
import { PromptTemplates } from '../../src/lib/ask/prompts'

describe('SeedPlayers', () => {
  it('holds dumdum and numnum', () => {
    expect(SeedPlayers.map((player) => player.label)).to.deep.eq(['dumdum', 'numnum'])
  })

  it('gives the players exactly the prompts the Prompts used panel shows', () => {
    const shown = new Set<string>(PromptTemplates.map((template) => template.body))
    const given = SeedPlayers.flatMap((player) => Object.values(player.prompts))
    expect(new Set(given)).to.deep.eq(shown)
  })

  it('has both players served by claude', () => {
    expect(SeedPlayers.map((player) => player.servicelabel)).to.deep.eq(['claude', 'claude'])
  })

  it('sends dumdum to the quick tier and numnum to the careful one', () => {
    expect(SeedPlayers.map((player) => player.model_tier)).to.deep.eq(['quick', 'careful'])
  })
})

describe('PlayerValidators.player', () => {
  const dumdum = { label: 'dumdum', title: 'Dumdum', blurb: '', servicelabel: 'claude', model_tier: 'quick', max_tokens: 256, prompts: { clueing: 'Question: {{clueing}}' } }

  it('accepts a player with only some of the prompts', () => {
    expect(PlayerValidators.player(dumdum as never).prompts).to.deep.eq({ clueing: 'Question: {{clueing}}' })
  })

  const Refused: [object, string][] = [
    [{ label: 'smartypants' },          'a player nobody has heard of'],
    [{ servicelabel: 'gemini' },        'a service we hold no credentials for'],
    [{ servicelabel: undefined },       'a player served by nobody'],
    [{ model_tier: 'sonnet' },          'a tier that is not one of ours'],
    [{ max_tokens: 0 },                 'no room at all to answer'],
    [{ prompts: { essay: 'Write' } },   'a prompt for a kind of text there is not'],
    [{ prompts: { clueing: '' } },      'an empty prompt'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => PlayerValidators.player({ ...dumdum, ...overrides } as never)).to.throw(Z.ZodError)
    })
  }
})
