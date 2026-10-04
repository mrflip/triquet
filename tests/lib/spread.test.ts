import { describe, expect, it } from 'vitest'
import * as Spread from '../../src/lib/spread'
import * as Wheel from '../../src/lib/wheel'
import type { CategoryLabel } from '../../src/models/category'
import type { EstimatesT } from '../../src/models/estimate'

const DefaultOrder = Wheel.orderOf(Wheel.defaultWheel())
const Neutral: EstimatesT = [{ category: null, difficulty: 'medium' }]

/** The point for `category` in `spread` */
function pointAt(spread: Spread.SpreadT, category: CategoryLabel) {
  return spread.points.find((point) => point.category === category)
}

/** The sum of one of the spread's measures over every category */
function totalOf(spread: Spread.SpreadT, measure: 'count' | 'smoothed') {
  return spread.points.reduce((sum, point) => sum + point[measure], 0)
}

describe("SmoothingWeights", () => {
  it("adds up to the whole share, half of it kept by the category itself", () => {
    expect(Spread.SmoothingWeights.reduce((sum, weight) => sum + weight, 0)).to.be.closeTo(1, 1e-12)
    expect(Spread.SmoothingWeights[2]).to.eq(0.5)
  })
})

describe("sharesOf", () => {
  const SharesOfCases: [EstimatesT, Spread.ShareT[], string][] = [
    // regular usage:
    [[{ category: 'art', difficulty: 'easy' }],                                                                              [{ category: 'art', share: 1 }],                                                       'a question of one category is wholly its'],
    [[{ category: 'art', difficulty: 'easy' }, { category: 'tv', difficulty: 'hard' }],                                      [{ category: 'art', share: 0.5 }, { category: 'tv', share: 0.5 }],                     'a question of two is half of each, whatever their difficulties'],
    [[{ category: 'art', difficulty: 'easy' }, { category: 'tv', difficulty: 'easy' }, { category: 'games', difficulty: 'easy' }], [{ category: 'art', share: 1 / 3 }, { category: 'tv', share: 1 / 3 }, { category: 'games', share: 1 / 3 }], 'a question of three is a third of each'],
    // trivial cases:
    [Neutral,                                                                                                                [],                                                                                    'a question of no category in particular gives no category anything'],
  ]
  for (const [estimates, expected, describes] of SharesOfCases) {
    it(describes, () => {
      expect(Spread.sharesOf(estimates)).to.deep.eq(expected)
    })
  }
})

describe("smoothedOf", () => {
  it("spreads a share over the category and two neighbours either side, counter-clockwise first, wrapping past the top", () => {
    expect(Spread.smoothedOf(DefaultOrder, { category: 'math_econ', share: 1 })).to.deep.eq([
      { category: 'biz_tech',    share: 0.09 },
      { category: 'physics_eng', share: 0.16 },
      { category: 'math_econ',   share: 0.5 },
      { category: 'gen_sci',     share: 0.16 },
      { category: 'chem_bio',    share: 0.09 },
    ])
  })
  it("scales with the share", () => {
    expect(Spread.smoothedOf(DefaultOrder, { category: 'art', share: 0.5 }).map(({ share }) => share)).to.deep.eq([0.045, 0.08, 0.25, 0.08, 0.045])
  })
  it("finds the neighbours where the total order puts them", () => {
    const order = Wheel.orderOf(Wheel.placed(Wheel.defaultWheel(), 'tv', 1))
    expect(Spread.smoothedOf(order, { category: 'math_econ', share: 1 }).map(({ category }) => category)).to.deep.eq(['biz_tech', 'physics_eng', 'math_econ', 'tv', 'chem_bio'])
  })
})

describe("spreadOf", () => {
  it("gives every category a point, in the total order", () => {
    const order = Wheel.orderOf(Wheel.placed(Wheel.defaultWheel(), 'tv', 0))
    expect(Spread.spreadOf(order, []).points.map(({ category }) => category)).to.deep.eq(order)
  })
  it("counts a question of one category wholly there, and half of it once smoothed", () => {
    const spread = Spread.spreadOf(DefaultOrder, [[{ category: 'art', difficulty: 'easy' }]])
    expect(pointAt(spread, 'art')).to.deep.eq({ category: 'art', count: 1, smoothed: 0.5 })
    expect(pointAt(spread, 'classical_music')).to.deep.eq({ category: 'classical_music', count: 0, smoothed: 0.16 })
    expect(pointAt(spread, 'world_hist')).to.deep.eq({ category: 'world_hist', count: 0, smoothed: 0.09 })
    expect(pointAt(spread, 'tv')?.smoothed).to.eq(0)
  })
  it("sums shares from many questions, neighbours' spill included", () => {
    const spread = Spread.spreadOf(DefaultOrder, [
      [{ category: 'art', difficulty: 'easy' }],
      [{ category: 'art', difficulty: 'hard' }, { category: 'classical_music', difficulty: 'medium' }],
    ])
    expect(pointAt(spread, 'art')?.count).to.eq(1.5)
    expect(pointAt(spread, 'classical_music')?.count).to.eq(0.5)
    // Art keeps half of its 1.5, and takes 16% of Classical Music's half.
    expect(pointAt(spread, 'art')?.smoothed).to.be.closeTo((1.5 * 0.5) + (0.5 * 0.16), 1e-12)
  })
  it("keeps the smoothed spread to the same number of questions as the count", () => {
    const spread = Spread.spreadOf(DefaultOrder, [
      [{ category: 'math_econ', difficulty: 'easy' }, { category: 'tv', difficulty: 'easy' }, { category: 'games', difficulty: 'easy' }],
      [{ category: 'physics_eng', difficulty: 'hard' }],
      Neutral,
    ])
    expect(totalOf(spread, 'count')).to.be.closeTo(2, 1e-12)
    expect(totalOf(spread, 'smoothed')).to.be.closeTo(2, 1e-12)
  })
  it("counts a question of no category in particular apart, in neither measure", () => {
    const spread = Spread.spreadOf(DefaultOrder, [Neutral, [{ category: null, difficulty: 'hard' }], [{ category: 'tv', difficulty: 'easy' }]])
    expect([spread.placedCount, spread.unplacedCount]).to.deep.eq([1, 2])
    expect(totalOf(spread, 'count')).to.eq(1)
  })
  it("gives a quiz of no questions an empty spread", () => {
    const spread = Spread.spreadOf(DefaultOrder, [])
    expect([spread.placedCount, spread.unplacedCount, totalOf(spread, 'count'), totalOf(spread, 'smoothed')]).to.deep.eq([0, 0, 0, 0])
  })
  it("reads any iterable of estimates, such as a map's values", () => {
    const byQuestion = new Map<string, EstimatesT>([['q1', [{ category: 'tv', difficulty: 'easy' }]], ['q2', Neutral]])
    expect(Spread.spreadOf(DefaultOrder, byQuestion.values()).placedCount).to.eq(1)
  })
})
