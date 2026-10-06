import { describe, expect, it } from 'vitest'
import * as RunOrder from '../../src/lib/run-order'
import type { WidgetingTier } from '../../src/models/widgeting'

/** A widgeting, as far as the run order reads one */
type Item = { label: string, tier: WidgetingTier }

const quizOf = (label: string): Item => ({ label, tier: 'quiz' })
const questionOf = (label: string): Item => ({ label, tier: 'question' })

const entry = quizOf('entry')
const sum = questionOf('sum')
const total = quizOf('total')
const playtesters = quizOf('playtesters')

/** The labels of a list, the pivot by its key */
const labelsOf = (items: readonly { label: string }[]) => items.map((item) => item.label)

describe('tieredOf', () => {
  const TieredCases = [
    // regular usage:
    [[entry, sum, total],                   [['entry'], ['sum'], ['total']],           'a quiz widgeting before the first question widgeting runs above the pivot; one after, below'],
    [[sum, questionOf('more'), total],      [[], ['sum', 'more'], ['total']],          'question widgetings keep their order among themselves'],
    // trivial cases:
    [[],                                    [[], [], []],                              'no widgetings: nothing anywhere'],
    [[entry, total],                        [['entry', 'total'], [], []],              'no question widgetings: every quiz widgeting runs above the pivot'],
    [[sum],                                 [[], ['sum'], []],                         'no quiz widgetings: only the questions'],
    // weird cases:
    [[sum, entry, questionOf('more'), total], [[], ['sum', 'more'], ['entry', 'total']], 'a quiz widgeting among the question widgetings runs below them all'],
  ] as const

  for (const [items, [before, questions, after], title] of TieredCases) {
    it(title, () => {
      const tiered = RunOrder.tieredOf(items, RunOrder.ownTier)
      expect([labelsOf(tiered.before), labelsOf(tiered.questions), labelsOf(tiered.after)]).to.deep.eq([before, questions, after])
    })
  }

  it('reads each tier through the tierOf it is handed', () => {
    const steps = [{ widgeting: entry }, { widgeting: sum }]
    expect(RunOrder.tieredOf(steps, (step) => step.widgeting.tier).before).to.deep.eq([{ widgeting: entry }])
  })
})

describe('runOrderOf', () => {
  it('runs the quiz widgetings above the pivot, the question widgetings, then those below', () => {
    expect(labelsOf(RunOrder.runOrderOf([sum, entry, total], RunOrder.ownTier))).to.deep.eq(['sum', 'entry', 'total'])
    expect(labelsOf(RunOrder.runOrderOf([entry, sum, total], RunOrder.ownTier))).to.deep.eq(['entry', 'sum', 'total'])
  })

  it('pulls a quiz widgeting placed among the question widgetings below them', () => {
    const more = questionOf('more')
    expect(labelsOf(RunOrder.runOrderOf([sum, entry, more], RunOrder.ownTier))).to.deep.eq(['sum', 'more', 'entry'])
  })
})

describe('quizListOf', () => {
  it('is the quiz widgetings with the questions pivot where the question widgetings run', () => {
    expect(labelsOf(RunOrder.quizListOf([entry, sum, total], RunOrder.ownTier))).to.deep.eq(['entry', 'questions', 'total'])
  })

  it('puts the pivot last when there are no question widgetings', () => {
    expect(labelsOf(RunOrder.quizListOf([entry, total], RunOrder.ownTier))).to.deep.eq(['entry', 'total', 'questions'])
    expect(labelsOf(RunOrder.quizListOf([], RunOrder.ownTier))).to.deep.eq(['questions'])
  })
})

describe('isPivot', () => {
  it('knows the pivot from a widgeting, even one carrying its label', () => {
    expect(RunOrder.isPivot(RunOrder.Pivot)).to.be.true
    expect(RunOrder.isPivot(entry)).to.be.false
    expect(RunOrder.isPivot({ label: RunOrder.PivotKey, tier: 'quiz' })).to.be.false
  })
})

describe('movedWithin', () => {
  const MoveCases = [
    // a quiz widgeting, in the quiz list [entry, questions, total]:
    [[entry, sum, total], 'entry', 2,  ['sum', 'total', 'entry'],          'a quiz widgeting dropped at the foot of the quiz list runs last'],
    [[entry, sum, total], 'entry', 1,  ['sum', 'entry', 'total'],          'a quiz widgeting dropped just below the pivot runs after the questions, before the rest'],
    [[entry, sum, total], 'total', 0,  ['total', 'entry', 'sum'],          'a quiz widgeting dropped at the head runs first'],
    [[entry, sum, total], 'total', 1,  ['entry', 'total', 'sum'],          'a quiz widgeting dropped just above the pivot runs before the questions'],
    [[entry, sum, total], 'total', 99, ['entry', 'sum', 'total'],          'an index past the end is the end'],
    // a question widgeting, among the question widgetings:
    [[entry, sum, questionOf('more'), total], 'more', 0, ['entry', 'more', 'sum', 'total'], 'a question widgeting moves among the question widgetings only'],
    [[entry, sum, questionOf('more'), total], 'sum', 5,  ['entry', 'more', 'sum', 'total'], 'a question widgeting dropped past the end stays above the quiz widgetings below the pivot'],
    // weird cases:
    [[entry, total], 'entry', 2, ['total', 'entry'],                       'with no question widgetings, a drop below the pivot keeps the widgeting above it'],
    [[entry, sum, total], 'nobody', 0, ['entry', 'sum', 'total'],          'a label naming none is no move'],
  ] as const

  for (const [items, label, onto_idx, expected, title] of MoveCases) {
    it(title, () => {
      expect(labelsOf(RunOrder.movedWithin(items, label, onto_idx, RunOrder.ownTier))).to.deep.eq(expected)
    })
  }
})

describe('withAdded', () => {
  it('puts a quiz entry, which reads nothing, at the foot of those above the pivot', () => {
    expect(labelsOf(RunOrder.withAdded([entry, sum], playtesters, false, RunOrder.ownTier))).to.deep.eq(['entry', 'playtesters', 'sum'])
  })

  it('puts a quiz formula at the very end, where it reads everything', () => {
    expect(labelsOf(RunOrder.withAdded([entry, sum], total, true, RunOrder.ownTier))).to.deep.eq(['entry', 'sum', 'total'])
  })

  it('puts a question widgeting at the end of the question widgetings, above the quiz widgetings below the pivot', () => {
    const more = questionOf('more')
    expect(labelsOf(RunOrder.withAdded([entry, sum, total], more, true, RunOrder.ownTier))).to.deep.eq(['entry', 'sum', 'more', 'total'])
  })

  it('puts a question widgeting into a quiz with none after every quiz widgeting, which all then run above the pivot', () => {
    expect(labelsOf(RunOrder.withAdded([entry, total], sum, true, RunOrder.ownTier))).to.deep.eq(['entry', 'total', 'sum'])
  })
})
