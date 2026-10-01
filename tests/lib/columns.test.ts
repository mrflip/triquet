import { describe, expect, it } from 'vitest'
import { GutterWidthPx, gridWidthPx, qnumSortkeyOf, resolve, specFor, specsFor } from '../../src/lib/columns'
import { Column } from '../../src/models/column'
import { defaultLayout } from '../../src/models/layout'
import { Widgeting } from '../../src/models/widgeting'
import { present } from '../support/present'

const layout = defaultLayout()
const widgetings = [
  Widgeting.fill({ label: 'dumdum', widget_label: 'dumdum' }),
  Widgeting.fill({ label: 'numnum_hint', widget_label: 'numnum_hint' }),
  Widgeting.fill({ label: 'total', widget_label: 'clueing_full' }),
]
const columnOf = (source: string, width_px = 100, label = 'col') => Column.fill({ label, title: 'Col', source, width_px })

describe('resolve', () => {
  it('finds a question field, a view, and a widgeting by its label, whatever widget it works', () => {
    expect(resolve('question.clueing', widgetings)).to.deep.eq({ kind: 'field', field: 'clueing' })
    expect(resolve('question.butnot', widgetings)).to.deep.eq({ kind: 'view', view: 'butnot' })
    expect(resolve('total', widgetings)).to.deep.eq({ kind: 'widgeting', widgeting: widgetings[2] })
    expect(resolve('numnum_hint', widgetings)).to.deep.eq({ kind: 'widgeting', widgeting: widgetings[1] })
  })

  it('finds a field with no widgetings at all', () => {
    expect(resolve('question.clueing', [])).to.deep.eq({ kind: 'field', field: 'clueing' })
  })

  it('finds nothing for a widgeting the quiz does not have, nor by the widget it works', () => {
    expect(resolve('nowhere', widgetings)).to.be.null
    expect(resolve('clueing_full', widgetings)).to.be.null
  })
})

describe('specFor', () => {
  const Cases: [string, number, string, boolean, string][] = [
    // source                 width  headkind    sortable  blurb
    ['question.title',        100,   'plain',    true,     'a title is along the row, and orders the quiz'],
    ['question.clueing',      330,   'plain',    false,    'prose is not ordered'],
    ['question.qnum',         60,    'plain',    true,     'Q# orders the quiz'],
    ['question.butnot',       180,   'plain',    false,    'the chained hint is prose'],
    ['numnum_hint',           170,   'plain',    true,     'a number spotter\'s widgeting orders the quiz, its header along the row'],
    ['dumdum',                160,   'plain',    true,     'a guess is a widgeting like any other'],
    ['total',                 78,    'vertical', true,     'a narrow widgeting column turns its header on its side'],
    ['total',                 100,   'vertical', true,     'a widgeting column a hundred wide is still narrow'],
    ['total',                 180,   'plain',    true,     'a wide widgeting column lays it along the row'],
    ['question.title',        60,    'plain',    true,     'a narrow field column keeps its header along the row'],
  ]
  for (const [source, width, headkind, isSortable, blurb] of Cases) {
    it(blurb, () => {
      const spec = present(specFor(columnOf(source, width), widgetings))
      expect([spec.headkind, spec.sortkey !== undefined, spec.widthPx]).to.deep.eq([headkind, isSortable, width])
    })
  }

  it('remembers a sortable column by its label', () => {
    const spec = present(specFor(columnOf('question.title', 100, 'named'), widgetings))
    expect(spec.sortkey).to.eq('column:named')
  })

  it('is nothing for a column showing a widgeting the quiz does not have', () => {
    expect(specFor(columnOf('nowhere'), widgetings)).to.be.null
  })

  it('names the column in an export by its label', () => {
    const spec = present(specFor(columnOf('question.title', 100, 'named'), widgetings))
    expect(spec.header).to.eq('named')
  })
})

describe('specsFor and gridWidthPx', () => {
  const specs = specsFor(layout)

  it('has a spec for every column of the standard layout, in order', () => {
    expect(specs.map((spec) => spec.colkey)).to.deep.eq(layout.columns.map((column) => column.label))
  })

  it('leaves out a column that shows nothing, rather than failing', () => {
    const quiz = { widgetings: [], columns: [columnOf('question.title'), columnOf('nowhere', 100, 'lost')] }
    expect(specsFor(quiz).map((spec) => spec.colkey)).to.deep.eq(['col'])
  })

  it('adds the widths up with the grip, so the grid can insist on them', () => {
    expect(gridWidthPx(specs)).to.eq(GutterWidthPx + layout.columns.reduce((acc, column) => acc + column.width_px, 0))
  })

  it('is as wide as the grip alone for a quiz with no columns', () => {
    expect(gridWidthPx([])).to.eq(GutterWidthPx)
  })
})

describe('qnumSortkeyOf', () => {
  it('names the column showing Q#, wherever it is and whatever it is called', () => {
    expect(qnumSortkeyOf({ columns: [columnOf('question.title'), columnOf('question.qnum', 60, 'number')] })).to.eq('column:number')
  })

  it('is null for a quiz that shows no Q#', () => {
    expect(qnumSortkeyOf({ columns: [columnOf('question.title')] })).to.be.null
  })
})
