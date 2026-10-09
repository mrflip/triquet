import { describe, expect, it } from 'vitest'
import { EntryKindWords, FormularyWords, ParamWords, StatusWords, TextLinesWords, TextPatternWords, paramsGist, statusLine, templateFromGist, statusPhrases, usageLine } from '../../src/components/widget-words'
import { EntryKindVals, EntryParamsOf, FormularykindVals, TextLinesVals, TextPatternVals } from '../../src/models/widget'
import type { EntryInForceT } from '../../src/lib/formulary/entry'
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

describe("ParamWords, TextPatternWords and TextLinesWords", () => {
  it("name every param any family takes, and every pattern and number of lines", () => {
    const paramnames = new Set(Object.values(EntryParamsOf).flatMap((validator) => Object.keys(validator.shape)))
    expect(Object.keys(ParamWords)).to.have.members([...paramnames])
    expect(Object.keys(TextPatternWords)).to.have.members([...TextPatternVals])
    expect(Object.keys(TextLinesWords)).to.have.members([...TextLinesVals])
  })
})

describe("paramsGist", () => {
  const Cases: [EntryInForceT, string, string][] = [
    // regular usage, the doc examples among them:
    [{ family: 'number', params: { min: 1, max: 10, integer: true } },  "Whole numbers from 1 to 10.",                    'a number between bounds, whole'],
    [{ family: 'number', params: { min: 0 } },                          "Numbers from 0 up.",                             'a number with a least alone'],
    [{ family: 'number', params: { max: 5 } },                          "Numbers up to 5.",                               'a number with a most alone'],
    [{ family: 'number', params: { integer: true } },                   "Whole numbers.",                                 'a whole number, unbounded'],
    [{ family: 'text', params: { pattern: 'url', max_length: 200 } },   "A web address, at most 200 characters.",         'a text held to a pattern and a length'],
    [{ family: 'text', params: { lines: 'one' } },                      "One line.",                                      'a text of one line'],
    [{ family: 'text', params: { max_length: 9 } },                     "At most 9 characters.",                          'a text of a length alone'],
    [{ family: 'text', params: { regex: { source: '^[A-Z]{3}$', flags: '' } } }, "Matching /^[A-Z]{3}$/.",            'a text held to its own regular expression'],
    [{ family: 'text', params: { pattern: 'oneline', regex: { source: 'otter', flags: 'i' }, max_length: 40 } }, "One line of anything, matching /otter/i, at most 40 characters.", 'a text held to a named pattern, its own regular expression and a length'],
    [{ family: 'enum', params: { options: ['easy', 'hard'] } },         "One of: easy, hard.",                            'a choice of its options'],
    [{ family: 'enum', params: {} },                                    "No options yet: give its widgeting some.",       'a choice with nothing to choose'],
    // nothing to say:
    [{ family: 'text', params: {} },                                    "",                                               'a text that says nothing'],
    [{ family: 'number', params: {} },                                  "",                                               'a number that says nothing'],
    [{ family: 'boolean', params: {} },                                 "",                                               'a yes or no, which takes no params'],
    [{ family: 'estimates', params: {} },                               "",                                               'category estimates, which take no params'],
  ]
  for (const [cell, expected, describes] of Cases) {
    it(describes, () => {
      expect(paramsGist(cell)).to.eq(expected)
    })
  }
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

describe("templateFromGist", () => {
  it("names where a template is read from, and by what formula", () => {
    expect(templateFromGist({ ref: 'notes' })).to.eq('Read from notes, for each question.')
    expect(templateFromGist({ ref: 'dumdum', formula: '$.value.template' })).to.eq('Read from dumdum by $.value.template, for each question.')
  })
})
