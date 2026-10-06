import { describe, expect, it } from 'vitest'
import * as Labelmaker from '../../src/lib/labelmaker'
import { ValidatorKit } from '../../src/lib/validator'

const NormalizeCases: [string, string, string][] = [
  // regular usage:
  ["Hello, World!",  "hello_world",  'a run of punctuation and whitespace becomes one underscore'],
  ["Already_fine_123", "already_fine_123", 'an existing underscore is preserved'],
  ["Answer Length!", "answer_length",  'words are kept apart with an underscore'],
  ["title2",         "title2",       'digits stay with the word they follow'],
  ["a",              "az",           'a single letter is padded out to two characters'],
  // trivial cases:
  ["",               "",             'an empty string reads as no label yet'],
  [" ".repeat(3),    "",             'a whitespace-only string reads as no label yet'],
  // weird cases:
  ["__",             "zz",           'a string that strips to nothing gets the letter-start and length repairs in sequence'],
  ["a__b",            "a_b",         'an internal run of underscores collapses to one'],
  ["a _ b",           "a_b",         'underscore and spaces together collapse to one'],
  ["_",               "zz",          'a lone underscore has nothing left, so is repaired like any other empty body'],
  ["__lead_and_trail__", "lead_and_trail", 'underscores at either end are dropped'],
  [" 9 ",             "z9",          'a string starting with a digit after stripping gets a letter prepended'],
  ["éü",              "eu",          'diacritics are deburred before anything else'],
  ["L'Iñtërnâtiôñàlizætiøñ.𝍔", "l_internationalizaetion", 'the internationalization test string reduces to its bare letters'],
  ["👍cool👍",         "cool",        'emoji are non-word characters and collapse away at the ends like any other symbol'],
  ["x".repeat(39) + " y", "x".repeat(39), 'a cut that would leave a trailing underscore drops it'],
  ["👍👍",             "zz",          'a string of nothing but emoji strips to nothing, then gets repaired like any other'],
]

describe('normalize', () => {
  for (const [input, expected, blurb] of NormalizeCases) {
    it(blurb, () => {
      expect(Labelmaker.normalize(input)).to.eq(expected)
    })
  }

  it('caps the cleaned body at maxlen before the letter/length repairs run', () => {
    expect(Labelmaker.normalize('abcdefghij', { maxlen: 4 })).to.eq('abcd')
  })

  it('may run one character past maxlen when a letter must be prepended', () => {
    expect(Labelmaker.normalize('9abcdefghij', { maxlen: 4 })).to.eq('z9abc')
  })

  it('never returns more than a label may hold, however much is typed', () => {
    expect(Labelmaker.normalize('x'.repeat(100))).to.eq('x'.repeat(40))
    expect(Labelmaker.normalize('x'.repeat(100), { maxlen: 60 })).to.eq('x'.repeat(40))
  })

  it('still fits when a letter must be prepended to a body already at the limit', () => {
    expect(Labelmaker.normalize('9'.repeat(100))).to.eq(`z${'9'.repeat(39)}`)
  })

  it('always returns a valid label, even from adversarial input', () => {
    expect(ValidatorKit.label.safeParse(Labelmaker.normalize('🎲🎲🎲')).success).to.be.true
  })

  it('hands a reserved word back as it is, for the validator to refuse in words the author can act on', () => {
    expect(Labelmaker.normalize('Position')).to.eq('position')
    expect(ValidatorKit.label.safeParse(Labelmaker.normalize('Position')).success).to.be.false
  })
})

const IsReservedCases: [string, boolean, string][] = [
  ["position",    true,   'a reserved word is reserved'],
  ["quiz_id",     true,   'a label ending as a pointer to a row is reserved'],
  ["my_position", false,  'a reserved word inside a longer label is not'],
  ["Position",    false,  'the match is exact: a label typed in capitals is the shape\'s to refuse'],
  ["",            false,  'nothing typed is not reserved'],
]

describe('isReserved', () => {
  for (const [label, expected, describes] of IsReservedCases) {
    it(describes, () => {
      expect(Labelmaker.isReserved(label)).to.eq(expected)
    })
  }

  it("reads the doc block's examples", () => {
    expect(Labelmaker.isReserved('position')).to.be.true
    expect(Labelmaker.isReserved('my_position')).to.be.false
  })
})

describe('localBlankLabel', () => {
  it('returns a label built from an adjective and an animal', () => {
    expect(Labelmaker.localBlankLabel(new Set(), 'fallback')).to.match(/^[a-z]+_[a-z]+$/)
  })

  it('never returns a label already taken', () => {
    const taken = new Set<string>()
    for (let ii = 0; ii < 20; ii += 1) {
      const label = Labelmaker.localBlankLabel(taken, 'fallback')
      expect(taken.has(label)).to.be.false
      taken.add(label)
    }
  })

  it('falls back once every attempt collides', () => {
    const label = Labelmaker.localBlankLabel(new Set(), 'fallback')
    const alwaysTaken = { has: () => true } as unknown as ReadonlySet<string>
    expect(Labelmaker.localBlankLabel(alwaysTaken, 'fallback-id')).to.eq('fallback_id')
    expect(label).to.not.eq('fallback_id')
  })

  it('makes a real label of an id-shaped fallback, which starts with a digit', () => {
    const alwaysTaken = { has: () => true } as unknown as ReadonlySet<string>
    const label = Labelmaker.localBlankLabel(alwaysTaken, '01k5f9n3ktq7wzc8x2r4m0vaeh')
    expect(label).to.eq('z01k5f9n3ktq7wzc8x2r4m0vaeh')
    expect(ValidatorKit.label.safeParse(label).success).to.be.true
  })
})

describe('appendFallback', () => {
  it('appends the given fallback after an underscore', () => {
    expect(Labelmaker.appendFallback('otter', 'abc123')).to.eq('otter_abc123')
  })

  it('uses the random tail of a fresh id when no fallback is given', () => {
    const appended = Labelmaker.appendFallback('otter')
    expect(appended).to.match(/^otter_[0-9a-z]{8}$/)
  })

  it('cuts a long label short so the whole still fits', () => {
    const appended = Labelmaker.appendFallback('x'.repeat(40), 'abc123')
    expect(appended).to.eq(`${'x'.repeat(33)}_abc123`)
    expect(ValidatorKit.label.safeParse(appended).success).to.be.true
  })

  it('mints a different id on each call', () => {
    expect(Labelmaker.appendFallback('otter')).to.not.eq(Labelmaker.appendFallback('otter'))
  })
})

const Forty = `${'x'.repeat(39)}y`

const FirstFreeCases: [[string, string[]], string, string][] = [
  // regular usage:
  [["dumdum", []],                                 "dumdum",                        'a free label is itself'],
  [["dumdum", ["dumdum"]],                         "dumdum_2",                      'a taken label grows _2'],
  [["dumdum", ["dumdum", "dumdum_2"]],             "dumdum_3",                      'counts on past each suffix already taken'],
  [["dumdum", ["dumdum", "dumdum_3"]],             "dumdum_2",                      'takes the first gap rather than the next after the highest'],
  [["notes", ["notes", "title", "rank"]],          "notes_2",                       'a reserved word in the taken set is grown past like any other'],
  [["position", []],                               "position_2",                    'a word no label may be is grown past though nothing is taken'],
  [["position", ["position_2"]],                   "position_3",                    'a word no label may be counts on past the taken like any other'],
  // trivial cases:
  [["dumdum", ["dumdum_2"]],                       "dumdum",                        'a taken suffixed label does not stop the bare one'],
  // the 40-character bound:
  [[Forty, [Forty]],                               `${'x'.repeat(38)}_2`,           'a 40-character label is trimmed so the suffix still fits'],
  [[Forty, [Forty, `${'x'.repeat(38)}_2`]],        `${'x'.repeat(38)}_3`,           'a trimmed stem counts on like any other'],
  [[`${'x'.repeat(37)}_ab`, [`${'x'.repeat(37)}_ab`]], `${'x'.repeat(37)}_2`,       'a stem trimmed to a trailing underscore drops it rather than doubling it'],
  [[Forty, [Forty, ...Array.from({ length: 8 }, (_unused, ii) => `${'x'.repeat(38)}_${String(ii + 2)}`)]], `${'x'.repeat(37)}_10`, 'a two-digit suffix trims the stem one character further'],
  // weird cases:
  [["item_2", ["item_2"]],                         "item_2_2",                      'a label that already ends in a number grows a suffix of its own'],
]

describe('firstFree', () => {
  for (const [[label, taken], expected, describes] of FirstFreeCases) {
    it(describes, () => {
      const found = Labelmaker.firstFree(label, new Set(taken))
      expect(found).to.eq(expected)
      expect(found.length).to.be.at.most(40)
      expect(ValidatorKit.label.safeParse(found).success).to.be.true
    })
  }

  it("reads the doc block's examples", () => {
    expect(Labelmaker.firstFree('dumdum', new Set())).to.eq('dumdum')
    expect(Labelmaker.firstFree('dumdum', new Set(['dumdum', 'dumdum_2']))).to.eq('dumdum_3')
    expect(Labelmaker.firstFree('position', new Set())).to.eq('position_2')
  })
})

describe('titleize', () => {
  it('reads an under_score label as Title Case words', () => {
    expect(Labelmaker.titleize('quiet_otter')).to.eq('Quiet Otter')
  })
})

describe('urlize', () => {
  it('reads a label as under_score_case', () => {
    expect(Labelmaker.urlize('Quiet Otter')).to.eq('quiet_otter')
  })
})

describe('display', () => {
  it('reads a label as kebab-case', () => {
    expect(Labelmaker.display('quiet_otter')).to.eq('quiet-otter')
  })
})

describe('entityForLabel', () => {
  const entities = [
    { label: 'quiet_otter' },
    { label: 'leon' },
  ]

  it('finds an entity by its label', () => {
    expect(Labelmaker.entityForLabel(entities, 'leon')).to.eq(entities[1])
  })

  it('reads no match as undefined', () => {
    expect(Labelmaker.entityForLabel(entities, 'nobody')).to.be.undefined
  })
})

describe('freshLabelFor', () => {
  it('gives an adjective_animal label when nothing is in the way', () => {
    expect(Labelmaker.freshLabelFor([])).to.match(/^[a-z]+_[a-z]+$/)
  })

  it('never gives back a label a sibling already answers to', () => {
    const siblings = Array.from({ length: 40 }, () => ({ label: Labelmaker.freshLabelFor([]) }))
    const taken = new Set(siblings.map((each) => each.label))
    expect(taken.has(Labelmaker.freshLabelFor(siblings))).to.be.false
  })

})
