import { describe, expect, it } from 'vitest'
import { EntryKindWords, FormularyWords, StatusWords, statusLine, statusPhrases, usageLine } from '../../src/components/widget-words'
import { EntryKindVals, FormularykindVals } from '../../src/models/widget'
import { WidgetedStatusVals } from '../../src/models/widgeted'
import type { StatusCounts } from '../../src/lib/formulary/runner'
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

describe("statusLine", () => {
  const Cases: [StatusCounts, string, string][] = [
    // regular counts:
    [{ ok: 3, errored: 1, missing: 6 },    "3 current • 1 errored • 6 blank",  'says every status some cell has, current first and blank last'],
    [{ ok: 17, errored: 0, missing: 0 },   "17 current",                        'says a widgeting whose every cell is current in one count'],
    // zero counts:
    [{ ok: 0, errored: 0, missing: 12 },   "12 blank",                          'leaves out a status no cell has'],
    [{ ok: 2, errored: 0, missing: 1 },    "2 current • 1 blank",               'closes up around a status left out'],
    // nothing to count:
    [{ ok: 0, errored: 0, missing: 0 },    "no questions yet",                  'says a quiz with no questions has nothing to count'],
  ]
  for (const [counts, expected, describes] of Cases) {
    it(describes, () => {
      expect(statusLine(counts)).to.eq(expected)
    })
  }
})

describe("statusPhrases", () => {
  it("names the status of each phrase, for a view that marks one out", () => {
    expect(statusPhrases({ ok: 3, errored: 1, missing: 0 })).to.deep.eq([{ status: 'ok', said: '3 current' }, { status: 'errored', said: '1 errored' }])
  })

  it("is empty when there is nothing to count", () => {
    expect(statusPhrases({ ok: 0, errored: 0, missing: 0 })).to.deep.eq([])
  })
})

describe("StatusWords", () => {
  it("speaks of every status", () => {
    expect(Object.keys(StatusWords)).to.have.members([...WidgetedStatusVals])
  })
})
