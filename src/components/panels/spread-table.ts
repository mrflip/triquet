/**
 * How the category spread's table sorts: by any of its columns, either way, the rows that have
 * nothing to show in that column sinking to the bottom whichever way it goes.
 */
import type * as Spread from '../../lib/spread'
import { DifficultyGlyphs, DifficultyVals, type Difficulty } from '../../models/estimate'

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
 * or a fresh column its own first way, the most first for a number (the category sorts by how
 * many questions draw on it) and from the top for the slot.
 *
 * @example sortOnClick({ column: 'slot', descending: false }, 'slot')  // => { column: 'slot', descending: true }
 * @example sortOnClick({ column: 'slot', descending: false }, 'count')  // => { column: 'count', descending: true }
 * @example sortOnClick({ column: 'count', descending: true }, 'category')  // => { column: 'category', descending: true }
 */
export function sortOnClick(sort: SpreadSortT, column: SpreadColumn): SpreadSortT {
  if (sort.column === column) { return { column, descending: ! sort.descending } }
  return { column, descending: column !== 'slot' }
}

/** How many of one difficulty a category's sigils spell out a face for each, before they give one face and the count */
const SigilsSpelledMax = 3

/**
 * A category's questions as faces, one difficulty after another, easy first: a face for each
 * question while there are three or fewer of a difficulty, and one face and the count past that.
 *
 * @example sigilsOf({ easy: 1, medium: 1, hard: 2 })  // => '🍰🤔😈😈'
 * @example sigilsOf({ easy: 1, medium: 1, hard: 4 })  // => '🍰🤔😈×4'
 * @example sigilsOf({ easy: 0, medium: 0, hard: 0 })  // => ''
 */
export function sigilsOf(tally: Readonly<Record<Difficulty, number>>): string {
  return DifficultyVals.map((difficulty) => {
    const count = tally[difficulty]
    return count > SigilsSpelledMax ? `${DifficultyGlyphs[difficulty]}×${String(count)}` : DifficultyGlyphs[difficulty].repeat(count)
  }).join('')
}

/**
 * A category's questions in words, for a screen reader and a hover: how many at each difficulty
 * there are any of.
 *
 * @example sigilWordsOf({ easy: 1, medium: 0, hard: 4 })  // => '1 easy, 4 hard'
 * @example sigilWordsOf({ easy: 0, medium: 0, hard: 0 })  // => 'no questions'
 */
export function sigilWordsOf(tally: Readonly<Record<Difficulty, number>>): string {
  const words = DifficultyVals.flatMap((difficulty) => (tally[difficulty] > 0 ? [`${String(tally[difficulty])} ${difficulty}`] : []))
  return words.length > 0 ? words.join(', ') : 'no questions'
}

/**
 * A count split at its point, so a column of them lines up on it: the whole part, and the point
 * and what follows, empty for a whole number.
 *
 * @example decimalPartsOf('10.1')  // => ['10', '.1']
 * @example decimalPartsOf('1')     // => ['1', '']
 */
export function decimalPartsOf(formatted: string): [string, string] {
  const pointAt = formatted.indexOf('.')
  return pointAt === -1 ? [formatted, ''] : [formatted.slice(0, pointAt), formatted.slice(pointAt)]
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

/** What `row` shows in `column`, as a number to sort by (a category by how many questions draw on it, each once); null for nothing */
function valueOf({ point, slotIdx }: SpreadRowT, column: SpreadColumn): number | null {
  switch (column) {
  case 'slot':     { return slotIdx }
  case 'category': { return point.tally.easy + point.tally.medium + point.tally.hard }
  case 'count':    { return point.count }
  case 'smoothed': { return point.smoothed }
  default:         { return point.chances?.[column] ?? null }
  }
}
