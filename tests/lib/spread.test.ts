import { describe, expect, it } from 'vitest'
import * as Personas from '../../src/lib/personas'
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
    expect(pointAt(spread, 'art')).to.include({ category: 'art', count: 1, smoothed: 0.5 })
    expect(pointAt(spread, 'classical_music')).to.include({ category: 'classical_music', count: 0, smoothed: 0.16 })
    expect(pointAt(spread, 'world_hist')).to.include({ category: 'world_hist', count: 0, smoothed: 0.09 })
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
  it("gives each category the personas' chances at the questions drawing on it, and none where nothing does", () => {
    const easyArt: EstimatesT = [{ category: 'art', difficulty: 'easy' }]
    const spread = Spread.spreadOf(DefaultOrder, [easyArt])
    expect(pointAt(spread, 'art')?.chances).to.deep.eq(Personas.chancesOf(DefaultOrder, easyArt))
    expect(pointAt(spread, 'art')?.chances?.artie).to.eq(0.9)
    expect(pointAt(spread, 'tv')?.chances).to.be.null
  })
  it("weights each question's chances in a category by its share there", () => {
    const easyArt: EstimatesT = [{ category: 'art', difficulty: 'easy' }]
    const artAndTv: EstimatesT = [{ category: 'art', difficulty: 'hard' }, { category: 'tv', difficulty: 'hard' }]
    const spread = Spread.spreadOf(DefaultOrder, [easyArt, artAndTv])
    const expected = (Personas.chancesOf(DefaultOrder, easyArt).masie + (Personas.chancesOf(DefaultOrder, artAndTv).masie * 0.5)) / 1.5
    expect(pointAt(spread, 'art')?.chances?.masie).to.be.closeTo(expected, 1e-12)
    expect(pointAt(spread, 'tv')?.chances).to.deep.eq(Personas.chancesOf(DefaultOrder, artAndTv))
  })
  it("gives the whole quiz's chances over every question, one of no category in particular included", () => {
    const easyArt: EstimatesT = [{ category: 'art', difficulty: 'easy' }]
    const spread = Spread.spreadOf(DefaultOrder, [easyArt, Neutral])
    const expected = (Personas.chancesOf(DefaultOrder, easyArt).average + Personas.chancesOf(DefaultOrder, Neutral).average) / 2
    expect(spread.chances?.average).to.be.closeTo(expected, 1e-12)
    expect(Spread.spreadOf(DefaultOrder, []).chances).to.be.null
  })
  it("reads any iterable of estimates, such as a map's values", () => {
    const byQuestion = new Map<string, EstimatesT>([['q1', [{ category: 'tv', difficulty: 'easy' }]], ['q2', Neutral]])
    expect(Spread.spreadOf(DefaultOrder, byQuestion.values()).placedCount).to.eq(1)
  })
})

describe("meanChancesOf", () => {
  const Low = { masie: 0.4, artie: 0.6, poppy: 0.5, average: 0.5 }
  const High = { masie: 0.8, artie: 0.6, poppy: 0.5, average: 0.63 }
  it("takes the weighted mean, persona by persona", () => {
    const mean = Spread.meanChancesOf([{ weight: 1, chances: Low }, { weight: 3, chances: High }])
    expect(mean?.masie).to.be.closeTo(0.7, 1e-12)
    expect(mean?.artie).to.be.closeTo(0.6, 1e-12)
  })
  it("is the chances themselves for one question", () => {
    expect(Spread.meanChancesOf([{ weight: 0.5, chances: Low }])).to.deep.eq(Low)
  })
  it("is null with nothing to take the mean of", () => {
    expect(Spread.meanChancesOf([])).to.be.null
  })
})
