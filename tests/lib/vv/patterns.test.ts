import { describe, expect, it } from 'vitest'
import * as PA from '../../../src/lib/vv/patterns'

const Reserved = PA.reservedOf(['rank', 'title', 'question'])

const ReservedOfCases: [string, boolean, string][] = [
  // regular usage:
  ["rank",          false,  'a reserved word is refused'],
  ["question",      false,  'every reserved word is refused, not only the first'],
  ["dumdum",        true,   'a word not on the list is allowed'],
  // near misses, which must be allowed:
  ["rank_2",        true,   'a reserved word with a suffix is another word'],
  ["ranks",         true,   'a reserved word run on is another word'],
  ["my_title",      true,   'a reserved word at the end of a longer one is another word'],
  ["questiontitle", true,   'two reserved words run together are another word'],
  ["Rank",          true,   'the match is exact, case and all: refusing other cases is the label pattern\'s job'],
  // trivial cases:
  ["",              true,   'an empty string is not reserved: refusing it is the label pattern\'s job'],
]

describe('reservedOf', () => {
  for (const [word, allowed, describes] of ReservedOfCases) {
    it(describes, () => {
      expect(Reserved.re.test(word)).to.eq(allowed)
    })
  }

  it("reads the doc block's example", () => {
    expect(PA.reservedOf(['rank', 'title']).re.test('rank')).to.be.false
  })

  it("names every refused word in its advice", () => {
    expect(Reserved.msg).to.eq('should not be any of rank, title, question, which the questions already use')
  })

  it("refuses only the empty string when no word is reserved", () => {
    const none = PA.reservedOf([])
    expect(none.re.test('rank')).to.be.true
    expect(none.re.test('')).to.be.false
  })
})
