import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { PlayerStatusValidators } from '../../src/models/player-status'

const dumdum = { label: 'dumdum', title: 'Dumdum', servicelabel: 'claude', credentialed: true }

describe('PlayerStatusValidators.playerStatuses', () => {
  it('accepts every player with whether it can play', () => {
    const statuses = PlayerStatusValidators.playerStatuses({ players: [dumdum, { ...dumdum, label: 'numnum', credentialed: false }] })
    expect(statuses.players.map((status) => status.credentialed)).to.deep.eq([true, false])
  })

  it('accepts no players at all', () => {
    expect(PlayerStatusValidators.playerStatuses({ players: [] }).players).to.deep.eq([])
  })

  const Refused: [unknown, string][] = [
    [{},                                                       'no players field'],
    [{ players: [{ ...dumdum, credentialed: 'yes' }] },        'a credentialed that is not a boolean'],
    [{ players: [{ ...dumdum, credentialed: undefined }] },    'a player with no word on whether it can play'],
    [{ players: [{ ...dumdum, label: '' }] },                  'a player with no label'],
    [{ players: [{ ...dumdum, title: 'Two\nlines' }] },        'a title on more than one line'],
  ]
  for (const [dna, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => PlayerStatusValidators.playerStatuses(dna as never)).to.throw(Z.ZodError)
    })
  }
})
