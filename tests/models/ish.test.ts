import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { IshValidators } from '../../src/models/ish'

const IshItemCases: [unknown, boolean, string][] = [
  // regular usage:
  [{ text: '300',         value: 300,       kind: 'numeral' },  true,  'a span written in digits'],
  [{ text: 'douzaine',    value: 12,        kind: 'wordish' },  true,  'a spelled-out number in another language'],
  [{ text: '300 million', value: 300_000_000, kind: 'wordish' },  true,  'a magnitude phrase carrying its whole value'],
  [{ text: '千',           value: 1000,      kind: 'wordish' },  true,  'a number in a non-Latin script'],
  [{ text: 'quarter',     value: 0.25,      kind: 'wordish' },  true,  'a fraction, which stays fractional'],
  [{ text: '#17-19',      value: 36,        kind: 'numeral' },  true,  'a span the model has already totalled for us'],
  [{ text: 'nil',         value: 0,         kind: 'wordish' },  true,  'a zero value, which is a real answer'],
  [{ text: 'owed',        value: -50,       kind: 'wordish' },  true,  'a negative value'],
  // nil and missing values:
  [{ text: '',            value: 1,         kind: 'numeral' },  false, 'an empty span, which shows the author nothing'],
  [{ text: '300',                           kind: 'numeral' },  false, 'a missing value'],
  [{ text: '300',         value: 300                        },  false, 'a missing kind'],
  [{                      value: 300,       kind: 'numeral' },  false, 'a missing span'],
  [{ text: '300',         value: null,      kind: 'numeral' },  false, 'a null value'],
  // absurd and not-quite-absurd type mismatches:
  [{ text: '300',         value: '300',     kind: 'numeral' },  false, 'a value that is still a string'],
  [{ text: '300',         value: NaN,      kind: 'numeral' },  false, 'a NaN value'],
  [{ text: '300',         value: Infinity, kind: 'numeral' }, false, 'an infinite value'],
  [{ text: '300',         value: 300,       kind: 'digits'  },  false, 'a kind outside the two we recognize'],
]

describe('IshValidators.ishItem', () => {
  for (const [dna, isLegal, blurb] of IshItemCases) {
    it(blurb, () => {
      expect(IshValidators.ishItem.safeParse(dna).success).to.eq(isLegal)
    })
  }
})

describe('IshValidators.ishes', () => {
  it('reads null as never asked', () => {
    expect(IshValidators.ishes(null)).to.eq(null)
  })

  it('defaults the bookkeeping flags on a done result', () => {
    expect(IshValidators.ishes({ status: 'done', updated_at: 1 })).to.deep.eq({
      status: 'done', items: [], truncated: false, stale: false, updated_at: 1, model_tier_applied: 'quick',
    })
  })

  it('treats an empty item list as a real answer, distinct from null', () => {
    const ishes = IshValidators.ishes({ status: 'done', items: [], updated_at: 1 })
    expect(ishes).to.not.eq(null)
    expect(ishes?.status === 'done' && ishes.items).to.deep.eq([])
  })

  it('carries an error in place of a result', () => {
    expect(IshValidators.ishes({ status: 'error', message: 'Too many requests right now — try again shortly.', updated_at: 1 }))
      .to.deep.eq({ status: 'error', message: 'Too many requests right now — try again shortly.', updated_at: 1 })
  })

  it('rejects a status that is neither done nor error', () => {
    expect(() => IshValidators.ishes({ status: 'thinking', updated_at: 1 } as never)).to.throw(Z.ZodError)
  })

  it('rejects a timestamp of zero, which is never a real ask time', () => {
    expect(() => IshValidators.ishes({ status: 'done', updated_at: 0 })).to.throw(Z.ZodError)
  })

  it('refuses a list longer than the per-text cap', () => {
    const items = Array.from({ length: 201 }, () => ({ text: '1', value: 1, kind: 'numeral' as const }))
    expect(() => IshValidators.ishes({ status: 'done', items, updated_at: 1 })).to.throw(Z.ZodError)
  })
})
