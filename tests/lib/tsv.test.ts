import { describe, expect, it } from 'vitest'
import * as Tsv from '../../src/lib/tsv'

/** `text`'s lines, each split into its cells, the trailing newline taken off */
function linesOf(text: string): string[][] {
  return text.slice(0, -1).split('\n').map((line) => line.split('\t'))
}

describe('textOf', () => {
  it("reads the doc block's examples", () => {
    expect(Tsv.textOf([{ label: 'nantes', qnum: '2' }, { label: 'leon', qnum: '1', dumdum: { status: 'ok' } }]))
      .to.eq('dumdum.status\tlabel\tqnum\nok\tleon\t1\n\tnantes\t2\n')
    expect(Tsv.textOf([])).to.eq('label\n')
  })

  it("heads the table with every key path any row holds, sorted by code unit, not by locale", () => {
    const [header] = linesOf(Tsv.textOf([{ label: 'leon', title: 'x', Zed: 'z' }, { label: 'nantes', alt_text: 'y', widgetings: { b: { position: 1 }, a: { position: 0 } } }]))
    expect(header).to.deep.eq(['Zed', 'alt_text', 'label', 'title', 'widgetings.a.position', 'widgetings.b.position'])
  })

  it("puts the rows in order of label, whatever order they came in", () => {
    const text = Tsv.textOf([{ label: 'paris' }, { label: 'leon' }, { label: 'nantes' }])
    expect(linesOf(text).slice(1).map(([label]) => label)).to.deep.eq(['leon', 'nantes', 'paris'])
  })

  it("leaves empty a cell for a field its row lacks, or holds as null or undefined", () => {
    const text = Tsv.textOf([{ label: 'leon', hint: 'h', notes: null }, { label: 'nantes', notes: 'n', hint: undefined }])
    expect(linesOf(text)).to.deep.eq([['hint', 'label', 'notes'], ['h', 'leon', ''], ['', 'nantes', 'n']])
  })

  it("writes no column for a field that is undefined in every row, as its JSON holds none", () => {
    expect(Tsv.textOf([{ label: 'leon', hint: undefined }])).to.eq('label\nleon\n')
  })

  it("keeps one line to a row, whatever a cell holds", () => {
    const text = Tsv.textOf([{ label: 'leon', notes: 'two\nlines\r\nand\ta tab' }, { label: 'nantes', notes: 'plain' }])
    expect(text.split('\n')).to.have.lengthOf(4)
    expect(linesOf(text).map((cells) => cells.length)).to.deep.eq([2, 2, 2])
  })

  it("keeps the header to one line, whatever a key holds", () => {
    const text = Tsv.textOf([{ label: 'leon', value: { 'two\nlines': 1, 'a\ttab': 2 } }])
    expect(linesOf(text)).to.deep.eq([['label', String.raw`value.a\ttab`, String.raw`value.two\nlines`], ['leon', '2', '1']])
  })

  it("is the same text for the same rows, however their keys were built", () => {
    expect(Tsv.textOf([{ label: 'leon', title: 't', hint: 'h' }])).to.eq(Tsv.textOf([{ hint: 'h', title: 't', label: 'leon' }]))
  })

  it("ends every line, the last included, in a newline", () => {
    expect(Tsv.textOf([{ label: 'leon' }]).endsWith('leon\n')).to.be.true
  })
})

describe('recordsOf', () => {
  it("reads the doc block's example", () => {
    expect(Tsv.recordsOf({ leon: { position: 0 } })).to.deep.eq([{ position: 0, label: 'leon' }])
  })

  it("labels each member with the key it sits under, over any label of its own", () => {
    expect(Tsv.recordsOf({ leon: { label: 'stale' }, nantes: {} })).to.deep.eq([{ label: 'leon' }, { label: 'nantes' }])
  })

  it("is no rows for an empty collection", () => {
    expect(Tsv.recordsOf({})).to.deep.eq([])
  })
})

const CellTestCases = [
  // regular usage:
  ["Leon",                 "Leon",                  'a plain string, as it is'],
  [42,                     "42",                    'a number, as JSON writes it'],
  [-0.5,                   "-0.5",                  'a fraction, as JSON writes it'],
  [true,                   "true",                  'a boolean, as JSON writes it'],
  [false,                  "false",                 'false, not empty'],
  [0,                      "0",                     'zero, not empty'],
  // nothing to say:
  [null,                   "",                      'null, as nothing'],
  [undefined,              "",                      'undefined, as nothing'],
  ["",                     "",                      'the empty string, as nothing'],
  // what would break a row:
  ["two\nlines",           String.raw`two\nlines`,  'a line break, escaped'],
  ["one\r\ntwo",           String.raw`one\r\ntwo`,  'a carriage return, escaped'],
  ["a\tb",                 String.raw`a\tb`,        'a tab, escaped'],
  [String.raw`C:\new`,     String.raw`C:\\new`,     'a backslash, doubled, so it never reads as an escape'],
  ['say "hi"',             'say "hi"',              'a quote, as it is: nothing quotes a cell'],
  // what is not a string:
  [["a", "b"],             '["a","b"]',             'a list, as compact JSON'],
  [[],                     "[]",                    'an empty list, as compact JSON'],
  [{},                     "{}",                    'an empty object, as compact JSON'],
  [[{ b: 1, a: "x\ty" }],  String.raw`[{"a":"x\\ty","b":1}]`, 'a list of objects, keys sorted, its escapes escaped again'],
] as const

describe('cellOf', () => {
  it("reads the doc block's examples", () => {
    expect(Tsv.cellOf('two\nlines')).to.eq(String.raw`two\nlines`)
    expect(Tsv.cellOf(['a', 'b'])).to.eq('["a","b"]')
    expect(Tsv.cellOf(null)).to.eq('')
  })

  for (const [val, expected, why] of CellTestCases) {
    it(why, () => {
      expect(Tsv.cellOf(val)).to.eq(expected)
    })
  }
})
