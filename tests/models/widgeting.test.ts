import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { Question } from '../../src/models/question'
import { EntryParamnames, ReservedWidgetingLabels, Widgeting, WidgetingValidators } from '../../src/models/widgeting'

const QuizId = 'k57a2tq9b3d1a1z6e0w6m9c4hd7r9x2s'
const HuntId = 'k67a2tq9b3d1a1z6e0w6m9c4hd7r9x2s'

describe('ReservedWidgetingLabels', () => {
  it("is every name a question already answers to: its exposed fields, its rank and viz flags, its place, viz and stamps in a jsonball, its views, the questions themselves, its place in a recap and its label's override", () => {
    expect(ReservedWidgetingLabels.slice(0, Question.exposed.length + 11)).to.deep.eq([...Question.exposed, 'rank', 'archived', 'secondary', 'position', 'viz', 'created_at', 'updated_at', 'butnot', 'question', 'number', 'forced_label'])
  })

  const Groups: [readonly string[], string][] = [
    [['hunt', 'realm', 'quiz', 'qns', 'qn', 'qn_label', 'quiz_label', 'params', 'widgeting_label'],  "the bag's top-level keys"],
    [['status', 'value', 'err', 'message', 'result_meta', 'digest', 'stale'],                           "a widgeted's keys, and the two of its staleness"],
    [['source', 'formula', 'template', 'readout', 'collapsed', 'width_px', 'align'],                    "a column's fields, the stages it may say among them"],
    [['masie', 'artie', 'poppy', 'estimates', 'average'],                                               "a category-estimate widgeted's keys"],
  ]
  for (const [words, describes] of Groups) {
    it(`holds ${describes}`, () => {
      expect(ReservedWidgetingLabels).to.include.members([...words])
    })
  }

  it("leaves categories free, which the library's category-estimate widget and its widgetings are labelled", () => {
    expect(ReservedWidgetingLabels).not.to.include('categories')
  })

  it("names each word once", () => {
    expect(new Set(ReservedWidgetingLabels).size).to.eq(ReservedWidgetingLabels.length)
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

  it("says why it refuses a reserved label, of the label refused", () => {
    const result = WidgetingValidators.widgeting.safeParse({ widget_label: 'dumdum', label: 'notes' })
    expect(result.success).to.be.false
    expect(result.error?.issues[0]?.message).to.eq('is a name a question, its cells or the bag already answer to: add to it, as my_label or label_2')
    expect(result.error?.issues[0]?.input).to.eq('notes')
  })

  it("lets a widgeting work a widget whose own label is reserved for widgetings", () => {
    expect(Widgeting.fill({ widget_label: 'notes', label: 'notes_2' }).widget_label).to.eq('notes')
  })

  it("takes a param an entry family names, though the word is reserved", () => {
    expect(Widgeting.fill({ widget_label: 'figure', label: 'grade', params: { min: 1, max: 10, integer: true } }).params).to.deep.eq({ min: 1, max: 10, integer: true })
  })

  const Refused: [object, string][] = [
    [{ params: { total: 3 } },                            'a param under a reserved word no entry family names'],
    [{ label: 'Dum Dum' },                                'a label that is not one'],
    [{ widget_label: 'A B' },                             'a widget label that is not one'],
    [{ description: 'x'.repeat(3601) },                   'a description past 3600 characters'],
    [{ params: { Tries: 2 } },                            'a param named other than in the shape of a label'],
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

describe('Widgeting.runsAt', () => {
  const RunsAtCases = [
    // regular usage:
    [{ formulary: 'jsonata', config: {} },                                                     'quiz',     true,  'a formula runs once for the whole quiz'],
    [{ formulary: 'entry', config: { entry_kind: 'text' } },                                   'quiz',     true,  'a text entry runs once for the whole quiz'],
    [{ formulary: 'entry', config: { entry_kind: 'number' } },                                 'quiz',     true,  'a number entry runs once for the whole quiz'],
    [{ formulary: 'entry', config: { entry_kind: 'boolean' } },                                'quiz',     true,  'a yes-or-no entry runs once for the whole quiz'],
    [{ formulary: 'entry', config: { entry_kind: 'enum' } },                                   'quiz',     true,  'a choice entry runs once for the whole quiz'],
    [{ formulary: 'entry', config: { entry_kind: 'titleish' } },                               'quiz',     true,  'a preset of text runs once for the whole quiz, as text does'],
    // refused at the quiz's level:
    [{ formulary: 'aibot', config: { servicelabel: 'claude', model_tier: 'quick', max_tokens: 9 } }, 'quiz', false, 'a model asked from a cell has no cell at the quiz\'s level'],
    [{ formulary: 'entry', config: { entry_kind: 'estimates' } },                              'quiz',     false, 'a question\'s category estimates are no value of the quiz'],
    // every widget runs for each question:
    [{ formulary: 'aibot', config: { servicelabel: 'claude', model_tier: 'quick', max_tokens: 9 } }, 'question', true, 'a model runs for each question'],
    [{ formulary: 'entry', config: { entry_kind: 'estimates' } },                              'question', true,  'category estimates run for each question'],
  ] as const

  for (const [widget, tier, expected, title] of RunsAtCases) {
    it(title, () => {
      expect(Widgeting.runsAt(widget, tier)).to.eq(expected)
    })
  }
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

describe('EntryParamnames', () => {
  it("is every name an entry family gives a param, the reserved ones among them", () => {
    expect([...EntryParamnames]).to.have.members(['min', 'max', 'integer', 'max_length', 'pattern', 'regex', 'lines', 'options'])
  })

  it("lets a widgeting's params name a text's regular expression, though `regex` is a reserved word", () => {
    expect(Widgeting.fill({ widget_label: 'memo', label: 'airport', params: { regex: { source: '^[A-Z]{3}$', flags: '' } } }).params).to.deep.eq({ regex: { source: '^[A-Z]{3}$', flags: '' } })
    expect(WidgetingValidators.widgeting.safeParse({ widget_label: 'memo', label: 'regex' }).success).to.be.false
  })
})
