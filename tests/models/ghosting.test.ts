import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { GhostingValidators } from '../../src/models/ghosting'

const Row = {
  userlabel:    'flip_kromer',
  user_id:      'j97d0qbj35dar1v8edndzckvsx8f828f',
  into_user_id: 'j97d0qbj35dar1v8edndzckvsx8f8299',
  account_id:   'jd7bb0e6p0dn0x7h7b8eyhcsx17fnf6t',
}

describe('GhostingValidators.row', () => {
  it('takes a userlabel retired, the user that held it, the user it merged into, and the account whose sign-in caused it', () => {
    expect(GhostingValidators.row(Row)).to.deep.eq(Row)
  })

  const Refused: [object, string][] = [
    [{ userlabel: 'Flip K' },       'a userlabel that is not one'],
    [{ user_id: undefined },        'no user that held it'],
    [{ into_user_id: 'nope' },      'a user merged into that is not a row id'],
    [{ account_id: undefined },     'no account'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => GhostingValidators.row({ ...Row, ...overrides })).to.throw(Z.ZodError)
    })
  }
})
