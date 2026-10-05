import { describe, expect, it } from 'vitest'
import * as Estimates from '../../src/lib/estimates'
import * as Wheel from '../../src/lib/wheel'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { Widget } from '../../src/models/widget'
import { Widgeted, type JsonT, type WidgetedHistoryT } from '../../src/models/widgeted'
import { Widgeting } from '../../src/models/widgeting'
import type { EstimatesT } from '../../src/models/estimate'
import { runOf } from '../support/runs'

const DefaultOrder = Wheel.orderOf(Wheel.defaultWheel())
const Estimating = Widget.fill({ label: 'categories', formulary: 'entry', config: { entry_kind: 'estimates' } })
const Numbering = Widget.fill({ label: 'points', formulary: 'entry', config: { entry_kind: 'number' } })
const Shouting = Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)' })
const Neutral: EstimatesT = [{ category: null, difficulty: 'medium' }]

/** A cell whose one row holds `value` */
function typed(value: JsonT): WidgetedHistoryT {
  const row = { status: 'ok' as const, value, message: null, result_meta: {}, _creationTime: 3 }
  return { newest: row, ok: row }
}

describe("isEstimating", () => {
  it("says a category-estimate entry is one", () => {
    expect(Estimates.isEstimating(Estimating)).to.be.true
  })
  it("says another kind of entry, another formulary, or a widget gone from the library is not", () => {
    expect([Numbering, Shouting, null].map((widget) => Estimates.isEstimating(widget))).to.deep.eq([false, false, false])
  })
})

describe("estimatesOf", () => {
  const EstimatesOfCases: [Parameters<typeof Estimates.estimatesOf>[0], EstimatesT, string][] = [
    // regular usage:
    [Widgeted.ok([{ category: 'tv', difficulty: 'hard' }]),                                    [{ category: 'tv', difficulty: 'hard' }],                                    'a cell of one estimate holds it'],
    [Widgeted.ok([{ category: 'tv', difficulty: 'hard' }, { category: 'art', difficulty: 'easy' }]), [{ category: 'tv', difficulty: 'hard' }, { category: 'art', difficulty: 'easy' }], 'a cell of several holds them in the order typed'],
    [Widgeted.ok([{ category: null, difficulty: 'easy' }]),                                    [{ category: null, difficulty: 'easy' }],                                    'an estimate of no category in particular is kept, at its difficulty'],
    // nothing typed:
    [Widgeted.missing,                                                                          Neutral,                                                                     'an empty cell draws on no category in particular, at medium'],
    [Widgeted.errored({ message: 'Gone.', at: null, response: null }),                          Neutral,                                                                     'a failed cell has nothing typed, so draws on no category in particular'],
    // weird cases:
    [Widgeted.ok('tv'),                                                                         Neutral,                                                                     'a value that is no list of estimates reads as nothing typed'],
    [Widgeted.ok([{ category: 'tv' }]),                                                         [{ category: 'tv', difficulty: 'medium' }],                                  'an estimate without a difficulty is at medium'],
  ]
  for (const [widgeted, expected, describes] of EstimatesOfCases) {
    it(describes, () => {
      expect(Estimates.estimatesOf(widgeted)).to.deep.eq(expected)
    })
  }
})

describe("partsOf", () => {
  it("gives the estimates and every persona's chance at them, with the average", () => {
    const parts = Estimates.partsOf(DefaultOrder, Widgeted.ok([{ category: 'math_econ', difficulty: 'hard' }]))
    expect(parts?.estimates).to.deep.eq([{ category: 'math_econ', difficulty: 'hard' }])
    expect([parts?.masie, parts?.artie, parts?.poppy].map((chance) => chance?.toFixed(2))).to.deep.eq(['0.60', '0.18', '0.18'])
    expect(parts?.average.toFixed(2)).to.eq('0.32')
  })
  it("gives an empty cell the halfway chance everyone has at a question of no category in particular", () => {
    expect(Estimates.partsOf(DefaultOrder, Widgeted.missing)).to.deep.eq({ estimates: Neutral, masie: 0.525, artie: 0.525, poppy: 0.525, average: 0.525 })
  })
  it("reads the categories where the total order puts them", () => {
    const order = Wheel.orderOf(Wheel.placed(Wheel.defaultWheel(), 'tv', 16))
    expect(Estimates.partsOf(order, Widgeted.ok([{ category: 'tv', difficulty: 'easy' }]))?.poppy).to.eq(0.9)
  })
  it("gives a failed cell nothing at all", () => {
    expect(Estimates.partsOf(DefaultOrder, Widgeted.errored({ message: 'Gone.', at: null, response: null }))).to.be.null
  })
})

describe("quizEstimatesOf", () => {
  const placed: QuestionT = { ...Question.blank(), qnum: '1', stored: { cats: typed([{ category: 'art', difficulty: 'easy' }]), more: typed([{ category: 'tv', difficulty: 'hard' }]) } }
  const blank: QuestionT = { ...Question.blank(), qnum: '2' }
  const widgetings = [Widgeting.fill({ label: 'points', widget_label: 'points' }), Widgeting.fill({ label: 'cats', widget_label: 'categories' }), Widgeting.fill({ label: 'more', widget_label: 'categories' })]
  const library = [Estimating, Numbering]

  it("reads every question's estimates under the quiz's first category-estimate widgeting in run order", () => {
    const outcome = Estimates.quizEstimatesOf(runOf({ ...Quiz.blank(), questions: [placed, blank], widgetings }, library))
    expect(outcome?.widgeting.label).to.eq('cats')
    expect([...outcome?.estimates.entries() ?? []]).to.deep.eq([[placed._id, [{ category: 'art', difficulty: 'easy' }]], [blank._id, Neutral]])
  })
  it("is null for a quiz that works no category-estimate widgeting", () => {
    const run = runOf({ ...Quiz.blank(), questions: [placed], widgetings: widgetings.slice(0, 1) }, library)
    expect(Estimates.quizEstimatesOf(run)).to.be.null
  })
  it("is an empty reading for a quiz with no questions", () => {
    const run = runOf({ ...Quiz.blank(), questions: [], widgetings }, library)
    expect(Estimates.quizEstimatesOf(run)?.estimates.size).to.eq(0)
  })
})

describe("textOf", () => {
  const TextOfCases: [EstimatesT, string, string][] = [
    [[{ category: 'tv', difficulty: 'hard' }, { category: 'art', difficulty: 'medium' }], "TV (hard), Art (medium)",            'names each category by its title, with its difficulty, in the order typed'],
    [[{ category: null, difficulty: 'easy' }],                                              "No category in particular (easy)",   'says an estimate of no category in particular in words'],
  ]
  for (const [estimates, expected, describes] of TextOfCases) {
    it(describes, () => {
      expect(Estimates.textOf(estimates)).to.eq(expected)
    })
  }
})

describe("chanceTextOf", () => {
  const ChanceTextCases: [number, string, string][] = [
    [0.525, "53%",  'rounds a half up to the nearest whole percent'],
    [1,     "100%", 'a certainty is a hundred percent'],
    [0,     "0%",   'no chance is nought percent'],
    [0.69,  "69%",  'leaves no floating-point dust'],
  ]
  for (const [chance, expected, describes] of ChanceTextCases) {
    it(describes, () => {
      expect(Estimates.chanceTextOf(chance)).to.eq(expected)
    })
  }
})
