import { describe, expect, it } from 'vitest'
import { LeadColumns, ShapeWidthPx, TailColumns, columnsFor, expressedColumns, gridWidthPx } from '../../src/components/columns'
import { Expressing } from '../../src/models/expressing'

const skinny = Expressing.fill({ label: 'total', expression_label: 'clueing_full', title: 'Total' })
const medium = Expressing.fill({ label: 'backward', expression_label: 'answer_reversed', title: 'Backward', shape: 'medium' })

describe('expressedColumns', () => {
  it('turns a skinny column\'s header on its side, as the number columns always were, at their width', () => {
    expect(expressedColumns([skinny])).to.deep.eq([
      { colkey: 'expressing:total', title: 'Total', widthPx: 78, headkind: 'vertical', sortkey: 'expressing:total' },
    ])
  })

  it('lays a medium column\'s header along the row, at a notes column\'s width', () => {
    const [column] = expressedColumns([medium])
    expect(column).to.include({ headkind: 'plain', widthPx: ShapeWidthPx.medium })
  })

  it('makes every column sortable, by a sortkey the quiz can remember', () => {
    expect(expressedColumns([skinny, medium]).map((column) => column.sortkey)).to.deep.eq(['expressing:total', 'expressing:backward'])
  })

  it('is nothing for a quiz with no computed columns', () => {
    expect(expressedColumns([])).to.deep.eq([])
  })
})

describe('columnsFor', () => {
  it('puts the computed columns between Q# and Alt Text, in the order the quiz lists them', () => {
    const titles = columnsFor([medium, skinny]).map((column) => column.title)
    expect(titles.slice(LeadColumns.length - 1, LeadColumns.length + 3)).to.deep.eq(['Q#', 'Backward', 'Total', 'Alt Text'])
  })

  it('is just the fixed columns when the quiz has none of its own', () => {
    expect(columnsFor([])).to.deep.eq([...LeadColumns, ...TailColumns])
  })

  it('gives every column a key of its own', () => {
    const keys = columnsFor([skinny, medium]).map((column) => column.colkey)
    expect(new Set(keys).size).to.eq(keys.length)
  })
})

describe('gridWidthPx', () => {
  it('adds up the widths, so the grid can insist on them', () => {
    expect(gridWidthPx(columnsFor([]))).to.eq([...LeadColumns, ...TailColumns].reduce((acc, column) => acc + column.widthPx, 0))
  })

  it('grows by exactly the width of each computed column', () => {
    expect(gridWidthPx(columnsFor([skinny, medium])) - gridWidthPx(columnsFor([]))).to.eq(ShapeWidthPx.skinny + ShapeWidthPx.medium)
  })
})
