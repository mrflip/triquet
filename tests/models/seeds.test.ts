import { describe, expect, it } from 'vitest'
import * as Runner from '../../src/lib/formulary/runner'
import { mintId } from '../../src/lib/ids'
import { defaultLayout } from '../../src/models/layout'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { DefaultWidgetings, SeedWidgets } from '../../src/models/seeds'
import { Widget, type WidgetT } from '../../src/models/widget'
import { Widgeting } from '../../src/models/widgeting'
import { Widgeted, type JsonT, type StoredWidgetedT, type WidgetedHistoryT, type WidgetedT } from '../../src/models/widgeted'
import { runOf } from '../support/runs'

/** A stored `ok` row holding `value` */
function okRow(value: JsonT, at = 1000): StoredWidgetedT {
  return { status: 'ok', value, message: null, result_meta: {}, _creationTime: at }
}

/** A stored `errored` row */
function erroredRow(at = 2000): StoredWidgetedT {
  return { status: 'errored', value: null, message: 'The model would not say.', result_meta: {}, _creationTime: at }
}

/** A number spotter's history that found `items` */
function found(...items: [string, number, 'numeral' | 'wordish'][]): WidgetedHistoryT {
  const row = okRow({ items: items.map(([text, value, kind]) => ({ text, value, kind })) })
  return { newest: row, ok: row }
}

const Failed: WidgetedHistoryT = { newest: erroredRow(), ok: null }

/** The seed labelled `label` */
function seed(label: string): WidgetT {
  const widget = SeedWidgets.find((each) => each.label === label)
  if (! widget) { throw new Error(`No seed called ${label}`) }
  return widget
}

describe('SeedWidgets', () => {
  it("is seventeen widgets, per the doc", () => {
    expect(SeedWidgets).to.have.lengthOf(17)
  })

  it("is each a valid widget, unchanged by filling it again", () => {
    for (const widget of SeedWidgets) { expect(Widget.fill(widget)).to.deep.eq(widget) }
  })

  it("has no label twice", () => {
    const labels = SeedWidgets.map((widget) => widget.label)
    expect(new Set(labels).size).to.eq(labels.length)
  })

  it("puts the three prompts first, then the BUT NOT ishes, then the sums", () => {
    expect(SeedWidgets.slice(0, 5).map((widget) => widget.label)).to.deep.eq(['dumdum', 'numnum_clueing', 'numnum_hint', 'butnot_ishes', 'clueing_full'])
  })

  it("finds numnum_hint as an aibot widget, per the doc example", () => {
    expect(SeedWidgets.find((widget) => widget.label === 'numnum_hint')?.formulary).to.eq('aibot')
  })

  it("asks dumdum quickly and the number spotters carefully, all of Claude", () => {
    expect(seed('dumdum').config).to.deep.eq({ servicelabel: 'claude', model_tier: 'quick', max_tokens: 256 })
    expect(seed('numnum_clueing').config).to.deep.eq({ servicelabel: 'claude', model_tier: 'careful', max_tokens: 4000 })
    expect(seed('numnum_hint').config).to.deep.eq({ servicelabel: 'claude', model_tier: 'careful', max_tokens: 4000 })
  })

  it("has three aibot widgets and fourteen jsonata ones", () => {
    expect(SeedWidgets.filter((widget) => widget.formulary === 'aibot')).to.have.lengthOf(3)
    expect(SeedWidgets.filter((widget) => widget.formulary === 'jsonata')).to.have.lengthOf(14)
  })

  describe('the prompts', () => {
    it("asks dumdum for a first-instinct read of the clueing, not an expert one", () => {
      expect(seed('dumdum').formula).to.include('fast, not-especially-careful player')
      expect(seed('dumdum').formula).to.match(/first-instinct/)
      expect(seed('dumdum').formula).to.match(/not a careful expert analysis/)
      expect(seed('dumdum').formula).to.include('{{clueing}}')
    })

    it("addresses each number spotter to its own text", () => {
      expect(seed('numnum_clueing').formula).to.include('Question: {{clueing}}')
      expect(seed('numnum_hint').formula).to.include('Hint: {{hint}}')
      expect(seed('numnum_hint').formula).not.to.include('{{clueing}}')
    })

    it("names the two ish kinds and what separates them", () => {
      for (const label of ['numnum_clueing', 'numnum_hint']) {
        expect(seed(label).formula).to.match(/digits .* kind "numeral"/)
        expect(seed(label).formula).to.match(/kind "wordish"/)
        expect(seed(label).formula).to.include('"300 million" is one item worth 300000000')
      }
    })

    it("rules out the two things a player would not count", () => {
      for (const label of ['numnum_clueing', 'numnum_hint']) {
        expect(seed(label).formula).to.match(/indefinite article/)
        expect(seed(label).formula).to.match(/Roman numerals/)
      }
    })

    it("asks each number spotter for an object of items, which the sums read", () => {
      for (const label of ['numnum_clueing', 'numnum_hint']) {
        expect(seed(label).formula).to.include('{"items": [...]}')
      }
    })
  })
})

describe('DefaultWidgetings', () => {
  it("names the four that read the bots first, per the doc example", () => {
    expect(DefaultWidgetings.map((widgeting) => widgeting.label).slice(0, 4)).to.deep.eq(['dumdum', 'numnum_clueing', 'numnum_hint', 'butnot_ishes'])
  })

  it("is twelve, each labelled as the seed widget it works", () => {
    expect(DefaultWidgetings).to.have.lengthOf(12)
    const seedLabels = new Set(SeedWidgets.map((widget) => widget.label))
    for (const widgeting of DefaultWidgetings) {
      expect(seedLabels.has(widgeting.widget_label)).to.be.true
      expect(widgeting.label).to.eq(widgeting.widget_label)
    }
  })

  it("is each a valid widgeting", () => {
    for (const widgeting of DefaultWidgetings) { expect(Widgeting.fill(widgeting)).to.deep.eq(widgeting) }
  })

  it("runs each sum after the number spotter it reads", () => {
    const labels = DefaultWidgetings.map((widgeting) => widgeting.label)
    const lastBot = Math.max(labels.indexOf('numnum_clueing'), labels.indexOf('numnum_hint'))
    for (const label of ['clueing_full', 'clueing_numeral', 'hint_full', 'hint_numeral', 'butnot_full', 'butnot_numeral', 'clueing_plus_rank', 'clueing_plus_butnot_full']) {
      expect(labels.indexOf(label)).to.be.greaterThan(lastBot)
    }
  })
})

describe('the seeded formulas, run', () => {
  // `alpha` chains to `beta`, so alpha's BUT NOT sums read beta's hint.
  const alphaId = mintId()
  const betaId = mintId()

  /** A quiz with the default layout: alpha (Q#1) and beta (Q#2), each holding `stored` */
  function quizHolding(alphaStored: QuestionT['stored'], betaStored: QuestionT['stored'] = {}) {
    const alpha = Question.fill({ _id: alphaId, label: 'alpha', qnum: '1', clueing: 'Three blind mice', hint: 'Seven seas', chains_to: betaId, stored: alphaStored })
    const beta = Question.fill({ _id: betaId, label: 'beta', qnum: '2', clueing: 'Two', hint: '', stored: betaStored })
    return { ...Quiz.blank(), ...defaultLayout(), questions: [alpha, beta] }
  }

  /** What `label` came to for alpha */
  function alphaOf(label: string, alphaStored: QuestionT['stored'], betaStored: QuestionT['stored'] = {}): WidgetedT {
    return Runner.widgetedOf(runOf(quizHolding(alphaStored, betaStored)), label, alphaId)
  }

  const Spotted = {
    numnum_clueing: found(['Three', 3, 'wordish'], ['300', 300, 'numeral'], ['2.5', 2.5, 'numeral']),
    numnum_hint:    found(['Seven', 7, 'wordish']),
  }
  const BetaSpotted = { numnum_hint: found(['40', 40, 'numeral'], ['four', 4, 'wordish']) }

  const SumCases: [string, WidgetedT, string][] = [
    ["clueing_full",             Widgeted.ok(306),   'adds every span of the clueing, rounding a half upward'],
    ["clueing_numeral",          Widgeted.ok(303),   'adds only the spans of the clueing written in digits'],
    ["hint_full",                Widgeted.ok(7),     'adds every span of its own hint'],
    ["hint_numeral",             Widgeted.ok(0),     'is nought, not missing, when the hint was read and has no digits'],
    ["butnot_full",              Widgeted.ok(44),    'adds every span of the hint of the question it chains to'],
    ["butnot_numeral",           Widgeted.ok(40),    'adds the digit spans of the hint of the question it chains to'],
    ["clueing_plus_rank",        Widgeted.ok(307),   'adds its rank to the clueing sum'],
    ["clueing_plus_butnot_full", Widgeted.ok(350),   'adds the clueing sum and the chained-to hint sum'],
  ]
  for (const [label, expected, describes] of SumCases) {
    it(`${label} ${describes}`, () => {
      expect(alphaOf(label, Spotted, BetaSpotted)).to.deep.eq(expected)
    })
  }

  it("shows the chained-to question's spotted hint as the BUT NOT ishes", () => {
    expect(alphaOf('butnot_ishes', Spotted, BetaSpotted)).to.deep.eq(Widgeted.ok(BetaSpotted.numnum_hint.newest.value))
  })

  it("comes to missing, not nought, for every sum when nobody has asked yet", () => {
    for (const [label] of SumCases) { expect(alphaOf(label, {}).status).to.eq('missing') }
  })

  it("comes to missing, not nought, for every sum when the asks failed", () => {
    for (const [label] of SumCases) { expect(alphaOf(label, { numnum_clueing: Failed, numnum_hint: Failed }, { numnum_hint: Failed }).status).to.eq('missing') }
  })

  it("sums the older value when a newer ask failed on top of it", () => {
    const history = { newest: erroredRow(3000), ok: Spotted.numnum_clueing.ok }
    expect(alphaOf('clueing_full', { numnum_clueing: history })).to.deep.eq(Widgeted.ok(306))
  })

  it("leaves the BUT NOT sums missing for a question that chains to nothing", () => {
    const run = runOf(quizHolding(Spotted, BetaSpotted))
    expect(Runner.widgetedOf(run, 'butnot_full', betaId).status).to.eq('missing')
    expect(Runner.widgetedOf(run, 'clueing_plus_butnot_full', betaId).status).to.eq('missing')
  })

  it("leaves the BUT NOT sums missing when only the question's own clueing was read", () => {
    expect(alphaOf('butnot_full', Spotted).status).to.eq('missing')
    expect(alphaOf('clueing_plus_butnot_full', Spotted).status).to.eq('missing')
  })

  it("shows the bots' stored answers as their own widgeteds", () => {
    expect(alphaOf('numnum_clueing', Spotted)).to.deep.eq(Widgeted.ok(Spotted.numnum_clueing.newest.value))
    expect(alphaOf('dumdum', {}).status).to.eq('missing')
    expect(alphaOf('numnum_hint', { numnum_hint: Failed }).status).to.eq('errored')
  })

  it("asks each bot about its own text, trimmed, and nothing about a blank one", () => {
    const quiz = quizHolding({})
    quiz.questions[0] = { ...quiz.questions[0]!, clueing: '  Three blind mice \n' }
    const run = runOf(quiz)
    expect(Runner.inputOf(run, 'dumdum', alphaId)).to.deep.eq({ status: 'ok', input: { clueing: 'Three blind mice' } })
    expect(Runner.inputOf(run, 'numnum_clueing', alphaId)).to.deep.eq({ status: 'ok', input: { clueing: 'Three blind mice' } })
    expect(Runner.inputOf(run, 'numnum_hint', alphaId)).to.deep.eq({ status: 'ok', input: { hint: 'Seven seas' } })
    expect(Runner.inputOf(run, 'numnum_hint', betaId)).to.deep.eq({ status: 'missing' })
  })

  it("comes to missing for a blank clueing too", () => {
    const quiz = quizHolding({})
    quiz.questions[1] = { ...quiz.questions[1]!, clueing: ' '.repeat(3) }
    expect(Runner.inputOf(runOf(quiz), 'dumdum', betaId)).to.deep.eq({ status: 'missing' })
  })
})
