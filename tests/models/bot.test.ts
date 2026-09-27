import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { BotValidators, SeedBots } from '../../src/models/bot'
import { PromptTemplates } from '../../src/lib/ask/prompts'

describe('SeedBots', () => {
  it('holds dumdum and numnum', () => {
    expect(SeedBots.map((bot) => bot.label)).to.deep.eq(['dumdum', 'numnum'])
  })

  it('gives the bots exactly the prompts the Prompts used panel shows', () => {
    const shown = new Set<string>(PromptTemplates.map((template) => template.body))
    const given = SeedBots.flatMap((bot) => Object.values(bot.prompts))
    expect(new Set(given)).to.deep.eq(shown)
  })

  it('has both bots served by claude', () => {
    expect(SeedBots.map((bot) => bot.servicelabel)).to.deep.eq(['claude', 'claude'])
  })

  it('sends dumdum to the quick tier and numnum to the careful one', () => {
    expect(SeedBots.map((bot) => bot.model_tier)).to.deep.eq(['quick', 'careful'])
  })
})

describe('BotValidators.bot', () => {
  const dumdum = { label: 'dumdum', title: 'Dumdum', blurb: '', servicelabel: 'claude', model_tier: 'quick', max_tokens: 256, prompts: { clueing: 'Question: {{clueing}}' } }

  it('accepts a bot with only some of the prompts', () => {
    expect(BotValidators.bot(dumdum as never).prompts).to.deep.eq({ clueing: 'Question: {{clueing}}' })
  })

  const Refused: [object, string][] = [
    [{ label: 'smartypants' },          'a bot nobody has heard of'],
    [{ servicelabel: 'gemini' },        'a service we hold no credentials for'],
    [{ servicelabel: undefined },       'a bot served by nobody'],
    [{ model_tier: 'sonnet' },          'a tier that is not one of ours'],
    [{ max_tokens: 0 },                 'no room at all to answer'],
    [{ prompts: { essay: 'Write' } },   'a prompt for a kind of text there is not'],
    [{ prompts: { clueing: '' } },      'an empty prompt'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => BotValidators.bot({ ...dumdum, ...overrides } as never)).to.throw(Z.ZodError)
    })
  }
})
