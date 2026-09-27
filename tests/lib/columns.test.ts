import { describe, expect, it } from 'vitest'
import { GutterWidthPx, gridWidthPx, qnumSortkeyOf, resolve, specFor, specsFor } from '../../src/lib/columns'
import { Column } from '../../src/models/column'
import { defaultLayoutFor } from '../../src/models/layout'
import { SeedExpressions } from '../../src/models/expression'
import { Expressing, PlayingWidget } from '../../src/models/widget'
import { present } from '../support/present'

const layout = defaultLayoutFor(SeedExpressions)
const widgets = [
  PlayingWidget.fill({ kind: 'playing', label: 'dumdum', player_label: 'dumdum', textkind: 'clueing' }),
  PlayingWidget.fill({ kind: 'playing', label: 'numnum_hint', player_label: 'numnum', textkind: 'hint' }),
  Expressing.fill({ kind: 'expressing', label: 'total', expression_label: 'clueing_full' }),
]
const columnOf = (source: string, width_px = 100, label = 'col') => Column.fill({ label, title: 'Col', source, width_px })

describe('resolve', () => {
  it('finds a question field, a view, and each kind of widget', () => {
    expect(resolve('question.clueing', widgets)).to.deep.eq({ kind: 'field', field: 'clueing' })
    expect(resolve('question.butnot', widgets)).to.deep.eq({ kind: 'view', view: 'butnot' })
    expect(resolve('total', widgets)).to.deep.eq({ kind: 'expressing', widget: widgets[2] })
    expect(resolve('numnum_hint', widgets)).to.deep.include({ kind: 'playing' })
    const hint = present(resolve('numnum_hint', widgets))
    expect(hint.kind === 'playing' ? hint.slot.field : null).to.eq('hint_ishes')
  })

  it('finds nothing for a widget the quiz does not have', () => {
    expect(resolve('nowhere', widgets)).to.eq(null)
  })
})

describe('specFor', () => {
  const Cases: [string, number, string, boolean, string][] = [
    // source                 width  headkind    sortable  blurb
    ['question.title',        100,   'plain',    true,     'a title is along the row, and orders the quiz'],
    ['question.clueing',      330,   'plain',    false,    'prose is not ordered'],
    ['question.qnum',         60,    'plain',    true,     'Q# orders the quiz'],
    ['question.butnot',       180,   'plain',    false,    'the chained hint is prose'],
    ['question.butnot_ishes', 170,   'centered', true,     'a list of spans, ordered by how many'],
    ['numnum_hint',           170,   'centered', true,     'a number spotter\'s spans are a list'],
    ['dumdum',                160,   'plain',    false,    'a guess is prose'],
    ['total',                 78,    'vertical', true,     'a narrow computed column turns its header on its side'],
    ['total',                 180,   'plain',    true,     'a wide computed column lays it along the row'],
  ]
  for (const [source, width, headkind, isSortable, blurb] of Cases) {
    it(blurb, () => {
      const spec = present(specFor(columnOf(source, width), widgets))
      expect([spec.headkind, spec.sortkey !== undefined, spec.widthPx]).to.deep.eq([headkind, isSortable, width])
    })
  }

  it('remembers a sortable column by its label', () => {
    const spec = present(specFor(columnOf('question.title', 100, 'named'), widgets))
    expect(spec.sortkey).to.eq('column:named')
  })

  it('is nothing for a column showing a widget the quiz does not have', () => {
    expect(specFor(columnOf('nowhere'), widgets)).to.eq(null)
  })

  it('names the column in an export by its label', () => {
    const spec = present(specFor(columnOf('question.title', 100, 'named'), widgets))
    expect(spec.header).to.eq('named')
  })
})

describe('specsFor and gridWidthPx', () => {
  const specs = specsFor(layout)

  it('has a spec for every column of the standard layout, in order', () => {
    expect(specs.map((spec) => spec.colkey)).to.deep.eq(layout.columns.map((column) => column.label))
  })

  it('leaves out a column that shows nothing, rather than failing', () => {
    const quiz = { widgets: [], columns: [columnOf('question.title'), columnOf('nowhere', 100, 'lost')] }
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
    expect(qnumSortkeyOf({ columns: [columnOf('question.title')] })).to.eq(null)
  })
})
