import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { BotStatusValidators } from '../../src/models/bot-status'

const dumdum = { label: 'dumdum', title: 'Dumdum', servicelabel: 'claude', credentialed: true }

describe('BotStatusValidators.botStatuses', () => {
  it('accepts every bot with whether it can play', () => {
    const statuses = BotStatusValidators.botStatuses({ bots: [dumdum, { ...dumdum, label: 'numnum', credentialed: false }] })
    expect(statuses.bots.map((status) => status.credentialed)).to.deep.eq([true, false])
  })

  it('accepts no bots at all', () => {
    expect(BotStatusValidators.botStatuses({ bots: [] }).bots).to.deep.eq([])
  })

  const Refused: [unknown, string][] = [
    [{},                                                       'no bots field'],
    [{ bots: [{ ...dumdum, credentialed: 'yes' }] },        'a credentialed that is not a boolean'],
    [{ bots: [{ ...dumdum, credentialed: undefined }] },    'a bot with no word on whether it can play'],
    [{ bots: [{ ...dumdum, label: '' }] },                  'a bot with no label'],
    [{ bots: [{ ...dumdum, title: 'Two\nlines' }] },        'a title on more than one line'],
  ]
  for (const [dna, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => BotStatusValidators.botStatuses(dna as never)).to.throw(Z.ZodError)
    })
  }
})
