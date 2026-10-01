import { describe, expect, it } from 'vitest'
import * as Exposure from '../../src/lib/exposure'
import { defaultLayout } from '../../src/models/layout'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import type { StoredWidgetedT } from '../../src/models/widgeted'
import { Widgeting } from '../../src/models/widgeting'
import { present } from '../support/present'
import { runOf } from '../support/runs'

const layout = defaultLayout()
const quizOf = (questions = [Question.blank()]) => ({ ...Quiz.blank('Table'), ...layout, questions })
const tableOf = (quiz = quizOf()) => Exposure.tableOf(quiz, runOf(quiz))

/** A stored row of one widgeting for one question */
function storedRow(status: 'ok' | 'errored', value: StoredWidgetedT['value'] = null): StoredWidgetedT {
  return { status, value, message: status === 'ok' ? null : 'Too many requests.', result_meta: status === 'ok' ? { approx_tokens: 9 } : { response: { ok: false } }, _creationTime: 1000 }
}

describe('exposedColumnsOf', () => {
  const headers = Exposure.exposedColumnsOf(layout).map((column) => column.header)

  it('has a column for every exposed field of the questions themselves', () => {
    expect(headers).to.include.members(['question.title', 'question.clueing', 'question.label', 'question.chains_to', 'question.qnum'])
  })

  it('leaves out what is not exposed: the id, the label override, and what the widgetings stored on the question', () => {
    expect(headers).to.not.include.members(['question.id', 'question._id', 'question.forced_label', 'question.stored'])
  })

  it('has each widgeting\'s status and value under its label, whatever its formulary, and never its costs or failures', () => {
    expect(headers).to.include.members(['dumdum.status', 'dumdum.value', 'numnum_clueing.status', 'numnum_clueing.value', 'butnot_ishes.value', 'clueing_full.status'])
    expect(headers.filter((header) => /token|tier|err|message|result_meta|truncated|stale/.test(header))).to.deep.eq([])
  })

  it('has exactly two columns for each widgeting, its status and its value', () => {
    expect(headers.filter((header) => header.startsWith('clueing_full.'))).to.deep.eq(['clueing_full.status', 'clueing_full.value'])
  })

  it('names whose field each column is as its owner, and heads it `owner.field`', () => {
    const columns = Exposure.exposedColumnsOf(layout)
    expect(columns.every((column) => column.header === `${column.owner}.${column.field}`)).to.be.true
    expect(new Set(columns.map((column) => column.owner))).to.deep.eq(new Set(['question', ...layout.widgetings.map((widgeting) => widgeting.label)]))
  })

  it('is alphabetical by owner and then by field label, by code unit', () => {
    expect(headers.slice(0, 4)).to.deep.eq(['butnot_full.status', 'butnot_full.value', 'butnot_ishes.status', 'butnot_ishes.value'])
    const columns = Exposure.exposedColumnsOf(layout)
    const inOrder = columns.every((column, idx) => {
      const prev = columns[idx - 1]
      if (! prev) { return true }
      return prev.owner < column.owner || (prev.owner === column.owner && prev.field < column.field)
    })
    expect(inOrder).to.be.true
  })

  it('does not depend on the run order', () => {
    const shuffled = { widgetings: layout.widgetings.toReversed() }
    expect(Exposure.exposedColumnsOf(shuffled).map((column) => column.header)).to.deep.eq(headers)
  })

  it('does not depend on the columns the grid shows, only on the widgetings it has', () => {
    const fewer = { widgetings: layout.widgetings, columns: [] }
    expect(Exposure.exposedColumnsOf(fewer).map((column) => column.header)).to.deep.eq(headers)
  })

  it('gains the columns of a widgeting the quiz gains, in their alphabetical place', () => {
    const more = Exposure.exposedColumnsOf({ widgetings: [...layout.widgetings, Widgeting.fill({ label: 'aaa_first', widget_label: 'answer_reversed' })] })
    expect(more.slice(0, 2).map((column) => column.header)).to.deep.eq(['aaa_first.status', 'aaa_first.value'])
  })

  it('is only the questions\' own fields for a quiz with no widgetings', () => {
    expect(Exposure.exposedColumnsOf({ widgetings: [] }).map((column) => column.owner)).to.deep.eq(Question.exposed.map(() => 'question'))
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

  it('shows what a stored widgeting came to as text: its status, and its value as JSON', () => {
    const question = {
      ...Question.blank(),
      stored: {
        dumdum:         { newest: storedRow('ok', 'Lyon'), ok: storedRow('ok', 'Lyon') },
        numnum_clueing: { newest: storedRow('ok', { items: [{ text: '3', value: 3, kind: 'numeral' }] }), ok: storedRow('ok', { items: [{ text: '3', value: 3, kind: 'numeral' }] }) },
      },
    }
    const { header, rows } = tableOf(quizOf([question]))
    const cells = ['dumdum.status', 'dumdum.value', 'numnum_clueing.status', 'numnum_clueing.value'].map((each) => present(rows[0])[header.indexOf(each)])
    expect(cells).to.deep.eq(['ok', 'Lyon', 'ok', '{"items":[{"kind":"numeral","text":"3","value":3}]}'])
  })

  it('shows a widgeting that only failed as errored, with no value and nothing of the failure', () => {
    const question = { ...Question.blank(), stored: { dumdum: { newest: storedRow('errored'), ok: null } } }
    const { header, rows } = tableOf(quizOf([question]))
    expect(present(rows[0]).filter((_cell, idx) => present(header[idx]).startsWith('dumdum.'))).to.deep.eq(['errored', ''])
  })

  it('shows a widgeting never asked as missing, with an empty value', () => {
    const { header, rows } = tableOf()
    expect([header.indexOf('dumdum.status'), header.indexOf('dumdum.value')].map((idx) => present(rows[0])[idx])).to.deep.eq(['missing', ''])
  })

  it('shows a worked-out widgeting\'s value', () => {
    const items = [{ text: '3', value: 3, kind: 'numeral' }]
    const question = { ...Question.blank(), qnum: '1', stored: { numnum_clueing: { newest: storedRow('ok', { items }), ok: storedRow('ok', { items }) } } }
    const { header, rows } = tableOf(quizOf([question]))
    expect([header.indexOf('clueing_full.status'), header.indexOf('clueing_full.value')].map((idx) => present(rows[0])[idx])).to.deep.eq(['ok', '3'])
  })

  it('is a header and no rows for a quiz with no questions', () => {
    expect(tableOf(quizOf([])).rows).to.deep.eq([])
  })
})
