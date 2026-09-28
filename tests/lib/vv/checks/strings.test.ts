import { describe, expect, it } from 'vitest'
import * as CK from '../../../../src/lib/vv/checks/strings'
import { accepts, rejects } from '../../../support/checking'

const Ctrl = '\u{1}'
const Nul  = '\u{0}'

describe('character sets', () => {
  const Cases: [keyof typeof CK, string[], string[]][] = [
    // check            accepted                             refused
    ['lower',           ['abc', 'a b c', '123', ','],        ['Abc', 'ABC']],
    ['upper',           ['ABC', 'A B C', '123', ','],        ['abc', 'Abc']],
    ['alnum',           ['abc123', 'ABC', ''],               ['a-b', 'a_b', 'a b']],
    ['alnumbar',        ['abc_123', 'ABC', ''],              ['a-b', 'a b']],
    ['azalnum',         ['a1', 'Abc123'],                    ['1abc', '_abc', '']],
    ['azalnumbar',      ['a_1', 'Abc_123'],                  ['1abc', '_abc', '']],
    ['loazalnumbar',    ['a_1', 'abc_123'],                  ['Abc', '1abc', '_abc']],
    ['upazalnumbar',    ['A_1', 'ABC_123'],                  ['abc', '1ABC', '_ABC']],
    ['plain',           ['abc 123', 'ABC', ''],              ['a_b', 'a-b', 'élan']],
    ['asciish',         ['abc!~', ''],                       ['élan']],
    ['stringish',       ['abc', 'a b', ''],                  [`a${Ctrl}b`]],
    ['textish',         ['abc', ''],                         [`a${Ctrl}b`, `a${Nul}b`]],
  ]

  for (const [ckname, good, bad] of Cases) {
    describe(ckname, () => {
      for (const val of good) {
        it(`takes ${JSON.stringify(val)}`, () => { accepts(CK[ckname], val) })
      }
      for (const val of bad) {
        it(`refuses ${JSON.stringify(val)}`, () => { rejects(CK[ckname], val) })
      }
    })
  }

  it('trims before checking, so surrounding space is not an error', () => {
    expect(accepts(CK.lower, '  abc  ')).to.eq('abc')
    expect(accepts(CK.trimmed, '\tabc\n')).to.eq('abc')
  })
  it('textish tolerates a newline where stringish does not', () => {
    accepts(CK.textish, 'one\ntwo')
    rejects(CK.stringish, 'one\ntwo')
  })
  it('textish keeps the text exactly as written, where noteish trims it', () => {
    expect(accepts(CK.textish, '  indented verse\n')).to.eq('  indented verse\n')
    expect(accepts(CK.noteish, '  a note\n')).to.eq('a note')
  })
  it('loalnumbar lowercases rather than refusing', () => {
    expect(accepts(CK.loalnumbar, 'ABC_1')).to.eq('abc_1')
  })
  it('upalnumbar uppercases rather than refusing', () => {
    expect(accepts(CK.upalnumbar, 'abc_1')).to.eq('ABC_1')
  })
})

describe('lengths', () => {
  const Caps: [keyof typeof CK, number][] = [
    ['shortstr', 15], ['medstr', 40], ['fullstr', 82], ['bigstr', 200], ['titleish', 82], ['formulaish', 999],
  ]
  for (const [ckname, cap] of Caps) {
    it(`${ckname} takes ${String(cap)} characters and refuses one more`, () => {
      accepts(CK[ckname], 'x'.repeat(cap))
      rejects(CK[ckname], 'x'.repeat(cap + 1))
    })
  }
  it('textish and noteish take a paragraph, newlines and all, up to 3600 characters', () => {
    for (const check of [CK.textish, CK.noteish]) {
      accepts(check, 'a note\nover two lines')
      accepts(check, 'x'.repeat(3600))
      rejects(check, 'x'.repeat(3601))
    }
  })
  it('formulaish takes a formula laid out over lines, untrimmed, and never an empty one', () => {
    expect(accepts(CK.formulaish, '  (\n  $sum(a)\n)  ')).to.eq('  (\n  $sum(a)\n)  ')
    rejects(CK.formulaish, '')
    rejects(CK.formulaish, `a${Ctrl}b`)
  })
  it('noteish measures after trimming, so surrounding space never costs length', () => {
    accepts(CK.noteish, ` ${'x'.repeat(3600)} `)
  })
  it('blobbish lets you get carried away, but not indefinitely', () => {
    accepts(CK.blobbish, 'x'.repeat(800_800))
    rejects(CK.blobbish, 'x'.repeat(800_801))
  })
})

describe('identifiers', () => {
  const Cases: [keyof typeof CK, string[], string[]][] = [
    ['label',     ['abc', 'a_1', 'ab', 'x'.repeat(40)],  ['Abc', '1abc', 'a-b', '', 'a', 'abc_', 'x'.repeat(41)]],
    ['dashlabel', ['a-b', 'abc', 'a_1'],      ['Abc', '1abc', '']],
    ['identlabel', ['sixsix', 'flip_k', 'a1b2c3', 'x'.repeat(24)], ['fivee', 'Flipper', '1flipper', 'flip__k', 'flipper_', 'x'.repeat(25)]],
    ['handleish', ['abc', 'a_1'],             ['Abc', '1abc', 'a-b', '', 'x'.repeat(37)]],
    ['camel',     ['Abc', 'A1', 'AbcDef'],    ['abc', '1Abc', '_Abc', 'A_1', ',']],
    ['locamel',   ['abC', 'aB1'],             ['Abc', '1abc', '_abc', 'a_1', ',']],
    ['varname',   ['a', 'a_1', 'Abc'],        ['1abc', '_abc', '', ',']],
    ['snake',     ['a_b', 'abc'],             ['Abc', '1abc', 'a-b']],
    ['keyish',    ['a/b.c-d_e:f', 'abc'],     ['a b', '']],
    ['convexid',  ['j97d0qbj35dar1v8edndzckvsx8f828f', '0000000000000000000000001quizzes'], ['abc', '', 'J97D0QBJ35DAR1V8EDNDZCKVSX8F828F', '3f0c9b1e-5d7a-4c2e-9f3b-8a1d6e2c4b70']],
  ]
  for (const [ckname, good, bad] of Cases) {
    describe(ckname, () => {
      for (const val of good) {
        it(`takes ${JSON.stringify(val)}`, () => { accepts(CK[ckname], val) })
      }
      for (const val of bad) {
        it(`refuses ${JSON.stringify(val)}`, () => { rejects(CK[ckname], val) })
      }
    })
  }
})

// A pattern's advice IS its contract: it is the only thing telling a caller what shape was
// wanted. These pin the phrasings worth keeping. Everything about how a message is assembled
// is tested once, in reporting.test.ts, rather than again at every check.
describe('the advice each pattern gives', () => {
  const Cases: [keyof typeof CK, string, string][] = [
    ['label',     'Abc',       'should have only plain lowercase letters/_/numbers, with a letter first, a letter or number last, and no __ in a row'],
    ['handleish', 'Abc',       'should be all lowercase'],
    ['camel',     'abc',       'should be an UpperFirstLetterCamelCased name'],
    ['locamel',   'Abc',       'should be a lowerFirstLetterCamelCased name'],
    ['varname',   '1abc',      'should be a label and start with a letter'],
    ['upper',     'abc',       'should be all uppercase'],
    ['lower',     'ABC',       'should be all lowercase'],
    ['textish',   `a${Ctrl}b`, 'has weird characters'],
    ['stringish', 'a\tb',      'has tabs, returns or weird characters'],
  ]
  for (const [ckname, val, wanted] of Cases) {
    it(`${ckname} says "${wanted}"`, () => {
      expect(rejects(CK[ckname], val)).to.include(wanted)
    })
  }
  it('leads the advice with the offending value', () => {
    expect(rejects(CK.camel, 'abc')).to.eq("«'abc'» should be an UpperFirstLetterCamelCased name")
  })
  it('reports every way a value is wrong, not just the first', () => {
    // `label` is lowercase AND label-shaped; 'Abc' breaks both, and says so.
    const said = rejects(CK.label, 'Abc')
    expect(said).to.include('should be all lowercase')
    expect(said).to.include('with a letter first')
    expect(said).to.include(';; ')
  })
  it('renders a control character visibly rather than emitting it', () => {
    expect(rejects(CK.textish, `a${Ctrl}b`)).to.include('~^x01')
  })
})
