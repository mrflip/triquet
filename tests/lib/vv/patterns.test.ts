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

const UnreservedCases: [string, boolean, string][] = [
  // regular usage, one from each group:
  ["position",      false,  'a field rows carry beside their label is refused'],
  ["createdat",     false,  'a field is refused with its underbar dropped, too'],
  ["quizzes",       false,  'a noun of the tool is refused, many as well as one'],
  ["qn",            false,  'what a formula\'s bag calls a question is refused'],
  ["widgetingid",   false,  'a pointer to a row is refused with its underbar dropped'],
  ["constructor",   false,  'a name every plain object answers to is refused'],
  ["null",          false,  'a word read as no value is refused'],
  ["com7",          false,  'a name Windows will not give a file is refused'],
  ["new",           false,  'a word an address might one day hold is refused'],
  ["dumdum",        true,   'a word on no list is allowed'],
  // the pointer suffix:
  ["quiz_id",       false,  'a label ending in _id is refused, as a pointer to a row'],
  ["anything_ids",  false,  'a label ending in _ids is refused, whatever comes before it'],
  ["squid",         true,   'ending in "id" without an underbar is another word'],
  ["id_card",       true,   'beginning with "id_" is another word'],
  ["quiz_idx",      true,   'an _id run on is another word'],
  // near misses, which must be allowed:
  ["position_2",    true,   'a reserved word with a suffix is another word'],
  ["my_label",      true,   'a reserved word at the end of a longer one is another word'],
  ["quizzical",     true,   'a reserved word run on is another word'],
  ["com10",         true,   'only one digit makes a device name'],
  ["categories",    true,   'the category-estimate widget\'s label is allowed: production holds widgetings under it'],
  ["title",         true,   'a question\'s own fields are reserved only where they would be shadowed, among widgetings'],
  ["home",          true,   'the label every hunt\'s first realm takes is allowed'],
  ["main",          true,   'the branch every hunt starts on is allowed'],
  ["key",           false,  'a key, as fields and bags speak of one, is refused'],
  ["pricing",       true,   'a top-level word is any other label\'s to take: only hunts and idents are kept from it'],
  // trivial cases:
  ["",              true,   'an empty string is not reserved: refusing it is the label pattern\'s job'],
]

describe('Unreserved', () => {
  for (const [word, allowed, describes] of UnreservedCases) {
    it(`${describes} (${word || 'blank'})`, () => {
      expect(PA.Unreserved.re.test(word)).to.eq(allowed)
    })
  }

  it("refuses every reserved word", () => {
    expect(PA.ReservedLabels.filter((word) => PA.Unreserved.re.test(word))).to.deep.eq([])
  })
})

describe('ReservedLabels', () => {
  it("holds only words a label could otherwise be, so none is there for nothing", () => {
    const unshaped = PA.ReservedLabels.filter((word) => ! (PA.Label.re.test(word) && word.length <= PA.Label.max))
    expect(unshaped).to.deep.eq([])
  })

  it("names each word once", () => {
    expect(new Set(PA.ReservedLabels).size).to.eq(PA.ReservedLabels.length)
  })

  it("is every group's words, in turn", () => {
    expect(PA.ReservedLabels).to.deep.eq(Object.values(PA.ReservedLabelGroups).flat())
    expect(PA.ReservedLabelGroups.devices).to.include.members(['con', 'nul', 'com0', 'com9', 'lpt0', 'lpt9'])
    expect(PA.ReservedLabelGroups.pointers).to.include.members(['huntid', 'huntids', 'quizid', 'quizids'])
  })
})

const UnreservedToplevelCases: [string, boolean, string][] = [
  // regular usage, one from each group:
  ["dashboard",     false,  'a corner of the app is refused'],
  ["careers",       false,  'a marketing page is refused'],
  ["triquet",       false,  'a name that would pass for the app speaking is refused'],
  ["quiet_otter",   true,   'a minted label is allowed'],
  // the prefixes:
  ["security",      false,  'a word beginning secur is refused'],
  ["secure_drop",   false,  'a label beginning secur is refused, whatever follows'],
  ["insecure",      true,   'secur inside a word is another word'],
  ["login_page",    false,  'a label beginning login is refused'],
  ["triquet_team",  false,  'a label beginning triquet is refused'],
  ["helpful_hal",   false,  'a label beginning help is refused, helpful ones too'],
  ["admin_ops",     false,  'a label beginning admin is refused'],
  ["support_desk",  false,  'a label beginning support is refused'],
  ["official_ben",  false,  'a label beginning official is refused'],
  ["verified_ben",  false,  'a label beginning verif is refused'],
  ["team_otter",    true,   'team with more after it is allowed: only the bare word is kept'],
  ["stafford",      true,   'a word too common to refuse as a prefix is refused only whole'],
  // the forms:
  ["pubxy",         false,  'pub and two characters more is refused'],
  ["pub_a",         false,  'pub, an underbar and one character more is refused'],
  ["pubs",          true,   'pub and one character more is another word'],
  ["pubkey",        true,   'pub and three characters more is another word'],
  // near misses, which must be allowed:
  ["about_face",    true,   'a top-level word with more after it is another word'],
  ["my_team",       true,   'a top-level word at the end of a longer one is another word'],
  // trivial cases:
  ["",              true,   'an empty string is not reserved: refusing it is the label pattern\'s job'],
]

describe('UnreservedToplevel', () => {
  for (const [word, allowed, describes] of UnreservedToplevelCases) {
    it(`${describes} (${word || 'blank'})`, () => {
      expect(PA.UnreservedToplevel.re.test(word)).to.eq(allowed)
    })
  }

  it("refuses every top-level reserved word", () => {
    expect(PA.ReservedToplevel.filter((word) => PA.UnreservedToplevel.re.test(word))).to.deep.eq([])
  })
})

describe('ReservedToplevel', () => {
  it("holds only words a label could otherwise be, and none every label is already kept from", () => {
    const unshaped = PA.ReservedToplevel.filter((word) => ! PA.Label.re.test(word))
    expect(unshaped).to.deep.eq([])
    expect(PA.ReservedToplevel.filter((word) => PA.ReservedLabels.includes(word))).to.deep.eq([])
  })

  it("names each word once", () => {
    expect(new Set(PA.ReservedToplevel).size).to.eq(PA.ReservedToplevel.length)
  })

  it("holds no word a prefix already refuses", () => {
    const covered = PA.ReservedToplevel.filter((word) => PA.ReservedToplevelPrefixes.some((prefix) => word.startsWith(prefix)))
    expect(covered).to.deep.eq([])
  })
})
