/**
 * How the category spread's table sorts: by any of its columns, either way, the rows that have
 * nothing to show in that column sinking to the bottom whichever way it goes.
 */
import type * as Spread from '../../lib/spread'
import { CategoryLabelsByTitle } from '../../models/category'

/** The table's columns, as its sort names them: the slot round the wheel, the category, its counts, and the personas' chances */
export const SpreadColumnVals = ['slot', 'category', 'count', 'smoothed', 'masie', 'artie', 'poppy', 'average'] as const
export type SpreadColumn = typeof SpreadColumnVals[number]

/** Which column the table is sorted by, and which way */
export type SpreadSortT = { column: SpreadColumn, descending: boolean }

/** How the table first sorts: round the wheel from the top, as the chart reads */
export const SpreadSortDefault: SpreadSortT = { column: 'slot', descending: false }

/** One row of the table: a category's point, and the slot round the wheel it sits in */
export type SpreadRowT = { point: Spread.SpreadPointT, slotIdx: number }

/**
 * The sort a click on `column`'s heading makes of `sort`: the same column turned the other way,
 * or a fresh column its own first way, the most first for a number and from the top for a name
 * or a slot.
 *
 * @example sortOnClick({ column: 'slot', descending: false }, 'slot')  // => { column: 'slot', descending: true }
 * @example sortOnClick({ column: 'slot', descending: false }, 'count')  // => { column: 'count', descending: true }
 * @example sortOnClick({ column: 'count', descending: true }, 'category')  // => { column: 'category', descending: false }
 */
export function sortOnClick(sort: SpreadSortT, column: SpreadColumn): SpreadSortT {
  if (sort.column === column) { return { column, descending: ! sort.descending } }
  return { column, descending: column !== 'slot' && column !== 'category' }
}

/**
 * The spread's points as the table's rows, sorted by `sort`. A row with nothing in the sorted
 * column (a persona's chance where no question draws on the category) sinks to the bottom either
 * way; ties keep the wheel's order.
 *
 * @example sortedRows(spread, { column: 'count', descending: true })[0].point.category  // => the category most questions draw on
 */
export function sortedRows(spread: Spread.SpreadT, sort: SpreadSortT): SpreadRowT[] {
  const rows = spread.points.map((point, slotIdx) => ({ point, slotIdx }))
  return rows.toSorted((aa, bb) => {
    const aaVal = valueOf(aa, sort.column)
    const bbVal = valueOf(bb, sort.column)
    if (aaVal === null && bbVal === null) { return aa.slotIdx - bb.slotIdx }
    if (aaVal === null) { return 1 }
    if (bbVal === null) { return -1 }
    const order = aaVal - bbVal
    if (order === 0) { return aa.slotIdx - bb.slotIdx }
    return sort.descending ? -order : order
  })
}

/** What `row` shows in `column`, as a number to sort by (a category by its place among the titles, alphabetically); null for nothing */
function valueOf({ point, slotIdx }: SpreadRowT, column: SpreadColumn): number | null {
  switch (column) {
  case 'slot':     { return slotIdx }
  case 'category': { return CategoryLabelsByTitle.indexOf(point.category) }
  case 'count':    { return point.count }
  case 'smoothed': { return point.smoothed }
  default:         { return point.chances?.[column] ?? null }
  }
}
