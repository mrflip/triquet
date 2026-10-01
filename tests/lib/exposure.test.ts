import { describe, expect, it } from 'vitest'
import * as Exposure from '../../src/lib/exposure'
import { SeedExpressions } from '../../src/models/expression'
import { defaultLayoutFor } from '../../src/models/layout'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { Expressing } from '../../src/models/widget'
import { present } from '../support/present'
import { runOf } from '../support/runs'

const layout = defaultLayoutFor(SeedExpressions)
const quizOf = (questions = [Question.blank()]) => ({ ...Quiz.blank('Table'), ...layout, questions })
const tableOf = (quiz = quizOf()) => Exposure.tableOf(quiz, runOf(quiz))

describe('exposedColumnsOf', () => {
  const headers = Exposure.exposedColumnsOf(layout).map((column) => column.header)

  it('has a column for every exposed field of the questions\' own widget', () => {
    expect(headers).to.include.members(['question.title', 'question.clueing', 'question.label', 'question.chains_to', 'question.qnum'])
  })

  it('leaves out what is not exposed: the id, the label override, and the bots\' answers held on the question', () => {
    expect(headers).to.not.include.members(['question.id', 'question.forced_label', 'question.guess', 'question.clueing_ishes'])
  })

  it('has each bot\'s exposed fields under the bot widget\'s label, and never its costs or failures', () => {
    expect(headers).to.include.members(['dumdum.status', 'dumdum.text', 'numnum_clueing.items', 'numnum_clueing.stale', 'numnum_hint.status'])
    expect(headers.filter((header) => /token|tier|updated|last_err|message|truncated/.test(header))).to.deep.eq([])
  })

  it('has one column for each expressing, its value', () => {
    expect(headers).to.include('clueing_full.value')
    expect(headers.filter((header) => header.startsWith('clueing_full.'))).to.deep.eq(['clueing_full.value'])
  })

  it('is alphabetical by widget label and then by field label', () => {
    const pairs = Exposure.exposedColumnsOf(layout).map((column) => [column.widget, column.field])
    expect(pairs).to.deep.eq(pairs.toSorted((aa, bb) => (String(aa[0]) === String(bb[0]) ? String(aa[1]).localeCompare(String(bb[1])) : String(aa[0]).localeCompare(String(bb[0])))))
  })

  it('does not depend on the order of the widgets', () => {
    const shuffled = { widgets: layout.widgets.toReversed() }
    expect(Exposure.exposedColumnsOf(shuffled).map((column) => column.header)).to.deep.eq(headers)
  })

  it('does not depend on the columns the grid shows, only on the widgets it has', () => {
    const fewer = { widgets: layout.widgets, columns: [] }
    expect(Exposure.exposedColumnsOf(fewer).map((column) => column.header)).to.deep.eq(headers)
  })

  it('gains the columns of a widget the quiz gains, in their alphabetical place', () => {
    const more = Exposure.exposedColumnsOf({ widgets: [...layout.widgets, Expressing.fill({ kind: 'expressing', label: 'aaa_first', expression_label: 'answer_reversed' })] })
    expect(more[0]?.header).to.eq('aaa_first.value')
  })
})

describe('tableOf', () => {
  it('has one row per question, ordered by label whatever order the quiz holds them in', () => {
    const [ante, post] = [{ ...Question.blank(), forced_label: 'alpha', title: 'A' }, { ...Question.blank(), forced_label: 'beta', title: 'B' }]
    const { header, rows } = tableOf(quizOf([post, ante]))
    const col = header.indexOf('question.title')
    expect(rows.map((row) => row[col])).to.deep.eq(['A', 'B'])
  })

  it('has as many cells in a row as headers', () => {
    const { header, rows } = tableOf()
    expect(rows.map((row) => row.length)).to.deep.eq([header.length])
  })

  it('names a chain by the target\'s label, and a label by the one in force', () => {
    const target = { ...Question.blank(), forced_label: 'the_film' }
    const question = { ...Question.blank(), forced_label: 'the_book', chains_to: target._id }
    const { header, rows } = tableOf(quizOf([question, target]))
    const chain = header.indexOf('question.chains_to')
    const label = header.indexOf('question.label')
    expect(rows.map((row) => [row[label], row[chain]])).to.deep.eq([['the_book', 'the_film'], ['the_film', '']])
  })

  it('shows what a bot answered as text: the status, the answer, the spans as JSON, whether stale', () => {
    const question = {
      ...Question.blank(),
      guess: { status: 'done' as const, text: 'Lyon', truncated: false, updated_at: 1, last_err: null },
      clueing_ishes: { status: 'done' as const, items: [{ text: '3', value: 3, kind: 'numeral' as const }], truncated: false, stale: true, updated_at: 1, last_err: null },
    }
    const { header, rows } = tableOf(quizOf([question]))
    const cells = ['dumdum.status', 'dumdum.text', 'numnum_clueing.items', 'numnum_clueing.stale'].map((each) => present(rows[0])[header.indexOf(each)])
    expect(cells).to.deep.eq(['done', 'Lyon', '[{"kind":"numeral","text":"3","value":3}]', 'true'])
  })

  it('shows a bot never asked as empty cells', () => {
    const { header, rows } = tableOf()
    expect(present(rows[0])[header.indexOf('dumdum.status')]).to.eq('')
  })

  it('shows an expressing\'s value', () => {
    const question = { ...Question.blank(), qnum: '1', clueing_ishes: { status: 'done' as const, items: [{ text: '3', value: 3, kind: 'numeral' as const }], truncated: false, stale: false, updated_at: 1, last_err: null } }
    const { header, rows } = tableOf(quizOf([question]))
    expect(present(rows[0])[header.indexOf('clueing_full.value')]).to.eq('3')
  })

  it('is a header and no rows for a quiz with no questions', () => {
    expect(tableOf(quizOf([])).rows).to.deep.eq([])
  })
})

