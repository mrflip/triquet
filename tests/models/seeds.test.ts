import { describe, expect, it } from 'vitest'
import * as Columns from '../../src/lib/columns'
import * as Runner from '../../src/lib/formulary/runner'
import { mintId } from '../../src/lib/ids'
import * as Labelmaker from '../../src/lib/labelmaker'
import { classicLayout } from '../support/layouts'
import { Question, type QuestionT } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { DefaultWidgetings, SeedPresets, SeedWidgets } from '../../src/models/seeds'
import { EntryFamilyVals, Widget, type WidgetT } from '../../src/models/widget'
import { ReservedWidgetingLabels, Widgeting } from '../../src/models/widgeting'
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
  it("is twenty-two widgets, per the doc", () => {
    expect(SeedWidgets).to.have.lengthOf(22)
  })

  it("holds an entry of each family, the category estimates among them, and no preset of text", () => {
    const entries = SeedWidgets.flatMap((widget) => (widget.formulary === 'entry' ? [[widget.label, widget.config.entry_kind]] : []))
    expect(entries).to.deep.eq([['category_data', 'estimates'], ['memo', 'text'], ['figure', 'number'], ['yes_no', 'boolean'], ['choice', 'enum']])
    expect(entries.map(([, entry_kind]) => entry_kind)).to.have.members([...EntryFamilyVals])
  })

  it("labels none of them a word every label is kept from, nor one a widgeting of it could not take", () => {
    expect(SeedWidgets.filter((widget) => Labelmaker.isReserved(widget.label)).map((widget) => widget.label)).to.deep.eq([])
    expect(SeedWidgets.filter((widget) => ReservedWidgetingLabels.includes(widget.label)).map((widget) => widget.label)).to.deep.eq([])
  })

  it("holds the category-estimate entry, whose description names the parts a column can show", () => {
    expect(seed('category_data').config).to.deep.eq({ entry_kind: 'estimates' })
    expect(seed('category_data').description).to.contain('qn.category_data.masie')
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

describe('SeedPresets', () => {
  it("offers the two sums for each number spotter, and for the BUT NOT ishes, which hold a spotter's reply", () => {
    expect(SeedPresets.keys().toArray()).to.deep.eq(['numnum_clueing', 'numnum_hint', 'butnot_ishes'])
    for (const presets of SeedPresets.values()) { expect(presets.map(({ title }) => title)).to.deep.eq(['Every number-like span, added up', 'The spans written in digits, added up']) }
  })

  it("names each preset's column as the classic sum column it stands in for, after a seed of the library", () => {
    const named = SeedPresets.values().flatMap((presets) => presets.map(({ names }) => names)).toArray()
    expect(named.map(({ label }) => label)).to.deep.eq(['clueing_full', 'clueing_numeral', 'hint_full', 'hint_numeral', 'butnot_full', 'butnot_numeral'])
    expect(named.map(({ title }) => title)).to.deep.eq(['Clueing Full Sum', 'Clueing Numeral Sum', 'Hint Full Sum', 'Hint Numeral Sum', 'BUT NOT Full Sum', 'BUT NOT Numeral Sum'])
    for (const { label } of named) { expect(SeedWidgets.map((widget) => widget.label)).to.include(label) }
  })

  it("is offered only for seeds the library holds", () => {
    for (const label of SeedPresets.keys()) { expect(seed(label).label).to.eq(label) }
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
    return { ...Quiz.blank(), ...classicLayout(), questions: [alpha, beta] }
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

  /** What a column showing the widgeting `source`, worked by its `idx`th seeded preset, shows for alpha */
  function presetOf(source: string, idx: number, alphaStored: QuestionT['stored'], betaStored: QuestionT['stored'] = {}): WidgetedT {
    const quiz = quizHolding(alphaStored, betaStored)
    const shown = Columns.resolve(source, quiz.widgetings)
    const formula = SeedPresets.get(source)?.[idx]?.formula
    if (! shown || formula === undefined) { throw new Error(`No preset ${String(idx)} for ${source}`) }
    return Columns.shownOf({ source: shown, formula }, runOf(quiz), [], alphaId)
  }

  describe('as presets on a column', () => {
    // Each preset beside the seeded sum it stands in for: the spotter shown, the preset's place, the sum.
    const Standins: [string, number, string][] = [
      ['numnum_clueing', 0, 'clueing_full'],
      ['numnum_clueing', 1, 'clueing_numeral'],
      ['numnum_hint',    0, 'hint_full'],
      ['numnum_hint',    1, 'hint_numeral'],
      ['butnot_ishes',   0, 'butnot_full'],
      ['butnot_ishes',   1, 'butnot_numeral'],
    ]

    for (const [source, idx, sum] of Standins) {
      it(`comes to what ${sum} does, on a column showing ${source}`, () => {
        expect(presetOf(source, idx, Spotted, BetaSpotted)).to.deep.eq(alphaOf(sum, Spotted, BetaSpotted))
      })
    }

    it("comes to missing, as the sums do, when nobody has asked, and shows the badge when the ask failed", () => {
      for (const [source, idx] of Standins) {
        expect(presetOf(source, idx, {}).status).to.eq('missing')
      }
      expect(presetOf('numnum_hint', 0, { numnum_hint: Failed }).status).to.eq('errored')
      expect(presetOf('butnot_ishes', 0, Spotted, { numnum_hint: Failed }).status).to.eq('missing')
    })
  })

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
