import { describe, expect, it } from 'vitest'
import { decimalPartsOf, sigilsOf, sigilWordsOf, sortedRows, sortOnClick, SpreadSortDefault } from '../../../src/components/panels/spread-table'
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
    [[{ column: 'count', descending: true }, 'category'],     { column: 'category', descending: true },  'the category first sorts by the most questions'],
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
  it("sorts by category by how many questions draw on it, each once, not by their shares", () => {
    // TV: three questions, a third of each; Art: two, wholly.
    const thirds: EstimatesT = [{ category: 'tv', difficulty: 'easy' }, { category: 'games', difficulty: 'easy' }, { category: 'sports', difficulty: 'easy' }]
    const wholly: EstimatesT = [{ category: 'art', difficulty: 'easy' }]
    const spread = Spread.spreadOf(DefaultOrder, [thirds, thirds, thirds, wholly, wholly])
    expect(firstOf(sortedRows(spread, { column: 'category', descending: true }), 1)).to.deep.eq(['tv'])
    expect(firstOf(sortedRows(spread, { column: 'count', descending: true }), 1)).to.deep.eq(['art'])
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

describe("sigilsOf", () => {
  const SigilsCases = [
    // regular usage:
    [{ easy: 1, medium: 1, hard: 2 },  "🍰🤔😈😈",   'a face for each question, easy first'],
    [{ easy: 3, medium: 0, hard: 0 },  "🍰🍰🍰",     'three of a difficulty are still spelled out'],
    [{ easy: 1, medium: 1, hard: 4 },  "🍰🤔😈×4",   'past three, one face and the count'],
    [{ easy: 12, medium: 5, hard: 0 }, "🍰×12🤔×5",  'any difficulty past three is counted'],
    // trivial cases:
    [{ easy: 0, medium: 0, hard: 0 },  "",           'no questions, no faces'],
  ] as const
  for (const [tally, expected, describes] of SigilsCases) {
    it(describes, () => {
      expect(sigilsOf(tally)).to.eq(expected)
    })
  }
})

describe("sigilWordsOf", () => {
  it("names the difficulties there are any of", () => {
    expect(sigilWordsOf({ easy: 1, medium: 0, hard: 4 })).to.eq('1 easy, 4 hard')
  })
  it("says so when there are none", () => {
    expect(sigilWordsOf({ easy: 0, medium: 0, hard: 0 })).to.eq('no questions')
  })
})

describe("decimalPartsOf", () => {
  const DecimalCases = [
    ["10.1",  ["10", ".1"],  'splits at the point'],
    ["1.25",  ["1", ".25"],  'keeps every place after it'],
    ["1",     ["1", ""],     'a whole number has nothing after the point'],
    ["10",    ["10", ""],    'nor does a larger one'],
  ] as const
  for (const [formatted, expected, describes] of DecimalCases) {
    it(describes, () => {
      expect(decimalPartsOf(formatted)).to.deep.eq(expected)
    })
  }
})
