import { describe, expect, it } from 'vitest'
import { addable, choicesFor, estimatesFrom, pillsOf, type PillT } from '../../../src/components/cells/use-pills'
import * as Wheel from '../../../src/lib/wheel'
import type { EstimatesT } from '../../../src/models/estimate'

const DefaultOrder = Wheel.orderOf(Wheel.defaultWheel())
const tv: PillT = { category: 'tv', difficulty: 'hard' }
const art: PillT = { category: 'art', difficulty: 'medium' }
const blankEasy: PillT = { category: null, difficulty: 'easy' }
const blankHard: PillT = { category: null, difficulty: 'hard' }

describe("pillsOf", () => {
  it("gives a pill for each estimate, in the order typed", () => {
    expect(pillsOf([{ category: 'tv', difficulty: 'hard' }, { category: 'art', difficulty: 'medium' }])).to.deep.eq([tv, art])
  })
  it("gives a lone estimate of no category in particular as one blank pill, at its difficulty", () => {
    expect(pillsOf([{ category: null, difficulty: 'hard' }])).to.deep.eq([blankHard])
  })
})

describe("estimatesFrom", () => {
  const EstimatesFromCases: [PillT[], EstimatesT, string][] = [
    // regular usage:
    [[tv, art],                 [tv, art],                                 'every pill with a category, in order'],
    [[tv, blankEasy, art],      [tv, art],                                 'a blank pill among others comes to nothing'],
    // every pill blank:
    [[blankHard],               [{ category: null, difficulty: 'hard' }], 'a lone blank pill is no category in particular, at its difficulty'],
    [[blankEasy, blankHard],    [{ category: null, difficulty: 'easy' }], "several blank pills are one estimate of no category, at the first pill's difficulty"],
    // trivial cases:
    [[],                        [{ category: null, difficulty: 'medium' }], 'no pills at all are no category in particular, at medium'],
  ]
  for (const [pills, expected, describes] of EstimatesFromCases) {
    it(describes, () => {
      expect(estimatesFrom(pills)).to.deep.eq(expected)
    })
  }
})

describe("choicesFor", () => {
  it("offers every category in the total order to a lone pill", () => {
    expect(choicesFor([blankHard], 0, DefaultOrder)).to.deep.eq(DefaultOrder)
  })
  it("leaves out the categories other pills hold, but keeps the pill's own", () => {
    const choices = choicesFor([tv, art, blankEasy], 1, DefaultOrder)
    expect([choices.includes('tv'), choices.includes('art'), choices.length]).to.deep.eq([false, true, 23])
  })
  it("follows the order it is given", () => {
    const order = Wheel.orderOf(Wheel.placed(Wheel.defaultWheel(), 'tv', 0))
    expect(choicesFor([blankHard], 0, order).slice(0, 2)).to.deep.eq(['tv', 'gen_sci'])
  })
})

describe("addable", () => {
  const AddableCases: [PillT[], boolean, string][] = [
    [[tv, art],         true,  'every pill has a category: one more may be added'],
    [[tv, blankEasy],   false, 'a blank pill is already on offer'],
    [[blankHard],       false, 'a lone blank pill is already on offer'],
    [[],                true,  'no pills at all: one may be added'],
  ]
  for (const [pills, expected, describes] of AddableCases) {
    it(describes, () => {
      expect(addable(pills)).to.eq(expected)
    })
  }
})
