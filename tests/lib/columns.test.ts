import { describe, expect, it } from 'vitest'
import { GutterWidthPx, alignAfter, alignOf, columnsShowing, gridWidthPx, headAlignOf, qnumSortkeyOf, resolve, specFor, specsFor, widgetingRemovalRefusal } from '../../src/lib/columns'
import { Column, type ColumnAlign } from '../../src/models/column'
import { classicLayout } from '../support/layouts'
import { Widgeting } from '../../src/models/widgeting'
import { present } from '../support/present'

const layout = classicLayout()
const widgetings = [
  Widgeting.fill({ label: 'dumdum', widget_label: 'dumdum' }),
  Widgeting.fill({ label: 'numnum_hint', widget_label: 'numnum_hint' }),
  Widgeting.fill({ label: 'total', widget_label: 'clueing_full' }),
]
const columnOf = (source: string, width_px = 100, label = 'col') => Column.fill({ label, title: 'Col', source, width_px })

/** The alignment the grid draws a column showing `source` with, set to `align` or never set */
const aligned = (source: string, align?: ColumnAlign) => present(specFor({ ...columnOf(source), ...(align && { align }) }, widgetings)).align

describe('resolve', () => {
  it('finds a question field, a view, and a widgeting by its label, whatever widget it works', () => {
    expect(resolve('question.clueing', widgetings)).to.deep.eq({ kind: 'field', field: 'clueing' })
    expect(resolve('question.butnot', widgetings)).to.deep.eq({ kind: 'view', view: 'butnot' })
    expect(resolve('total', widgetings)).to.deep.eq({ kind: 'widgeting', widgeting: widgetings[2], part: null })
    expect(resolve('numnum_hint', widgetings)).to.deep.eq({ kind: 'widgeting', widgeting: widgetings[1], part: null })
  })

  it('finds one part of a widgeting, and nothing for a part of a widgeting the quiz does not have', () => {
    expect(resolve('total.masie', widgetings)).to.deep.eq({ kind: 'widgeting', widgeting: widgetings[2], part: 'masie' })
    expect(resolve('gone.masie', widgetings)).to.be.null
  })

  it('finds a field with no widgetings at all', () => {
    expect(resolve('question.clueing', [])).to.deep.eq({ kind: 'field', field: 'clueing' })
  })

  it('finds nothing for a widgeting the quiz does not have, nor by the widget it works', () => {
    expect(resolve('nowhere', widgetings)).to.be.null
    expect(resolve('clueing_full', widgetings)).to.be.null
  })
})

describe('columnsShowing', () => {
  const quiz = {
    widgetings,
    columns: [
      columnOf('question.title', 100, 'title'),
      columnOf('total', 78, 'total'),
      columnOf('dumdum', 160, 'guess'),
      columnOf('total.masie', 78, 'total_masie'),
      columnOf('gone', 78, 'gone'),
    ],
  }
  const labelsShowing = (label: string) => columnsShowing(quiz, label).map((column) => column.label)

  it("finds every column showing a widgeting, whole or a part of it, in the quiz's order", () => {
    expect(labelsShowing('total')).to.deep.eq(['total', 'total_masie'])
    expect(labelsShowing('dumdum')).to.deep.eq(['guess'])
  })

  it('finds none for a widgeting no column shows, and counts no column showing a field', () => {
    expect(labelsShowing('numnum_hint')).to.deep.eq([])
    expect(labelsShowing('title')).to.deep.eq([])
  })

  it('finds none for a widgeting the quiz does not have, though a column names it', () => {
    expect(labelsShowing('gone')).to.deep.eq([])
  })
})

describe('widgetingRemovalRefusal', () => {
  const quiz = {
    widgetings,
    columns: [
      Column.fill({ label: 'total', title: 'Total', source: 'total', width_px: 78 }),
      Column.fill({ label: 'total_masie', title: '', source: 'total.masie', width_px: 78 }),
      Column.fill({ label: 'guess', title: 'Guess', source: 'dumdum', width_px: 160 }),
    ],
  }

  it('names each column that holds the widgeting back, by its title or, untitled, its label', () => {
    expect(widgetingRemovalRefusal(quiz, 'total')).to.eq('The columns “Total” and “total_masie” still show that widgeting — remove them first.')
    expect(widgetingRemovalRefusal(quiz, 'dumdum')).to.eq('The column “Guess” still shows that widgeting — remove the column first.')
  })

  it('is null for a widgeting no column shows', () => {
    expect(widgetingRemovalRefusal(quiz, 'numnum_hint')).to.be.null
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

  it('carries the column\'s alignment, Q# centered when it says none, and none for any other column that says none', () => {
    expect([aligned('question.title', 'right'), aligned('question.qnum'), aligned('question.qnum', 'left'), aligned('question.title'), aligned('total')])
      .to.deep.eq(['right', 'center', 'left', null, null])
  })
})

describe('alignOf and headAlignOf', () => {
  const Cases: [string, number, ColumnAlign | undefined, ColumnAlign | null, ColumnAlign, string][] = [
    // source             width  align       alignOf    headAlignOf  blurb
    ['question.qnum',     60,    undefined,  'center',  'center',    'Q# is centered until it says otherwise'],
    ['question.qnum',     60,    'right',    'right',   'right',     'Q# set right is right'],
    ['question.title',    160,   undefined,  null,      'left',      'a field says nothing, its header to the left'],
    ['question.title',    60,    undefined,  null,      'left',      'a narrow field keeps its header along the row, to the left'],
    ['total',             78,    undefined,  null,      'right',     'a narrow widgeting turns its header, to the right over its numbers'],
    ['total',             180,   undefined,  null,      'left',      'a wide widgeting lays its header along the row, to the left'],
    ['total',             78,    'center',   'center',  'center',    'a turned header follows its column'],
    ['question.clueing',  330,   'left',     'left',    'left',      'a column set left says so, though left is where it sat'],
  ]
  for (const [source, width, align, aligned, headAligned, blurb] of Cases) {
    it(blurb, () => {
      const column = { ...columnOf(source, width), ...(align && { align }) }
      expect([alignOf(column), headAlignOf(column)]).to.deep.eq([aligned, headAligned])
    })
  }
})

describe('alignAfter', () => {
  it('steps left, center, right, and round to left again', () => {
    expect(['left', 'center', 'right'].map((align) => alignAfter(align as ColumnAlign))).to.deep.eq(['center', 'right', 'left'])
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
