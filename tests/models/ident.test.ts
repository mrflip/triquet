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

describe('Ident.fill', () => {
  it('titles an ident after its label when it is given no title', () => {
    expect(Ident.fill('flip_kromer', '')).to.deep.eq({ label: 'flip_kromer', title: 'Flip Kromer' })
    expect(Ident.fill('flip_kromer', ' '.repeat(3))).to.deep.eq({ label: 'flip_kromer', title: 'Flip Kromer' })
  })

  it('keeps a title it is given, trimmed', () => {
    expect(Ident.fill('flip_kromer', ' Flip ')).to.deep.eq({ label: 'flip_kromer', title: 'Flip' })
  })

  const Refused = [
    ['flips',                  'a label shorter than six'],
    ['x'.repeat(25),           'a label longer than twenty-four'],
    ['Flip_Kromer',            'a label that is not one'],
  ] as const
  for (const [label, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => Ident.fill(label, 'Flip')).to.throw(Z.ZodError)
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
  it('names the ident taken on by its row id', () => {
    expect(IdentingValidators.row({ ident_id: '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9' }).ident_id).to.eq('01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9')
    expect(() => IdentingValidators.row({ ident_id: 'flip_kromer' })).to.throw(Z.ZodError)
  })
})
