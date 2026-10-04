import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { AibotDefaultInput, AibotTokensMax, FormularykindVals, JsonataDefaultInput, Widget, WidgetValidators, type WidgetRowT } from '../../src/models/widget'

const Shout = { label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)' } as const
const Guesser = {
  label:     'guesser',
  formulary: 'aibot',
  formula:   'Answer this: {{clueing}}',
  config:    { servicelabel: 'claude', model_tier: 'quick', max_tokens: 256 },
} as const

describe('FormularykindVals', () => {
  it("names the two formularies a library widget can be worked by", () => {
    expect(FormularykindVals).to.deep.eq(['jsonata', 'aibot'])
  })
})

describe('Widget.fill', () => {
  it("defaults a jsonata widget's scope, title, description, input and config", () => {
    expect(Widget.fill(Shout)).to.deep.eq({ ...Shout, scope: 'pub', title: '', description: '', input_formula: '$', config: {} })
  })

  it("starts a jsonata widget's input as the whole bag, per the doc example", () => {
    expect(Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)' }).input_formula).to.eq(JsonataDefaultInput)
    expect(JsonataDefaultInput).to.eq('$')
  })

  it("starts an aibot widget's input as the clueing, for a {{clueing}} in its prompt", () => {
    const widget = Widget.fill(Guesser)
    expect(widget.input_formula).to.eq(AibotDefaultInput)
    expect(AibotDefaultInput).to.eq("{ 'clueing': qn.clueing }")
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

  it("takes the most room a model may be given, and no less than one token", () => {
    expect(Widget.fill({ ...Guesser, config: { ...Guesser.config, max_tokens: AibotTokensMax } }).config).to.have.property('max_tokens', 8000)
    expect(Widget.fill({ ...Guesser, config: { ...Guesser.config, max_tokens: 1 } }).config).to.have.property('max_tokens', 1)
  })

  const Refused: [object, string][] = [
    // either formulary:
    [{ ...Shout, label: 'Shout' },                                                  'a label that is not one'],
    [{ ...Shout, scope: 'mine' },                                                   'a scope there is not'],
    [{ ...Shout, formulary: 'entry' },                                              'a formulary there is not yet'],
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

  it("takes either formulary's settings, for the widget's own formulary to judge once applied", () => {
    expect(WidgetValidators.widgetPatch({ config: {} }).config).to.deep.eq({})
    expect(WidgetValidators.widgetPatch({ config: Guesser.config }).config).to.deep.eq(Guesser.config)
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
  const JsonataRow = { ...Base, label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)', config: {} } as const satisfies WidgetRowT
  const AibotRow = { ...Base, ...Guesser, input_formula: AibotDefaultInput, position: 1 } as const satisfies WidgetRowT

  it("takes either formulary as the database holds it", () => {
    expect(WidgetValidators.row(JsonataRow)).to.deep.eq(JsonataRow)
    expect(WidgetValidators.row(AibotRow)).to.deep.eq(AibotRow)
  })

  const Refused: [object, string][] = [
    [{ ...JsonataRow, position: -1 },               'a place before the first'],
    [{ ...JsonataRow, position: undefined },        'no place at all'],
    [{ ...JsonataRow, title: undefined },           'a missing title, which a row never defaults'],
    [{ ...JsonataRow, formula: 'x'.repeat(1000) },  'a jsonata formula past 999 characters'],
    [{ ...AibotRow, formula: 'x'.repeat(3601) },    'a prompt past 3600 characters'],
    [{ ...AibotRow, formulary: 'jsonata' },         'an aibot widget\'s settings under the jsonata formulary'],
  ]
  for (const [row, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => WidgetValidators.row(row as never)).to.throw(Z.ZodError)
    })
  }
})

describe('WidgetValidators.library', () => {
  it("is every widget, in library order, defaulted as each is filled", () => {
    const library = WidgetValidators.library({ widgets: [Guesser, Shout] })
    expect(library.widgets.map((widget) => widget.label)).to.deep.eq(['guesser', 'shout'])
    expect(library.widgets[1]).to.deep.eq(Widget.fill(Shout))
  })

  it("refuses a widget that is not one", () => {
    expect(() => WidgetValidators.library({ widgets: [{ ...Shout, formula: '' }] })).to.throw(Z.ZodError)
  })
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
