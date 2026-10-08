import { describe, expect, it } from 'vitest'
import { Formularies, formularyFor, paramsOf } from '../../../src/lib/formulary/formularies'
import { AibotFormulary } from '../../../src/lib/formulary/aibot'
import { EntryFormulary } from '../../../src/lib/formulary/entry'
import { JsonataFormulary } from '../../../src/lib/formulary/jsonata'
import { LiquidizeFormulary } from '../../../src/lib/formulary/liquidize'
import { FormularykindVals, Widget } from '../../../src/models/widget'

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

describe('paramsOf', () => {
  const numberEntry = Widget.fill({ label: 'figure', formulary: 'entry', config: { entry_kind: 'number' } })
  const shoutWidget = Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)' })
  const blurbWidget = Widget.fill({ label: 'blurb', formulary: 'liquidize', formula: '{{ qn.title }}' })

  it("holds an entry's params to its family", () => {
    expect(paramsOf(numberEntry).safeParse({ min: 'one' }).success).to.be.false
    expect(paramsOf(numberEntry).safeParse({ min: 1 }).success).to.be.true
  })

  it("leaves a formula's params open", () => {
    expect(paramsOf(shoutWidget).safeParse({ loud: true }).success).to.be.true
  })

  it("holds a liquidize widgeting's params to a template", () => {
    expect(paramsOf(blurbWidget).safeParse({ loud: true }).success).to.be.false
    expect(paramsOf(blurbWidget).safeParse({ template: '{{ qn.hint }}' }).success).to.be.true
  })

  it("says what each widgeting's folded line holds: a formula, nothing for a prompt, an entry's params", () => {
    expect(Object.values(Formularies).map((formulary) => formulary.folded)).to.deep.eq(['formula', null, 'params'])
  })
})
