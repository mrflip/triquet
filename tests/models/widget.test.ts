import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { AibotDefaultInput, AibotTokensMax, EntryFamilyOf, EntryFamilyVals, EntryKindVals, EntryParamsOf, EnumOptionsMax, FormularykindVals, JsonataDefaultInput, LiquidizeDefaultInput, OfferedEntryKindVals, Widget, WidgetValidators, entryParamsIssues, type EntryKind, type WidgetRowT } from '../../src/models/widget'

const Shout = { label: 'shout', formulary: 'jsonata', formula: '$uppercase(question.title)' } as const
const Guesser = {
  label:     'guesser',
  formulary: 'aibot',
  formula:   'Answer this: {{clueing}}',
  config:    { servicelabel: 'claude', model_tier: 'quick', max_tokens: 256 },
} as const
const Remark = { label: 'remark', formulary: 'entry', config: { entry_kind: 'text' } } as const
const Blurb = { label: 'blurb', formulary: 'liquidize', formula: '**{{ question.title }}**' } as const

describe('FormularykindVals', () => {
  it("names the four formularies a library widget can be worked by", () => {
    expect(FormularykindVals).to.deep.eq(['jsonata', 'aibot', 'entry', 'liquidize'])
  })
})

describe('Widget.fill', () => {
  it("defaults a jsonata widget's scope, title, description, input and config", () => {
    expect(Widget.fill(Shout)).to.deep.eq({ ...Shout, scope: 'pub', title: '', description: '', input_formula: '$', config: {} })
  })

  it("starts a jsonata widget's input as the whole bag, per the doc example", () => {
    expect(Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(question.title)' }).input_formula).to.eq(JsonataDefaultInput)
    expect(JsonataDefaultInput).to.eq('$')
  })

  it("starts an aibot widget's input as the clueing, for a {{clueing}} in its prompt", () => {
    const widget = Widget.fill(Guesser)
    expect(widget.input_formula).to.eq(AibotDefaultInput)
    expect(AibotDefaultInput).to.eq("{ 'clueing': question.clueing }")
    expect(widget.config).to.deep.eq(Guesser.config)
  })

  it("keeps a formula exactly as typed, newlines and surrounding space and all", () => {
    const formula = '  (\n  $x := 1;\n  $x\n)\n'
    expect(Widget.fill({ ...Shout, formula }).formula).to.eq(formula)
  })

  it("trims the description", () => {
    expect(Widget.fill({ ...Shout, description: '  Shouts.\n' }).description).to.eq('Shouts.')
  })

  it("lets an aibot formula run past a jsonata formula's bound, up to 3600", () => {
    expect(Widget.fill({ ...Guesser, formula: 'x'.repeat(3600) }).formula).to.have.lengthOf(3600)
  })

  it("gives an entry no formula and no input formula, and keeps its kind", () => {
    expect(Widget.fill(Remark)).to.deep.eq({ ...Remark, scope: 'pub', title: '', description: '', formula: '', input_formula: '' })
  })

  it("takes every kind of entry", () => {
    for (const entry_kind of EntryKindVals) { expect(Widget.fill({ ...Remark, config: { entry_kind } }).config.entry_kind).to.eq(entry_kind) }
  })

  it("keeps an entry's default params beside its kind, for its widgetings to start from", () => {
    expect(Widget.fill({ ...Remark, config: { entry_kind: 'number', min: 1, max: 10, integer: true } }).config).to.deep.eq({ entry_kind: 'number', min: 1, max: 10, integer: true })
    expect(Widget.fill({ ...Remark, config: { entry_kind: 'text', pattern: 'url' } }).config).to.deep.eq({ entry_kind: 'text', pattern: 'url' })
    expect(Widget.fill({ ...Remark, config: { entry_kind: 'enum', options: ['easy', 'hard'] } }).config).to.deep.eq({ entry_kind: 'enum', options: ['easy', 'hard'] })
  })

  it("defaults a liquidize widget's input to the whole bag and its config to none", () => {
    expect(Widget.fill(Blurb)).to.deep.eq({ ...Blurb, scope: 'pub', title: '', description: '', input_formula: LiquidizeDefaultInput, config: {} })
    expect(LiquidizeDefaultInput).to.eq('$')
  })

  it("lets a liquidize template run as long as a prompt, up to 3600", () => {
    expect(Widget.fill({ ...Blurb, formula: 'x'.repeat(3600) }).formula).to.have.lengthOf(3600)
  })

  it("takes the most room a model may be given, and no less than one token", () => {
    expect(Widget.fill({ ...Guesser, config: { ...Guesser.config, max_tokens: AibotTokensMax } }).config).to.have.property('max_tokens', 8000)
    expect(Widget.fill({ ...Guesser, config: { ...Guesser.config, max_tokens: 1 } }).config).to.have.property('max_tokens', 1)
  })

  const Refused: [object, string][] = [
    // either formulary:
    [{ ...Shout, label: 'Shout' },                                                  'a label that is not one'],
    [{ ...Shout, scope: 'mine' },                                                   'a scope there is not'],
    [{ ...Shout, formulary: 'gadget' },                                             'a formulary there is not'],
    [{ ...Shout, description: 'x'.repeat(3601) },                                   'a description past 3600 characters'],
    [{ ...Shout, title: 'x'.repeat(83) },                                           'a title past 82 characters'],
    [{ ...Shout, input_formula: '' },                                               'an empty input formula'],
    // jsonata:
    [{ ...Shout, formula: '' },                                                     'an empty jsonata formula'],
    [{ ...Shout, formula: 'x'.repeat(1000) },                                       'a jsonata formula past 999 characters'],
    [{ ...Shout, config: { max_tokens: 3 } },                                       'a jsonata widget with settings'],
    [{ ...Shout, config: Guesser.config },                                          'a jsonata widget with an aibot widget\'s settings'],
    // aibot:
    [{ ...Guesser, formula: '' },                                                   'an empty prompt'],
    [{ ...Guesser, formula: 'x'.repeat(3601) },                                     'a prompt past 3600 characters'],
    [{ ...Guesser, config: undefined },                                             'an aibot widget with no settings'],
    [{ ...Guesser, config: {} },                                                    'an aibot widget with empty settings'],
    [{ ...Guesser, config: { ...Guesser.config, servicelabel: 'openai' } },         'a service there is not'],
    [{ ...Guesser, config: { ...Guesser.config, model_tier: 'genius' } },           'a model tier there is not'],
    [{ ...Guesser, config: { ...Guesser.config, max_tokens: 0 } },                  'no room at all to answer'],
    [{ ...Guesser, config: { ...Guesser.config, max_tokens: AibotTokensMax + 1 } }, 'more room than any widget may give'],
    [{ ...Guesser, config: { ...Guesser.config, max_tokens: 2.5 } },                'a fraction of a token'],
    // entry:
    [{ ...Remark, formula: 'question.notes' },                                            'an entry with a formula'],
    [{ ...Remark, input_formula: '$' },                                             'an entry with an input formula'],
    [{ ...Remark, config: undefined },                                              'an entry with no kind'],
    [{ ...Remark, config: { entry_kind: 'date' } },                                 'a kind of entry there is not'],
    [{ ...Remark, config: { entry_kind: 'text', max: 3 } },                         'an entry with settings beyond its kind'],
    [{ ...Remark, config: { entry_kind: 'number', min: 10, max: 1 } },              'a number entry whose least is above its most'],
    [{ ...Remark, config: { entry_kind: 'percent', min: 120 } },                    "a percent entry whose least is above its preset most"],
    [{ ...Remark, config: { entry_kind: 'text', pattern: 'label', lines: 'many' } }, 'a text entry held to a pattern on many lines'],
    [{ ...Remark, config: { entry_kind: 'labelish', pattern: 'url' } },             'a preset of text given params of its own'],
    [{ ...Remark, config: { entry_kind: 'boolean', options: ['yes'] } },            'a yes-or-no entry with options'],
    // liquidize:
    [{ ...Blurb, formula: '' },                                                     'an empty template'],
    [{ ...Blurb, formula: 'x'.repeat(3601) },                                       'a template past 3600 characters'],
    [{ ...Blurb, config: { template: 'x' } },                                       'a liquidize widget with settings'],
  ]
  for (const [dna, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => Widget.fill(dna as never)).to.throw(Z.ZodError)
    })
  }
})

describe('WidgetValidators.widgetPatch', () => {
  it("takes any one revisable field alone, defaulting nothing else", () => {
    expect(WidgetValidators.widgetPatch({ title: 'Loud' })).to.deep.eq({ title: 'Loud' })
    expect(WidgetValidators.widgetPatch({})).to.deep.eq({})
  })

  it("takes any formulary's settings, for the widget's own formulary to judge once applied", () => {
    expect(WidgetValidators.widgetPatch({ config: {} }).config).to.deep.eq({})
    expect(WidgetValidators.widgetPatch({ config: Guesser.config }).config).to.deep.eq(Guesser.config)
    expect(WidgetValidators.widgetPatch({ config: Remark.config }).config).to.deep.eq(Remark.config)
  })

  it("takes a liquidize widget's template and input formula", () => {
    expect(WidgetValidators.widgetPatch({ formula: '{{ question.title }}', input_formula: '$' })).to.deep.eq({ formula: '{{ question.title }}', input_formula: '$' })
  })

  it("drops the scope, the label and the formulary, which are fixed once made", () => {
    expect(WidgetValidators.widgetPatch({ scope: 'pub', label: 'louder', formulary: 'aibot', title: 'Loud' } as never)).to.deep.eq({ title: 'Loud' })
  })

  const Refused: [object, string][] = [
    [{ formula: '' },                                  'an empty formula'],
    [{ formula: 'x'.repeat(3601) },                    'a formula past the larger of the two bounds'],
    [{ config: { servicelabel: 'claude' } },           'settings of neither shape'],
  ]
  for (const [patch, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => WidgetValidators.widgetPatch(patch as never)).to.throw(Z.ZodError)
    })
  }
})

describe('WidgetValidators.row', () => {
  const Base = { scope: 'pub', title: '', description: '', input_formula: '$', position: 0 } as const
  const JsonataRow = { ...Base, label: 'shout', formulary: 'jsonata', formula: '$uppercase(question.title)', config: {} } as const satisfies WidgetRowT
  const AibotRow = { ...Base, ...Guesser, input_formula: AibotDefaultInput, position: 1 } as const satisfies WidgetRowT
  const EntryRow = { ...Base, ...Remark, formula: '', input_formula: '', position: 2 } as const satisfies WidgetRowT
  const LiquidizeRow = { ...Base, ...Blurb, config: {}, position: 3 } as const satisfies WidgetRowT

  it("takes every formulary as the database holds it", () => {
    expect(WidgetValidators.row(JsonataRow)).to.deep.eq(JsonataRow)
    expect(WidgetValidators.row(AibotRow)).to.deep.eq(AibotRow)
    expect(WidgetValidators.row(EntryRow)).to.deep.eq(EntryRow)
    expect(WidgetValidators.row(LiquidizeRow)).to.deep.eq(LiquidizeRow)
  })

  const Refused: [object, string][] = [
    [{ ...JsonataRow, position: -1 },               'a place before the first'],
    [{ ...JsonataRow, position: undefined },        'no place at all'],
    [{ ...JsonataRow, title: undefined },           'a missing title, which a row never defaults'],
    [{ ...JsonataRow, formula: 'x'.repeat(1000) },  'a jsonata formula past 999 characters'],
    [{ ...AibotRow, formula: 'x'.repeat(3601) },    'a prompt past 3600 characters'],
    [{ ...AibotRow, formulary: 'jsonata' },         'an aibot widget\'s settings under the jsonata formulary'],
    [{ ...EntryRow, formula: '1' },                 'an entry with a formula'],
    [{ ...JsonataRow, formulary: 'entry' },         'a jsonata widget\'s formula under the entry formulary'],
    [{ ...LiquidizeRow, formula: '' },              'a liquidize widget with no template'],
  ]
  for (const [row, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => WidgetValidators.row(row as never)).to.throw(Z.ZodError)
    })
  }
})

describe('Widget.keyOf', () => {
  it("is the scope and the label", () => {
    expect(Widget.keyOf({ scope: 'pub', label: 'dumdum' })).to.eq('pub/dumdum')
  })
})

describe('Widget.titleOf', () => {
  it("reads a blank title as the label, titleized", () => {
    expect(Widget.titleOf({ label: 'clueing_full', title: '' })).to.eq('Clueing Full')
  })

  it("is the title when there is one", () => {
    expect(Widget.titleOf({ label: 'numnum_hint', title: 'Numnum: hint' })).to.eq('Numnum: hint')
  })
})

describe('Widget.exported', () => {
  it("is a row's fields without its place, per the doc example", () => {
    const row: WidgetRowT = { ...Widget.fill({ ...Guesser, label: 'dumdum' }), position: 4 }
    const exported = Widget.exported(row)
    expect(exported.label).to.eq('dumdum')
    expect(exported).to.deep.eq(Widget.fill({ ...Guesser, label: 'dumdum' }))
    expect(exported).not.to.have.property('position')
  })

  it("leaves a widget that has no place as it was", () => {
    expect(Widget.exported(Widget.fill(Shout))).to.deep.eq(Widget.fill(Shout))
  })

  it("drops anything else riding along on the row", () => {
    const row = { ...Widget.fill(Shout), position: 0, _id: 'w1', _creationTime: 5 }
    expect(Object.keys(Widget.exported(row)).toSorted((aa, bb) => aa.localeCompare(bb))).to.deep.eq(['config', 'description', 'formula', 'formulary', 'input_formula', 'label', 'scope', 'title'])
  })
})

describe('Widget.exported, for a liquidize widget', () => {
  it("is its fields, its template among them", () => {
    const row: WidgetRowT = { ...Widget.fill(Blurb), position: 5 }
    expect(Widget.exported(row)).to.deep.eq(Widget.fill(Blurb))
  })
})

describe('Widget.exported, for an entry', () => {
  it("is its fields, its formula and input formula empty", () => {
    const row: WidgetRowT = { ...Widget.fill(Remark), position: 3 }
    expect(Widget.exported(row)).to.deep.eq(Widget.fill(Remark))
  })
})

describe('Widget.flavorOf', () => {
  it("is what is fixed once a widget is made: its formulary, and an entry's kind", () => {
    expect(Widget.flavorOf(Widget.fill(Shout))).to.eq('a jsonata widget')
    expect(Widget.flavorOf(Widget.fill(Guesser))).to.eq('an aibot widget')
    expect(Widget.flavorOf(Widget.fill(Remark))).to.eq('a text entry')
    expect(Widget.flavorOf(Widget.fill(Blurb))).to.eq('a liquidize widget')
    expect(Widget.flavorOf(Widget.fill({ ...Remark, config: { entry_kind: 'number' } }))).to.eq('a number entry')
    expect(Widget.flavorOf(Widget.fill({ ...Remark, config: { entry_kind: 'estimates' } }))).to.eq('a category estimate entry')
  })

  it("names the yes-or-no and choice entries", () => {
    expect(Widget.flavorOf(Widget.fill({ ...Remark, config: { entry_kind: 'boolean' } }))).to.eq('a yes-or-no entry')
    expect(Widget.flavorOf(Widget.fill({ ...Remark, config: { entry_kind: 'enum', options: ['a'] } }))).to.eq('a choice entry')
  })

  it("tells two entries apart by kind alone", () => {
    expect(Widget.flavorOf({ formulary: 'entry', config: { entry_kind: 'labelish' } })).not.to.eq(Widget.flavorOf({ formulary: 'entry', config: { entry_kind: 'titleish' } }))
  })
})

describe('entryParamsIssues', () => {
  const Cases: [Parameters<typeof entryParamsIssues>, ReturnType<typeof entryParamsIssues>, string][] = [
    // regular usage:
    [['number', { min: 10, max: 1 }],              [{ path: ['max'], input: 1, message: 'should be no less than the least, «10»' }], 'a least above a most, per the doc example'],
    [['number', { min: 1, max: 1 }],               [],                                                                        'a least that is the most: one value'],
    [['number', { min: 1 }],                       [],                                                                        'a least with no most'],
    [['text', { pattern: 'url', lines: 'many' }],  [{ path: ['lines'], input: 'many', message: 'should be one: a pattern holds a cell to one line' }], 'a pattern on many lines'],
    [['text', { pattern: 'url', lines: 'one' }],   [],                                                                        'a pattern on one line'],
    [['text', { lines: 'many' }],                  [],                                                                        'many lines with no pattern'],
    [['labelish', { pattern: 'label', lines: 'many' }], [{ path: ['lines'], input: 'many', message: 'should be one: a pattern holds a cell to one line' }], 'a preset of text, as text'],
    [['percent', { min: 120 }],                    [{ path: ['max'], input: 100, message: 'should be no less than the least, «120»' }], "a percent's least above its preset most, per the doc example"],
    [['percent', { min: 120, max: 150 }],          [],                                                                        'a percent whose own most is past its least'],
    [['percent', { max: -5 }],                     [{ path: ['max'], input: -5, message: 'should be no less than the least, «0»' }], "a percent's most below its preset least"],
    // trivial cases:
    [['enum', { options: ['a'] }],                 [],                                                                        'a family with nothing to hold together'],
    [['number', {}],                               [],                                                                        'no params at all'],
  ]
  for (const [args, expected, describes] of Cases) {
    it(describes, () => {
      expect(entryParamsIssues(...args)).to.deep.eq(expected)
    })
  }
})

describe('EntryParamsOf', () => {
  it("has a validator for every kind, the presets of text taking none of their own", () => {
    expect(Object.keys(EntryParamsOf)).to.have.members([...EntryKindVals])
    expect(EntryParamsOf.labelish.safeParse({ pattern: 'url' }).success).to.be.false
    expect(EntryParamsOf.titleish.safeParse({}).success).to.be.true
  })

  it("gives one key per param, for an editor to draw a field for", () => {
    expect(Object.keys(EntryParamsOf.number.shape)).to.deep.eq(['min', 'max', 'integer'])
    expect(Object.keys(EntryParamsOf.text.shape)).to.deep.eq(['max_length', 'pattern', 'regex', 'lines'])
    expect(Object.keys(EntryParamsOf.enum.shape)).to.deep.eq(['options'])
    expect(Object.keys(EntryParamsOf.boolean.shape)).to.deep.eq([])
  })

  it("takes a text's own regular expression, its flags none unless said, beside a named pattern", () => {
    expect(EntryParamsOf.text.parse({ regex: { source: '^[A-Z]{3}$' } })).to.deep.eq({ regex: { source: '^[A-Z]{3}$', flags: '' } })
    expect(EntryParamsOf.text.parse({ pattern: 'oneline', regex: { source: String.raw`^\p{Lu}`, flags: 'iu' } })).to.deep.eq({ pattern: 'oneline', regex: { source: String.raw`^\p{Lu}`, flags: 'iu' } })
  })

  it("says why a regular expression will not compile, of its source", () => {
    const checked = EntryParamsOf.text.safeParse({ regex: { source: '(a', flags: '' } })
    expect(checked.error?.issues.map(({ path, message }) => ({ path, message }))).to.deep.eq([{ path: ['regex', 'source'], message: 'will not compile: Unterminated group' }])
  })

  it("trims each option, and keeps them in order", () => {
    expect(EntryParamsOf.enum.parse({ options: [' easy ', 'hard'] })).to.deep.eq({ options: ['easy', 'hard'] })
  })

  const Refused: [EntryKind, object, string][] = [
    ['number',    { min: 'one' },                         'a least that is not a number'],
    ['number',    { integer: 'yes' },                     'whole numbers said other than as a yes or no'],
    ['number',    { options: ['a'] },                     'a param of another family'],
    ['text',      { max_length: 0 },                      'room for no characters'],
    ['text',      { max_length: 3601 },                   'room for more than any text holds'],
    ['text',      { pattern: 'regex' },                   'a pattern that is not one of the named ones'],
    ['text',      { lines: 'two' },                       'a number of lines that is neither one nor many'],
    ['text',      { regex: '^a+$' },                      'a regular expression said as a string, without its flags beside it'],
    ['text',      { regex: { source: '' } },              'a regular expression with no source'],
    ['text',      { regex: { source: 'a'.repeat(201) } }, 'a regular expression past 200 characters'],
    ['text',      { regex: { source: 'a\nb' } },         'a regular expression of two lines'],
    ['text',      { regex: { source: '(a' } },            'a regular expression that will not compile'],
    ['text',      { regex: { source: String.raw`\p{L}` , flags: 'u' }, pattern: 'nope' }, 'a regular expression beside a pattern that is not one'],
    ['text',      { regex: { source: 'a', flags: 'g' } }, 'a regular expression flagged global, which remembers where it last matched'],
    ['text',      { regex: { source: 'a', flags: 'y' } }, 'a regular expression flagged sticky, which remembers where it last matched'],
    ['text',      { regex: { source: 'a', flags: 'ii' } }, 'a flag said twice'],
    ['text',      { regex: { source: 'a', flags: 'ui' } }, 'flags out of their order'],
    ['text',      { regex: { source: 'a', extra: 1 } },   'a regular expression with a field of its own beyond source and flags'],
    ['enum',      { options: ['a', 'a'] },                'an option named twice'],
    ['enum',      { options: [''] },                      'an empty option'],
    ['enum',      { options: ['two\nlines'] },            'an option of two lines'],
    ['enum',      { options: Array.from({ length: EnumOptionsMax + 1 }, (_unused, idx) => `option_${String(idx)}`) }, 'more options than an enum may offer'],
    ['boolean',   { default: true },                      'any param at all for a family that takes none'],
  ]
  for (const [entry_kind, params, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(EntryParamsOf[entry_kind].safeParse(params).success).to.be.false
    })
  }
})

describe('EntryFamilyOf', () => {
  it("is each kind's own family, but for the presets of text and of number", () => {
    expect(EntryKindVals.map((entry_kind) => EntryFamilyOf[entry_kind])).to.deep.eq(['text', 'number', 'number', 'boolean', 'enum', 'text', 'text', 'estimates'])
  })

  it("offers a new widget one kind per family, a percent beside the number, and neither preset of text", () => {
    expect(OfferedEntryKindVals).to.deep.eq(['text', 'number', 'percent', 'boolean', 'enum', 'estimates'])
    expect(OfferedEntryKindVals).to.include.members([...EntryFamilyVals])
    expect(OfferedEntryKindVals).not.to.include.members(['labelish', 'titleish'])
  })
})

describe('WidgetValidators.liquidizeParams', () => {
  const Cases: [unknown, boolean, string][] = [
    [{},                                                              true,  'nothing, so the widget\'s template'],
    [{ template: '{{ question.hint }}' },                                   true,  'a template of its own'],
    [{ template_from: { ref: 'dumdum' } },                            true,  'a template read from a widgeting'],
    [{ template_from: { ref: 'quiz.playtesters', formula: '$' } },    true,  'a template read from a widgeting for the whole quiz, by a formula'],
    [{ template: 'x', template_from: { ref: 'dumdum' } },              false, 'both'],
    [{ template_from: {} },                                           false, 'a template from nowhere'],
    [{ template_from: { ref: 'categories.masie' } },                  false, 'a ref in the grammar before October 2026'],
    [{ loud: true },                                                  false, 'a param it does not take'],
  ]
  for (const [params, passes, describes] of Cases) {
    it(`${passes ? 'takes' : 'refuses'} ${describes}`, () => {
      expect(WidgetValidators.liquidizeParams.safeParse(params).success).to.eq(passes)
    })
  }

  it("says of template_from that it may not stand beside a template", () => {
    const checked = WidgetValidators.liquidizeParams.safeParse({ template: 'x', template_from: { ref: 'dumdum' } })
    expect(checked.error?.issues.map((issue) => [issue.path, issue.message])).to.deep.eq([[['template_from'], 'should be left out beside a template of its own: say one or the other']])
  })
})
