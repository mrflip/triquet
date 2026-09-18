import { describe, expect, it } from 'vitest'
import * as Sheets from '../../src/lib/sheets'
import { Question, type QuestionT } from '../../src/models/question'
import type { IshItemT } from '../../src/models/ish'
import { present } from '../support/present'

const numeral = (text: string, value: number): IshItemT => ({ text, value, kind: 'numeral' })

/** The fields of the line at `lineIdx` */
function fieldsOf(questions: QuestionT[], lineIdx: number): string[] {
  return present(Sheets.sheetsExport(questions).split('\n')[lineIdx]).split('\t')
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

describe('foldButnot', () => {
  it('joins a clueing to a hint that already says BUT NOT', () => {
    expect(Sheets.foldButnot('Which region?', 'BUT NOT the film')).to.eq('Which region? ... BUT NOT the film')
  })

  it('supplies the phrase when the hint does not carry it', () => {
    expect(Sheets.foldButnot('Which region?', 'the film')).to.eq('Which region? ... BUT NOT ... the film')
  })

  it('leaves the clueing alone when there is no hint to fold in', () => {
    expect(Sheets.foldButnot('Which region?', '')).to.eq('Which region?')
    expect(Sheets.foldButnot('Which region?', ' '.repeat(3))).to.eq('Which region?')
  })

  it('does not care how the hint is capitalised', () => {
    expect(Sheets.foldButnot('Q?', 'but not the film')).to.eq('Q? ... but not the film')
  })
})

describe('sheetsExport', () => {
  it('emits seven fields per question', () => {
    const questions = [{ ...Question.blank(), qnum: '1', clueing: 'Which region?' }]
    expect(fieldsOf(questions, 0)).to.have.length(Sheets.SheetsFieldCount)
  })

  it('goes out in rank order however the grid is arranged', () => {
    const questions = [
      { ...Question.blank(), qnum: '3', clueing: 'third' },
      { ...Question.blank(), qnum: '1', clueing: 'first' },
      { ...Question.blank(), qnum: '2', clueing: 'second' },
    ]
    const clueings = Sheets.sheetsExport(questions).split('\n').map((line) => present(line.split('\t', 2)[1]))
    expect(clueings).to.deep.eq(['first', 'second', 'third'])
  })

  it('numbers by rank, not by the raw Q#, so a gappy draft still pastes 1, 2, 3', () => {
    const questions = [
      { ...Question.blank(), qnum: '4', clueing: 'a' },
      { ...Question.blank(), qnum: '9.5', clueing: 'b' },
      { ...Question.blank(), qnum: '40', clueing: 'c' },
    ]
    const ranks = Sheets.sheetsExport(questions).split('\n').map((line) => present(line.split('\t', 1)[0]))
    expect(ranks).to.deep.eq(['1', '2', '3'])
  })

  it('leaves the rank blank for an unranked question, and puts it last', () => {
    const questions = [
      { ...Question.blank(), qnum: '', clueing: 'unranked' },
      { ...Question.blank(), qnum: '1', clueing: 'first' },
    ]
    expect(fieldsOf(questions, 1)[0]).to.eq('')
    expect(fieldsOf(questions, 1)[1]).to.eq('unranked')
  })

  it('folds in the chained-to question\'s hint, not this question\'s own', () => {
    const target = { ...Question.blank(), qnum: '2', clueing: 'second', hint: 'BUT NOT the film' }
    const question = { ...Question.blank(), qnum: '1', clueing: 'Which region?', hint: 'BUT NOT my own hint', chains_to: target.id }
    expect(fieldsOf([question, target], 0)[1]).to.eq('Which region? ... BUT NOT the film')
  })

  it('carries the notes columns and the long answer through', () => {
    const questions = [{ ...Question.blank(), qnum: '1', full_answer: 'The long one', alt_text: 'alt', notes: 'note' }]
    expect(fieldsOf(questions, 0).slice(2, 5)).to.deep.eq(['The long one', 'alt', 'note'])
  })

  it('leaves the sum blank when nothing has been extracted', () => {
    const questions = [{ ...Question.blank(), qnum: '1', clueing: 'Which region?' }]
    expect(fieldsOf(questions, 0)[5]).to.eq('')
  })

  it('carries the sum and the spans when something has', () => {
    const questions = [{
      ...Question.blank(), qnum: '1', clueing: 'Which region?',
      clueing_ishes: { status: 'done' as const, items: [numeral('300', 300), numeral('17', 17)], truncated: false, stale: false, updated_at: 1 },
    }]
    expect(fieldsOf(questions, 0)[5]).to.eq('317')
    expect(fieldsOf(questions, 0)[6]).to.eq('300/17')
  })

  it('never lets a field\'s own line break start a new spreadsheet row', () => {
    const questions = [{ ...Question.blank(), qnum: '1', clueing: 'two\nlines', notes: 'a\tb' }]
    expect(Sheets.sheetsExport(questions).split('\n')).to.have.length(1)
    expect(fieldsOf(questions, 0)).to.have.length(Sheets.SheetsFieldCount)
  })

  it('reads an empty quiz as an empty export', () => {
    expect(Sheets.sheetsExport([])).to.eq('')
  })
})
