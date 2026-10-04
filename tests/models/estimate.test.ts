import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { CategoryLabelVals } from '../../src/models/category'
import { DifficultyDefault, DifficultyVals, Estimate, EstimateValidators, type EstimatesDNA } from '../../src/models/estimate'

describe("EstimateValidators.estimate", () => {
  it("takes a category and a difficulty", () => {
    expect(EstimateValidators.estimate({ category: 'tv', difficulty: 'hard' })).to.deep.eq({ category: 'tv', difficulty: 'hard' })
  })

  it("takes no category in particular", () => {
    expect(EstimateValidators.estimate({ category: null, difficulty: 'easy' })).to.deep.eq({ category: null, difficulty: 'easy' })
  })

  it("gives a difficulty left unsaid the default, medium", () => {
    expect(DifficultyDefault).to.eq('medium')
    expect(EstimateValidators.estimate({ category: 'art' })).to.deep.eq({ category: 'art', difficulty: 'medium' })
  })

  const Refused: [unknown, string][] = [
    [{ category: 'knitting', difficulty: 'easy' },  'a category there is not'],
    [{ category: '', difficulty: 'easy' },          'a blank in place of no category'],
    [{ difficulty: 'easy' },                        'a category left unsaid, rather than said to be none'],
    [{ category: 'tv', difficulty: 'impossible' },  'a difficulty there is not'],
    [{ category: 'tv', difficulty: 2 },             'a difficulty as a number'],
    [null,                                          'no estimate at all'],
  ]
  for (const [estimate, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => EstimateValidators.estimate(estimate as never)).to.throw(Z.ZodError)
    })
  }
})

describe("EstimateValidators.estimates", () => {
  it("takes one estimate for each category a question draws on", () => {
    const estimates: EstimatesDNA = [{ category: 'tv', difficulty: 'hard' }, { category: 'us_hist', difficulty: 'easy' }]
    expect(EstimateValidators.estimates(estimates)).to.deep.eq(estimates)
  })

  it("takes a lone estimate of no category in particular", () => {
    expect(EstimateValidators.estimates([{ category: null }])).to.deep.eq([{ category: null, difficulty: 'medium' }])
  })

  it("takes an estimate for every category at once", () => {
    const everyCategory = CategoryLabelVals.map((category) => ({ category, difficulty: 'easy' as const }))
    expect(EstimateValidators.estimates(everyCategory)).to.have.lengthOf(24)
  })

  const Refused: [unknown, string][] = [
    [[],                                                                        'no estimate at all'],
    [[{ category: null }, { category: 'tv' }],                                  'no category in particular beside a category'],
    [[{ category: null }, { category: null }],                                  'no category in particular twice'],
    [[{ category: 'tv', difficulty: 'easy' }, { category: 'tv', difficulty: 'hard' }], 'one category twice, even at two difficulties'],
    [{ category: 'tv' },                                                        'an estimate not in a list'],
  ]
  for (const [estimates, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => EstimateValidators.estimates(estimates as never)).to.throw(Z.ZodError)
    })
  }

  it("says which estimate repeats a category", () => {
    const outcome = EstimateValidators.estimates.safeParse([{ category: 'tv' }, { category: 'art' }, { category: 'tv' }])
    expect(outcome.error?.issues.map((issue) => issue.path)).to.deep.eq([[2, 'category']])
  })
})

describe("Estimate", () => {
  it("fills an estimate, defaulting its difficulty", () => {
    expect(Estimate.fill({ category: 'tv' })).to.deep.eq({ category: 'tv', difficulty: 'medium' })
  })

  it("makes an estimate of no category in particular, at medium unless told", () => {
    expect(Estimate.neutral()).to.deep.eq({ category: null, difficulty: 'medium' })
    expect(Estimate.neutral('hard')).to.deep.eq({ category: null, difficulty: 'hard' })
  })

  it("knows three difficulties, easiest first", () => {
    expect(DifficultyVals).to.deep.eq(['easy', 'medium', 'hard'])
  })
})
