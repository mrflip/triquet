import { describe, expect, it } from 'vitest'
import * as Expressed from '../../src/lib/expressed'
import * as Sheets from '../../src/lib/sheets'
import { Column } from '../../src/models/column'
import { defaultLayoutFor, type Layout } from '../../src/models/layout'
import { SeedExpressions } from '../../src/models/expression'
import { Expressing } from '../../src/models/widget'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import type { IshItemT } from '../../src/models/ish'
import { present } from '../support/present'

const numeral = (text: string, value: number): IshItemT => ({ text, value, kind: 'numeral' })

/** A quiz of `questions` showing the given expressings, exported with the standard expressions */
function exported(questions: QuestionT[], layout: Layout = defaultLayoutFor(SeedExpressions)): string[][] {
  const quiz: QuizT = { ...Quiz.blank('Export'), questions, ...layout }
  const text = Sheets.sheetsExport(quiz, Expressed.forQuiz(quiz, SeedExpressions))
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

describe('sheetsExport', () => {
  it('opens with a header row naming every displayed column by its label, in alphabetical order', () => {
    const table = exported([Question.blank()])
    const labels = defaultLayoutFor(SeedExpressions).columns.map((column) => column.label)
    expect(table[0]).to.deep.eq(labels.toSorted((aa, bb) => aa.localeCompare(bb)))
  })

  it('leaves the grip out, which is not a column of the quiz', () => {
    const table = exported([Question.blank()])
    expect(present(table[0])).to.not.include('grip')
  })

  it('does not move when the columns are dragged about, only when one is added or removed', () => {
    const quiz: QuizT = { ...Quiz.blank('Export'), ...defaultLayoutFor(SeedExpressions), questions: [Question.blank()] }
    const shuffled = { ...quiz, columns: quiz.columns.toReversed() }
    const text = (held: QuizT) => Sheets.sheetsExport(held, Expressed.forQuiz(held, SeedExpressions))
    expect(text(shuffled)).to.eq(text(quiz))
  })

  it('follows the quiz\'s own columns, whatever they show', () => {
    const widget = Expressing.fill({ kind: 'expressing', label: 'backward', expression_label: 'answer_reversed' })
    const columns = [Column.fill({ label: 'zzz', title: 'Backward', source: 'backward', width_px: 78 }), Column.fill({ label: 'aaa', title: 'Answer', source: 'question.full_answer', width_px: 220 })]
    const table = exported([{ ...Question.blank(), qnum: '1', full_answer: 'stressed' }], { widgets: [widget], columns })
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
    const questions = [{ ...Question.blank(), qnum: '40', clueing_ishes: { status: 'done' as const, items: [], truncated: false, stale: false, updated_at: 1, last_err: null } }, { ...Question.blank(), qnum: '4' }]
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
    const question = { ...Question.blank(), qnum: '1', hint: 'BUT NOT my own hint', chains_to: target.id }
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

  it('carries the sum, the spans and the guess when there are some', () => {
    const question = {
      ...Question.blank(), qnum: '1', clueing: 'Which region?',
      clueing_ishes: { status: 'done' as const, items: [numeral('300', 300), numeral('17', 17)], truncated: false, stale: false, updated_at: 1, last_err: null },
      guess: { status: 'done' as const, text: 'Leon', truncated: false, updated_at: 1, last_err: null },
    }
    const table = exported([question])
    const cells = ['clueing_full', 'clueing_ishes', 'guess'].map((header) => cellOf(table, header, 0))
    expect(cells).to.deep.eq(['317', '300/17', 'Leon'])
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
