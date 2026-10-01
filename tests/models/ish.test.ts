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

describe('IshValidators.ishItemReply', () => {
  it("takes a span the kept item would refuse, so the answer arrives to be judged", () => {
    const long = { text: 'x'.repeat(3601), value: 1, kind: 'numeral' }
    expect(IshValidators.ishItemReply.safeParse(long).success).to.be.true
    expect(IshValidators.ishItem.safeParse(long).success).to.be.false
  })

  it("takes a span carrying a control character, which a kept item refuses", () => {
    const odd = { text: '3\u{7}', value: 3, kind: 'numeral' }
    expect(IshValidators.ishItemReply.safeParse(odd).success).to.be.true
    expect(IshValidators.ishItem.safeParse(odd).success).to.be.false
  })

  const Refused: [unknown, string][] = [
    [{ text: '',    value: 1,     kind: 'numeral' },  'an empty span'],
    [{ text: '300', value: '300', kind: 'numeral' },  'a value that is still a string'],
    [{ text: '300', value: 300,   kind: 'digits'  },  'a kind outside the two we recognize'],
  ]
  for (const [dna, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => IshValidators.ishItemReply(dna as never)).to.throw(Z.ZodError)
    })
  }
})
