import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { Ident, IdentValidators } from '../../src/models/ident'
import { IdentingValidators } from '../../src/models/identing'

describe('Ident.labelFor', () => {
  const Cases = [
    ["Flip Kromer",          "flip_kromer",                  'makes words a label'],
    ["  flip  ",             "flip",                         'trims, leaving a label too short for the validator to take'],
    ["Ünïcödé Pérson",       "unicode_person",               'deburrs'],
    ["the_quite_long_name_indeed", "the_quite_long_name_inde", 'stops at 24 characters'],
    ["",                     "",                             'hands back nothing for nothing'],
  ] as const
  for (const [typed, label, describes] of Cases) {
    it(describes, () => {
      expect(Ident.labelFor(typed)).to.eq(label)
    })
  }
})

describe('Ident.byline', () => {
  it('names an ident by its title, then its label written @label', () => {
    expect(Ident.byline({ label: 'mrflip', title: 'Mrflip' })).to.eq('Mrflip (@mrflip)')
    expect(Ident.byline({ label: 'flip_kromer', title: 'The First' })).to.eq('The First (@flip_kromer)')
  })
})

describe('Ident.atLabel', () => {
  it("writes an ident's label as its byline does, after an @", () => {
    expect(Ident.atLabel({ label: 'flip_kromer' })).to.eq('@flip_kromer')
  })
})

describe('Ident.fill', () => {
  const user_id = 'm57a2835q9kp1gefja107b9bfh8fnpvr'

  it('titles an ident after its label when it is given no title', () => {
    expect(Ident.fill({ label: 'flip_kromer', title: '', user_id })).to.deep.eq({ label: 'flip_kromer', title: 'Flip Kromer', user_id })
    expect(Ident.fill({ label: 'flip_kromer', title: ' '.repeat(3), user_id })).to.deep.eq({ label: 'flip_kromer', title: 'Flip Kromer', user_id })
  })

  it('keeps a title it is given, trimmed', () => {
    expect(Ident.fill({ label: 'flip_kromer', title: ' Flip ', user_id })).to.deep.eq({ label: 'flip_kromer', title: 'Flip', user_id })
  })

  it('holds the session that claimed it, or nobody', () => {
    expect(Ident.fill({ label: 'flip_kromer', title: 'Flip', user_id: null }).user_id).to.be.null
    expect(() => Ident.fill({ label: 'flip_kromer', title: 'Flip' } as never)).to.throw(Z.ZodError)
  })

  const Refused = [
    ['flips',                  'a label shorter than six'],
    ['x'.repeat(25),           'a label longer than twenty-four'],
    ['Flip_Kromer',            'a label that is not one'],
  ] as const
  for (const [label, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => Ident.fill({ label, title: 'Flip', user_id: null })).to.throw(Z.ZodError)
    })
  }
})

describe('IdentValidators.identLabel', () => {
  it('takes six to twenty-four characters, inclusive', () => {
    expect(['sixsix', 'x'.repeat(24)].map((label) => IdentValidators.identLabel.safeParse(label).success)).to.deep.eq([true, true])
    expect(['fivee', 'x'.repeat(25)].map((label) => IdentValidators.identLabel.safeParse(label).success)).to.deep.eq([false, false])
  })
})

describe('IdentingValidators.row', () => {
  const user_id = 'm57a2835q9kp1gefja107b9bfh8fnpvr'
  const ident_id = 'j97d0qbj35dar1v8edndzckvsx8f828f'

  it('names the session, and the ident it took on, each by its row id', () => {
    expect(IdentingValidators.row({ user_id, ident_id })).to.deep.eq({ user_id, ident_id })
  })

  it('refuses a session that is not a row id, or no session at all', () => {
    expect(() => IdentingValidators.row({ user_id: 'flip_kromer', ident_id })).to.throw(Z.ZodError)
    expect(() => IdentingValidators.row({ ident_id } as never)).to.throw(Z.ZodError)
  })
})
