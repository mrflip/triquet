import { describe, expect, it } from 'vitest'
import * as Sheets from '../../src/lib/sheets'
import { Column } from '../../src/models/column'
import { defaultLayout, type Layout } from '../../src/models/layout'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { Widgeted, type JsonT, type WidgetedHistoryT, type WidgetedT } from '../../src/models/widgeted'
import { Widgeting } from '../../src/models/widgeting'
import type { IshItemT } from '../../src/models/ish'
import { present } from '../support/present'
import { runHolding, runOf } from '../support/runs'

const numeral = (text: string, value: number): IshItemT => ({ text, value, kind: 'numeral' })

/** A cell whose newest row, and newest `ok` row, both hold `value` */
function answered(value: JsonT): WidgetedHistoryT {
  const row = { status: 'ok' as const, value, message: null, result_meta: {}, _creationTime: 1000 }
  return { newest: row, ok: row }
}

/** A quiz of `questions` showing the given widgetings and columns, exported with the seed widgets */
function exported(questions: QuestionT[], layout: Layout = defaultLayout()): string[][] {
  const quiz: QuizT = { ...Quiz.blank('Export'), questions, ...layout }
  const text = Sheets.sheetsExport(quiz, runOf(quiz))
  return text === '' ? [] : text.split('\n').map((line) => line.split('\t'))
}

/** The cell of the column headed `header`, in the row at `rowIdx` (0 is the first question) */
function cellOf(table: string[][], header: string, rowIdx: number): string {
  const col = present(table[0]).indexOf(header)
  expect(col, `a column headed ${header}`).to.be.greaterThan(-1)
  return present(present(table[rowIdx + 1])[col])
}

const PasteCases: [string, string, string][] = [
  // regular usage:
  ["plain text",       "plain text",         'text with nothing dangerous in it is untouched'],
  ["two\nlines",       "two<br/>lines",      'a line break would look like a new row, so it becomes a tag'],
  ["two\r\nlines",     "two<br/>lines",      'a Windows line break counts once, not twice'],
  ["old\rmac",         "old<br/>mac",        'a lone carriage return counts too'],
  ["a\tb",             "a b",                'a tab would look like an extra column, so it becomes a space'],
  // trivial cases:
  ["",                 "",                   'empty text stays empty'],
  // weird cases:
  ["L'Iñtërnâtiôñ\t.", "L'Iñtërnâtiôñ .",    'non-Latin text survives the scrub'],
]

describe('pasteSafe', () => {
  for (const [text, expected, blurb] of PasteCases) {
    it(blurb, () => {
      expect(Sheets.pasteSafe(text)).to.eq(expected)
    })
  }
})

describe('cellTextOf', () => {
  const question = Question.blank()
  const run = runHolding({ questions: [question] }, { col: { [question._id]: Widgeted.ok('x') } })
  const widgeting = Widgeting.fill({ label: 'col', widget_label: 'whatever' })
  const textFor = (widgeted: WidgetedT) => Sheets.cellTextOf({ kind: 'widgeting', widgeting }, { question, target: null, run: runHolding({ questions: [question] }, { col: { [question._id]: widgeted } }) })

  const Cases: [WidgetedT, string, string][] = [
    // widgeted                                                     text                          blurb
    [Widgeted.ok('Leon'),                                           "Leon",                       'a string value is written as itself'],
    [Widgeted.ok(312),                                              "312",                        'a number is written as its digits'],
    [Widgeted.ok(false),                                            "false",                      'a boolean is written as its word'],
    [Widgeted.ok({ guess: 'Leon', explanation: '' }),               '{"explanation":"","guess":"Leon"}', 'an object is written as its JSON, keys in order'],
    [Widgeted.ok([1, 2]),                                           "[1,2]",                      'a list is written as its JSON'],
    [Widgeted.ok(null),                                             "null",                       'a null value is written as its JSON'],
    [Widgeted.missing,                                              "",                           'nothing is written as nothing'],
    [Widgeted.errored({ message: 'no', at: 1, response: null }),    "",                           'a failure is written as nothing, not its message'],
  ]
  for (const [widgeted, expected, blurb] of Cases) {
    it(blurb, () => {
      expect(textFor(widgeted)).to.eq(expected)
    })
  }

  it('writes a field as the question holds it, and the chain as the target\'s label', () => {
    const target = { ...Question.blank(), forced_label: 'the_film', hint: 'BUT NOT the film' }
    const chained = { ...Question.blank(), clueing: 'Who?', chains_to: target._id }
    expect(Sheets.cellTextOf({ kind: 'field', field: 'clueing' }, { question: chained, target, run })).to.eq('Who?')
    expect(Sheets.cellTextOf({ kind: 'field', field: 'chains_to' }, { question: chained, target, run })).to.eq('the_film')
    expect(Sheets.cellTextOf({ kind: 'view', view: 'butnot' }, { question: chained, target, run })).to.eq('BUT NOT the film')
    expect(Sheets.cellTextOf({ kind: 'view', view: 'butnot' }, { question: chained, target: null, run })).to.eq('')
  })
})

describe('sheetsExport', () => {
  it('opens with a header row naming every displayed column by its label, in alphabetical order', () => {
    const table = exported([Question.blank()])
    const labels = defaultLayout().columns.map((column) => column.label)
    expect(table[0]).to.deep.eq(labels.toSorted((aa, bb) => aa.localeCompare(bb)))
  })

  it('heads the standard layout with its question fields first', () => {
    const quiz: QuizT = { ...Quiz.blank('Export'), ...defaultLayout(), questions: [Question.blank()] }
    expect(Sheets.sheetsExport(quiz, runOf(quiz)).split('\n', 1)[0]).to.match(/^alt_text\tbutnot\t/)
  })

  it('leaves the grip out, which is not a column of the quiz', () => {
    const table = exported([Question.blank()])
    expect(present(table[0])).to.not.include('grip')
  })

  it('does not move when the columns are dragged about, only when one is added or removed', () => {
    const quiz: QuizT = { ...Quiz.blank('Export'), ...defaultLayout(), questions: [Question.blank()] }
    const shuffled = { ...quiz, columns: quiz.columns.toReversed() }
    const text = (held: QuizT) => Sheets.sheetsExport(held, runOf(held))
    expect(text(shuffled)).to.eq(text(quiz))
  })

  it('follows the quiz\'s own columns, whatever they show', () => {
    const widgeting = Widgeting.fill({ label: 'backward', widget_label: 'answer_reversed' })
    const columns = [Column.fill({ label: 'zzz', title: 'Backward', source: 'backward', width_px: 78 }), Column.fill({ label: 'aaa', title: 'Answer', source: 'question.full_answer', width_px: 220 })]
    const table = exported([{ ...Question.blank(), qnum: '1', full_answer: 'stressed' }], { widgetings: [widgeting], columns })
    expect(table[0]).to.deep.eq(['aaa', 'zzz'])
    expect(table[1]).to.deep.eq(['stressed', 'desserts'])
  })

  it('has as many fields in every line as in the header', () => {
    const table = exported([{ ...Question.blank(), clueing: 'two\nlines', notes: 'a\tb' }, Question.blank()])
    const widths = table.map((fields) => fields.length)
    expect(widths).to.deep.eq(widths.map(() => present(widths[0])))
  })

  it('goes out in rank order however the grid is arranged', () => {
    const questions = [
      { ...Question.blank(), qnum: '3', clueing: 'third' },
      { ...Question.blank(), qnum: '1', clueing: 'first' },
      { ...Question.blank(), qnum: '2', clueing: 'second' },
    ]
    const table = exported(questions)
    expect([0, 1, 2].map((rowIdx) => cellOf(table, 'clueing', rowIdx))).to.deep.eq(['first', 'second', 'third'])
  })

  it('carries the raw Q#, and the rank through a computed column', () => {
    const questions = [{ ...Question.blank(), qnum: '40', stored: { numnum_clueing: answered({ items: [] }) } }, { ...Question.blank(), qnum: '4' }]
    const table = exported(questions)
    expect(cellOf(table, 'qnum', 0)).to.eq('4')
    expect(cellOf(table, 'qnum', 1)).to.eq('40')
    expect(cellOf(table, 'clueing_plus_rank', 1)).to.eq('2')
  })

  it('puts an unranked question last, with its Q# blank', () => {
    const table = exported([{ ...Question.blank(), qnum: '', clueing: 'unranked' }, { ...Question.blank(), qnum: '1', clueing: 'first' }])
    expect([cellOf(table, 'clueing', 0), cellOf(table, 'qnum', 1)]).to.deep.eq(['first', ''])
  })

  it('names the chained-to question by label, and carries its hint as the BUT NOT column', () => {
    const target = { ...Question.blank(), qnum: '2', forced_label: 'the_film', hint: 'BUT NOT the film' }
    const question = { ...Question.blank(), qnum: '1', hint: 'BUT NOT my own hint', chains_to: target._id }
    const table = exported([question, target])
    expect(cellOf(table, 'chains_to', 0)).to.eq('the_film')
    expect(cellOf(table, 'butnot', 0)).to.eq('BUT NOT the film')
    expect(cellOf(table, 'hint', 0)).to.eq('BUT NOT my own hint')
    expect(cellOf(table, 'chains_to', 1)).to.eq('')
  })

  it('carries the notes columns, the title and the long answer through', () => {
    const table = exported([{ ...Question.blank(), qnum: '1', title: 'Leon', full_answer: 'The long one', alt_text: 'alt', notes: 'note' }])
    const cells = ['title', 'full_answer', 'alt_text', 'notes'].map((header) => cellOf(table, header, 0))
    expect(cells).to.deep.eq(['Leon', 'The long one', 'alt', 'note'])
  })

  it('leaves the sum blank when nothing has been extracted', () => {
    const table = exported([{ ...Question.blank(), qnum: '1' }])
    expect(cellOf(table, 'clueing_full', 0)).to.eq('')
  })

  it('carries the sum, and writes the spans and the guess, which are objects, as their JSON', () => {
    const question = {
      ...Question.blank(), qnum: '1', clueing: 'Which region?',
      stored: {
        numnum_clueing: answered({ items: [numeral('300', 300), numeral('17', 17)] }),
        dumdum:         answered({ guess: 'Leon', explanation: 'The lion.' }),
      },
    }
    const table = exported([question])
    const cells = ['clueing_full', 'clueing_ishes', 'guess'].map((header) => cellOf(table, header, 0))
    expect(cells).to.deep.eq([
      '317',
      '{"items":[{"kind":"numeral","text":"300","value":300},{"kind":"numeral","text":"17","value":17}]}',
      '{"explanation":"The lion.","guess":"Leon"}',
    ])
  })

  it('carries the chained-to question\'s spans through the BUT NOT ishes widgeting', () => {
    const target = { ...Question.blank(), qnum: '2', stored: { numnum_hint: answered({ items: [numeral('7', 7)] }) } }
    const question = { ...Question.blank(), qnum: '1', chains_to: target._id }
    const table = exported([question, target])
    expect([cellOf(table, 'butnot_ishes', 0), cellOf(table, 'butnot_ishes', 1)]).to.deep.eq(['{"items":[{"kind":"numeral","text":"7","value":7}]}', ''])
  })

  it('writes a value of plain text as itself, and its line breaks safely', () => {
    const widgeting = Widgeting.fill({ label: 'backward', widget_label: 'answer_reversed' })
    const columns = [Column.fill({ label: 'backward', title: 'Backward', source: 'backward', width_px: 78 })]
    const table = exported([{ ...Question.blank(), qnum: '1', full_answer: 'ab\ncd' }], { widgetings: [widgeting], columns })
    expect(cellOf(table, 'backward', 0)).to.eq('dc<br/>ba')
  })

  it('never lets a field\'s own line break start a new spreadsheet row', () => {
    const table = exported([{ ...Question.blank(), qnum: '1', clueing: 'two\nlines', notes: 'a\tb' }])
    expect(table).to.have.length(2)
    expect(cellOf(table, 'clueing', 0)).to.eq('two<br/>lines')
    expect(cellOf(table, 'notes', 0)).to.eq('a b')
  })

  it('reads a quiz with no questions as an empty export, not a lone header', () => {
    expect(exported([])).to.deep.eq([])
  })
})
