import { describe, expect, it } from 'vitest'
import { EntryKindWords, FormularyWords, usageLine } from '../../src/components/widget-words'
import { EntryKindVals, FormularykindVals } from '../../src/models/widget'
import type { WidgetUsageT } from '../../src/lib/rows'

describe("usageLine", () => {
  const Cases: [WidgetUsageT, string, string][] = [
    // regular usage:
    [{ widgetings: 3, quizzes: 2, hunts: 1, at_least: false },       "Worked by 3 widgetings across 2 quizzes, in 1 hunt.",                                   'counts each, plural or not'],
    [{ widgetings: 1, quizzes: 1, hunts: 1, at_least: false },       "Worked by 1 widgeting across 1 quiz, in 1 hunt.",                                      'says one of each in the singular'],
    // nothing:
    [{ widgetings: 0, quizzes: 0, hunts: 0, at_least: false },       "No widgeting works it, in any hunt.",                                                  'says a widget nobody works is that'],
    // a count that stopped short:
    [{ widgetings: 999, quizzes: 40, hunts: 7, at_least: true },     "Worked by at least 999 widgetings across at least 40 quizzes, in at least 7 hunts.",   'says each count is a floor when the count stopped short'],
  ]
  for (const [usage, expected, describes] of Cases) {
    it(describes, () => {
      expect(usageLine(usage)).to.eq(expected)
    })
  }
})

describe("FormularyWords", () => {
  it("speaks of every formulary", () => {
    expect(Object.keys(FormularyWords)).to.have.members([...FormularykindVals])
  })
})

describe("EntryKindWords", () => {
  it("speaks of every kind of entry", () => {
    expect(Object.keys(EntryKindWords)).to.have.members([...EntryKindVals])
  })
})
