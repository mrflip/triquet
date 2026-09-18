import { describe, expect, it } from 'vitest'
import { appendFallback, display, localBlankLabel, normalize, titleize, urlize } from '../../src/lib/label-maker'
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
      expect(normalize(input)).to.eq(expected)
    })
  }

  it('caps the cleaned body at maxlen before the letter/length repairs run', () => {
    expect(normalize('abcdefghij', { maxlen: 4 })).to.eq('abcd')
  })

  it('may run one character past maxlen when a letter must be prepended', () => {
    expect(normalize('9abcdefghij', { maxlen: 4 })).to.eq('z9abc')
  })

  it('always returns a valid label, even from adversarial input', () => {
    expect(ValidatorKit.label.safeParse(normalize('🎲🎲🎲')).success).to.eq(true)
  })
})

describe('localBlankLabel', () => {
  it('returns a label built from an adjective and an animal', () => {
    expect(localBlankLabel(new Set(), 'fallback')).to.match(/^[a-z]+_[a-z]+$/)
  })

  it('never returns a label already taken', () => {
    const taken = new Set<string>()
    for (let ii = 0; ii < 20; ii += 1) {
      const label = localBlankLabel(taken, 'fallback')
      expect(taken.has(label)).to.eq(false)
      taken.add(label)
    }
  })

  it('falls back once every attempt collides', () => {
    const label = localBlankLabel(new Set(), 'fallback')
    const alwaysTaken = { has: () => true } as unknown as ReadonlySet<string>
    expect(localBlankLabel(alwaysTaken, 'fallback-id')).to.eq('fallback-id')
    expect(label).to.not.eq('fallback-id')
  })
})

describe('appendFallback', () => {
  it('appends the given fallback after an underscore', () => {
    expect(appendFallback('otter', 'abc123')).to.eq('otter_abc123')
  })

  it('mints a fresh id when no fallback is given', () => {
    const appended = appendFallback('otter')
    expect(appended).to.match(/^otter_[0-9a-z]{26}$/)
  })

  it('mints a different id on each call', () => {
    expect(appendFallback('otter')).to.not.eq(appendFallback('otter'))
  })
})

describe('titleize', () => {
  it('reads an under_score label as Title Case words', () => {
    expect(titleize('quiet_otter')).to.eq('Quiet Otter')
  })
})

describe('urlize', () => {
  it('reads a label as under_score_case', () => {
    expect(urlize('Quiet Otter')).to.eq('quiet_otter')
  })
})

describe('display', () => {
  it('reads a label as kebab-case', () => {
    expect(display('quiet_otter')).to.eq('quiet-otter')
  })
})
