import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { Question } from '../../src/models/question'
import { ReservedWidgetingLabels, Widgeting, WidgetingValidators } from '../../src/models/widgeting'

const QuizId = 'k57a2tq9b3d1a1z6e0w6m9c4hd7r9x2s'
const HuntId = 'k67a2tq9b3d1a1z6e0w6m9c4hd7r9x2s'

describe('ReservedWidgetingLabels', () => {
  it("is every name a question already answers to: its exposed fields, its label's override, its rank, its place, viz and stamps in a jsonball, its views, and the questions themselves", () => {
    expect(ReservedWidgetingLabels).to.deep.eq([...Question.exposed, 'rank', 'position', 'viz', 'created_at', 'updated_at', 'butnot', 'question'])
  })

  it("leaves butnot_ishes free, now that it is a widgeting rather than a view", () => {
    expect(ReservedWidgetingLabels).not.to.include('butnot_ishes')
  })
})

describe('Widgeting.fill', () => {
  it("defaults the description to nothing, the params to none and the tier to a question's, per the doc example", () => {
    expect(Widgeting.fill({ widget_label: 'dumdum', label: 'dumdum' })).to.deep.eq({ widget_label: 'dumdum', label: 'dumdum', description: '', params: {}, tier: 'question' })
    expect(Widgeting.fill({ widget_label: 'dumdum', label: 'dumdum' }).params).to.deep.eq({})
  })

  it("keeps a widgeting that runs once for the quiz as a whole", () => {
    expect(Widgeting.fill({ widget_label: 'dumdum', label: 'winners', tier: 'quiz' }).tier).to.eq('quiz')
  })

  it("trims the description, and keeps params as given", () => {
    const widgeting = Widgeting.fill({ widget_label: 'dumdum', label: 'second_guess', description: '  Again.\n', params: { tries: 2, words: ['a'] } })
    expect(widgeting.description).to.eq('Again.')
    expect(widgeting.params).to.deep.eq({ tries: 2, words: ['a'] })
  })

  const TakenLabels: [string, string][] = [
    // a label like a reserved word, but not one:
    ["ranked",       'a word that begins with a reserved one'],
    ["my_title",     'a word that ends with a reserved one'],
    ["rank_2",       'a reserved word grown a suffix'],
    ["butnot_ishes", 'the BUT NOT ishes, which are no longer a view'],
  ]
  for (const [label, describes] of TakenLabels) {
    it(`takes ${describes}`, () => {
      expect(Widgeting.fill({ widget_label: 'dumdum', label }).label).to.eq(label)
    })
  }

  for (const label of ReservedWidgetingLabels) {
    it(`refuses the reserved label ${label}`, () => {
      expect(() => Widgeting.fill({ widget_label: 'dumdum', label })).to.throw(Z.ZodError)
    })
  }

  it("says which labels are reserved when it refuses one", () => {
    const result = WidgetingValidators.widgeting.safeParse({ widget_label: 'dumdum', label: 'notes' })
    expect(result.success).to.be.false
    expect(result.error?.issues[0]?.message).to.match(/should not be any of .*notes.*which the questions already use/)
  })

  it("lets a widgeting work a widget whose own label is reserved for widgetings", () => {
    expect(Widgeting.fill({ widget_label: 'notes', label: 'notes_2' }).widget_label).to.eq('notes')
  })

  const Refused: [object, string][] = [
    [{ label: 'Dum Dum' },                                'a label that is not one'],
    [{ widget_label: 'A B' },                             'a widget label that is not one'],
    [{ description: 'x'.repeat(3601) },                   'a description past 3600 characters'],
    [{ params: { Tries: 2 } },                            'a param named other than by a label'],
    [{ params: { blob: 'x'.repeat(4000) } },              'params whose JSON runs past 4000 characters'],
    [{ tier: 'realm' },                                   'a tier that is neither a question nor a quiz'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => WidgetingValidators.widgeting.parse({ widget_label: 'dumdum', label: 'dumdum', ...overrides })).to.throw(Z.ZodError)
    })
  }
})

describe('Widgeting.exposed', () => {
  it("is what it came to and whether it came to anything, whatever its formulary", () => {
    expect(Widgeting.exposed).to.deep.eq(['status', 'value'])
  })
})

describe('Widgeting.forWidget', () => {
  const ForWidgetCases: [string, string[], string, string][] = [
    // regular usage:
    ["dumdum",   [],                                 "dumdum",    'is labelled as its widget when that is free'],
    ["dumdum",   ["dumdum"],                         "dumdum_2",  'grows _2 when a sibling has the plain label'],
    ["dumdum",   ["dumdum", "dumdum_2"],             "dumdum_3",  'grows _3 when _2 is taken too'],
    ["dumdum",   ["dumdum_2"],                       "dumdum",    'takes the plain label when only a suffixed one is taken'],
    // reserved:
    ["notes",    [],                                 "notes_2",   'grows _2 on a widget labelled as a question field'],
    ["rank",     ["rank_2"],                         "rank_3",    'grows past a sibling on a reserved label'],
    ["butnot",   [],                                 "butnot_2",  'grows _2 on a widget labelled as a view of the question'],
  ]
  for (const [widgetLabel, taken, expected, describes] of ForWidgetCases) {
    it(describes, () => {
      expect(Widgeting.forWidget({ label: widgetLabel }, new Set(taken)).label).to.eq(expected)
    })
  }

  it("works the widget it is for, whatever label it takes", () => {
    expect(Widgeting.forWidget({ label: 'notes' }, new Set())).to.deep.eq({ widget_label: 'notes', label: 'notes_2', description: '', params: {}, tier: 'question' })
  })

  it("trims a 40-character widget label so the grown label still fits", () => {
    const long = 'a'.repeat(40)
    const widgeting = Widgeting.forWidget({ label: long }, new Set([long]))
    expect(widgeting.label).to.eq(`${'a'.repeat(38)}_2`)
    expect(widgeting.widget_label).to.eq(long)
  })
})

describe('WidgetingValidators.widgetingPatch', () => {
  it("takes any one revisable field alone, defaulting nothing else", () => {
    expect(WidgetingValidators.widgetingPatch({ description: 'Why.' })).to.deep.eq({ description: 'Why.' })
    expect(WidgetingValidators.widgetingPatch({})).to.deep.eq({})
  })

  it("refuses a reserved label", () => {
    expect(() => WidgetingValidators.widgetingPatch({ label: 'title' })).to.throw(Z.ZodError)
  })

  it("drops the widget it works, which a patch never changes", () => {
    expect(WidgetingValidators.widgetingPatch({ widget_label: 'numnum_hint', label: 'guesses' } as never)).to.deep.eq({ label: 'guesses' })
  })

  it("drops its tier, which a patch never changes", () => {
    expect(WidgetingValidators.widgetingPatch({ tier: 'quiz', description: 'Why.' } as never)).to.deep.eq({ description: 'Why.' })
  })
})

describe('WidgetingValidators.row', () => {
  const Row = { hunt_id: HuntId, quiz_id: QuizId, widget_label: 'dumdum', label: 'dumdum', description: '', params: {}, tier: 'question' as const, position: 0 }

  it("takes a widgeting as the database holds it", () => {
    expect(WidgetingValidators.row(Row)).to.deep.eq(Row)
  })

  const Refused: [object, string][] = [
    [{ ...Row, label: 'hint' },       'a reserved label'],
    [{ ...Row, position: -1 },        'a place before the first'],
    [{ ...Row, params: undefined },   'missing params, which a row never defaults'],
    [{ ...Row, tier: undefined },     'a missing tier, which a row never defaults'],
    [{ ...Row, label: 'recap' },      'the label of the recap a question now has'],
    [{ ...Row, quiz_id: 'princes' },  'a quiz named by label rather than id'],
    [{ ...Row, hunt_id: undefined },  'no hunt'],
  ]
  for (const [row, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => WidgetingValidators.row(row as never)).to.throw(Z.ZodError)
    })
  }
})
