import { describe, expect, it } from 'vitest'
import { sortedRows, sortOnClick, SpreadSortDefault } from '../../../src/components/panels/spread-table'
import * as Spread from '../../../src/lib/spread'
import * as Wheel from '../../../src/lib/wheel'
import type { EstimatesT } from '../../../src/models/estimate'

const DefaultOrder = Wheel.orderOf(Wheel.defaultWheel())

/** A quiz of two easy Art questions, one hard TV and Art question, and one easy Math & Econ */
const Sample = Spread.spreadOf(DefaultOrder, [
  [{ category: 'art', difficulty: 'easy' }],
  [{ category: 'art', difficulty: 'easy' }],
  [{ category: 'tv', difficulty: 'hard' }, { category: 'art', difficulty: 'hard' }],
  [{ category: 'math_econ', difficulty: 'easy' }],
] satisfies EstimatesT[])

/** The categories of `rows`, the first `count` of them */
function firstOf(rows: ReturnType<typeof sortedRows>, count: number) {
  return rows.slice(0, count).map(({ point }) => point.category)
}

describe("sortOnClick", () => {
  const SortOnClickCases = [
    [[SpreadSortDefault, 'slot'],                              { column: 'slot', descending: true },      'the column already sorted by turns the other way'],
    [[{ column: 'count', descending: true }, 'count'],        { column: 'count', descending: false },    'and back again'],
    [[SpreadSortDefault, 'count'],                             { column: 'count', descending: true },     'a number column first sorts the most first'],
    [[SpreadSortDefault, 'artie'],                             { column: 'artie', descending: true },     'a chance is a number like any other'],
    [[{ column: 'count', descending: true }, 'category'],     { column: 'category', descending: false }, 'a name first sorts from A'],
    [[{ column: 'count', descending: true }, 'slot'],         { column: 'slot', descending: false },     'the slot first sorts from the top of the wheel'],
  ] as const
  for (const [[sort, column], expected, describes] of SortOnClickCases) {
    it(describes, () => {
      expect(sortOnClick(sort, column)).to.deep.eq(expected)
    })
  }
})

describe("sortedRows", () => {
  it("starts in the wheel's order, each row knowing its slot", () => {
    const rows = sortedRows(Sample, SpreadSortDefault)
    expect(rows.map(({ point }) => point.category)).to.deep.eq(DefaultOrder)
    expect(rows.map(({ slotIdx }) => slotIdx)).to.deep.eq(DefaultOrder.map((_category, idx) => idx))
  })
  it("sorts by a count, most first or least first, ties in the wheel's order", () => {
    expect(firstOf(sortedRows(Sample, { column: 'count', descending: true }), 3)).to.deep.eq(['art', 'math_econ', 'tv'])
    expect(firstOf(sortedRows(Sample, { column: 'count', descending: false }), 2)).to.deep.eq(['gen_sci', 'chem_bio'])
  })
  it("sorts by category alphabetically, either way", () => {
    expect(firstOf(sortedRows(Sample, { column: 'category', descending: false }), 2)).to.deep.eq(['art', 'biz_tech'])
    expect(firstOf(sortedRows(Sample, { column: 'category', descending: true }), 1)).to.deep.eq(['world_hist'])
  })
  it("sorts by a persona's chance, the categories no question draws on sinking to the bottom either way", () => {
    const easiest = sortedRows(Sample, { column: 'artie', descending: true })
    const hardest = sortedRows(Sample, { column: 'artie', descending: false })
    const artieOf = (rows: ReturnType<typeof sortedRows>) => rows.slice(0, 3).map(({ point }) => point.chances?.artie ?? 0)
    expect(artieOf(easiest)).to.deep.eq(artieOf(easiest).toSorted((aa, bb) => bb - aa))
    expect(artieOf(hardest)).to.deep.eq(artieOf(easiest).toReversed())
    // Easy Art, beside Artie, is the easiest of all for him.
    expect(firstOf(easiest, 1)).to.deep.eq(['art'])
    for (const rows of [easiest, hardest]) {
      expect(rows.slice(0, 3).every(({ point }) => point.chances !== null)).to.be.true
      expect(rows.slice(3).every(({ point }) => point.chances === null)).to.be.true
    }
  })
  it("turns the slot's order about", () => {
    expect(firstOf(sortedRows(Sample, { column: 'slot', descending: true }), 1)).to.deep.eq(['physics_eng'])
  })
})
