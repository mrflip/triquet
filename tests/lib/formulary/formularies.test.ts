import { describe, expect, it } from 'vitest'
import { Formularies, formularyFor, paramsOf } from '../../../src/lib/formulary/formularies'
import { AibotFormulary } from '../../../src/lib/formulary/aibot'
import { EntryFormulary } from '../../../src/lib/formulary/entry'
import { JsonataFormulary } from '../../../src/lib/formulary/jsonata'
import { LiquidizeFormulary } from '../../../src/lib/formulary/liquidize'
import { FormularykindVals, Widget, type WidgetT } from '../../../src/models/widget'

describe('Formularies', () => {
  it('holds one formulary for every kind a widget can name, each reporting its own kind', () => {
    expect(Object.keys(Formularies)).to.deep.eq([...FormularykindVals])
    expect(Object.entries(Formularies).every(([kind, formulary]) => formulary.kind === kind)).to.be.true
  })
})

describe('formularyFor', () => {
  it('is the formulary a widget names', () => {
    expect(formularyFor({ formulary: 'jsonata' })).to.eq(JsonataFormulary)
    expect(formularyFor({ formulary: 'aibot' })).to.eq(AibotFormulary)
    expect(formularyFor({ formulary: 'entry' })).to.eq(EntryFormulary)
    expect(formularyFor({ formulary: 'liquidize' })).to.eq(LiquidizeFormulary)
  })

  it('tells a widget worked out on render from one asked from the cell, and from one typed', () => {
    expect(formularyFor({ formulary: 'jsonata' }).refresh).to.eq('live')
    expect(formularyFor({ formulary: 'aibot' }).refresh).to.eq('click')
    expect(formularyFor({ formulary: 'entry' }).refresh).to.be.null
    expect(formularyFor({ formulary: 'liquidize' }).refresh).to.eq('live')
  })

  it('says how each keeps its widgeteds: not at all, appended, upserted, or not at all', () => {
    expect(Object.values(Formularies).map((formulary) => formulary.store)).to.deep.eq([null, 'append', 'upsert', null])
  })
})

describe('columnMs', () => {
  it("bounds a template's whole column, and leaves a formula's to each formula's own timebox", () => {
    expect(JsonataFormulary.columnMs).to.be.null
    expect(LiquidizeFormulary.columnMs).to.eq(250)
  })
})

describe('paramsOf', () => {
  const numberEntry = Widget.fill({ label: 'figure', formulary: 'entry', config: { entry_kind: 'number' } })
  const shoutWidget = Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(question.title)' })
  const blurbWidget = Widget.fill({ label: 'blurb', formulary: 'liquidize', formula: '{{ question.title }}' })

  it("holds an entry's params to its family", () => {
    expect(paramsOf(numberEntry).safeParse({ min: 'one' }).success).to.be.false
    expect(paramsOf(numberEntry).safeParse({ min: 1 }).success).to.be.true
  })

  it("leaves a formula's params open", () => {
    expect(paramsOf(shoutWidget).safeParse({ loud: true }).success).to.be.true
  })

  it("holds a liquidize widgeting's params to a template", () => {
    expect(paramsOf(blurbWidget).safeParse({ loud: true }).success).to.be.false
    expect(paramsOf(blurbWidget).safeParse({ template: '{{ question.hint }}' }).success).to.be.true
  })

  it("says what each widgeting's folded line holds: a formula, nothing for a prompt, an entry's params, a template", () => {
    expect(Object.values(Formularies).map((formulary) => formulary.folded)).to.deep.eq(['formula', null, 'params', 'template'])
  })

  // Each formulary lets through only the reserved words its own params are named by.
  const dumdum = Widget.fill({ label: 'dumdum', formulary: 'aibot', formula: 'Q: {{clueing}}', config: { servicelabel: 'claude', model_tier: 'quick', max_tokens: 9 } })
  const textEntry = Widget.fill({ label: 'memo', formulary: 'entry', config: { entry_kind: 'text' } })
  const AllowCases: [WidgetT, Record<string, unknown>, boolean, string][] = [
    // a formula's and a prompt's: none
    [shoutWidget,  { size: 3 },                           true,  "a formula's widgeting takes a param of any name not reserved"],
    [shoutWidget,  { template: 'x' },                     false, "a formula's widgeting refuses a liquidize widgeting's param, a reserved word"],
    [shoutWidget,  { min: 1 },                            false, "a formula's widgeting refuses an entry's param, a reserved word"],
    [dumdum,       { tone: 'dry' },                       true,  "a prompt's widgeting takes a param of any name not reserved"],
    [dumdum,       { template: 'x' },                     false, "a prompt's widgeting refuses a liquidize widgeting's param, a reserved word"],
    [dumdum,       { template_from: 'notes' },            true,  "a prompt's widgeting takes a name no word keeps back, whoever else uses it"],
    [dumdum,       { max: 1 },                            false, "a prompt's widgeting refuses an entry's param, a reserved word"],
    // an entry's: its family's own
    [numberEntry,  { min: 1 },                            true,  "a number entry's widgeting takes its own min"],
    [numberEntry,  { template: 'x' },                     false, "a number entry's widgeting refuses a liquidize widgeting's param"],
    [textEntry,    { max_length: 3 },                     true,  "a text entry's widgeting takes its own max_length"],
    [textEntry,    { min: 1 },                            false, "a text entry's widgeting refuses a number entry's param"],
    // a template's: its own
    [blurbWidget,  { template_from: { ref: 'notes' } },   true,  "a liquidize widgeting takes its own template_from"],
    [blurbWidget,  { min: 1 },                            false, "a liquidize widgeting refuses an entry's param"],
  ]
  for (const [widget, params, passes, describes] of AllowCases) {
    it(describes, () => {
      expect(paramsOf(widget).safeParse(params).success).to.eq(passes)
    })
  }
})
