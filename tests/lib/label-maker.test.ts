import { describe, expect, it } from 'vitest'
import * as Labelmaker from '../../src/lib/labelmaker'
import { ValidatorKit } from '../../src/lib/validator'

const NormalizeCases: [string, string, string][] = [
  // regular usage:
  ["Hello, World!",  "helloworld",   'punctuation and whitespace are stripped, not kept as a separator'],
  ["Already_fine_123", "alreadyfine123", 'an existing underscore is stripped too, not preserved'],
  ["a",              "az",           'a single letter is padded out to two characters'],
  // trivial cases:
  ["",               "",             'an empty string reads as no label yet'],
  [" ".repeat(3),    "",             'a whitespace-only string reads as no label yet'],
  // weird cases:
  ["__",             "zz",           'a string that strips to nothing gets the letter-start and length repairs in sequence'],
  ["a__b",            "ab",          'an internal run of underscores vanishes rather than collapsing to one'],
  [" 9 ",             "z9",          'a string starting with a digit after stripping gets a letter prepended'],
  ["éü",              "eu",          'diacritics are deburred before anything else'],
  ["L'Iñtërnâtiôñàlizætiøñ.𝍔", "linternationalizaetion", 'the internationalization test string reduces to its bare letters'],
  ["👍cool👍",         "cool",        'emoji are non-word characters and are stripped like any other symbol'],
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
    expect(ValidatorKit.label.safeParse(Labelmaker.normalize('🎲🎲🎲')).success).to.eq(true)
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
      expect(taken.has(label)).to.eq(false)
      taken.add(label)
    }
  })

  it('falls back once every attempt collides', () => {
    const label = Labelmaker.localBlankLabel(new Set(), 'fallback')
    const alwaysTaken = { has: () => true } as unknown as ReadonlySet<string>
    expect(Labelmaker.localBlankLabel(alwaysTaken, 'fallback-id')).to.eq('fallbackid')
    expect(label).to.not.eq('fallbackid')
  })

  it('makes a real label of an id-shaped fallback, which starts with a digit', () => {
    const alwaysTaken = { has: () => true } as unknown as ReadonlySet<string>
    const label = Labelmaker.localBlankLabel(alwaysTaken, '01k5f9n3ktq7wzc8x2r4m0vaeh')
    expect(label).to.eq('z01k5f9n3ktq7wzc8x2r4m0vaeh')
    expect(ValidatorKit.label.safeParse(label).success).to.eq(true)
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
    expect(ValidatorKit.label.safeParse(appended).success).to.eq(true)
  })

  it('mints a different id on each call', () => {
    expect(Labelmaker.appendFallback('otter')).to.not.eq(Labelmaker.appendFallback('otter'))
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

describe('effectiveLabelOf', () => {
  it('reads the generated label when there is no override', () => {
    expect(Labelmaker.effectiveLabelOf({ label: 'quiet_otter', forced_label: null })).to.eq('quiet_otter')
  })

  it('prefers the author\'s override over the generated label', () => {
    expect(Labelmaker.effectiveLabelOf({ label: 'quiet_otter', forced_label: 'leon' })).to.eq('leon')
  })
})

describe('entityForLabel', () => {
  const entities = [
    { label: 'quiet_otter', forced_label: null },
    { label: 'loud_gecko', forced_label: 'leon' },
  ]

  it('finds an entity by its generated label', () => {
    expect(Labelmaker.entityForLabel(entities, 'quiet_otter')).to.eq(entities[0])
  })

  it('finds an entity by its overriding label rather than its generated one', () => {
    expect(Labelmaker.entityForLabel(entities, 'leon')).to.eq(entities[1])
  })

  it('reads no match as undefined', () => {
    expect(Labelmaker.entityForLabel(entities, 'nobody')).to.eq(undefined)
  })
})
