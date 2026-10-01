import { describe, expect, it } from 'vitest'
import { Formularies, formularyFor } from '../../../src/lib/formulary/formularies'
import { AibotFormulary } from '../../../src/lib/formulary/aibot'
import { JsonataFormulary } from '../../../src/lib/formulary/jsonata'
import { FormularykindVals } from '../../../src/models/widget'

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
  })

  it('tells a widget worked out on render from one asked from the cell', () => {
    expect(formularyFor({ formulary: 'jsonata' }).refresh).to.eq('live')
    expect(formularyFor({ formulary: 'aibot' }).refresh).to.eq('click')
  })
})
