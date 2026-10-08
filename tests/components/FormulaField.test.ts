import { describe, expect, it } from 'vitest'
import { formulaIssueOf } from '../../src/components/FormulaField'
import * as PA from '../../src/lib/vv/patterns'

describe('formulaIssueOf', () => {
  it('is null for JSONata that parses', () => {
    expect(formulaIssueOf('Formula', '$.masie')).to.be.null
    expect(formulaIssueOf('Formula', '$round($.value * 100)')).to.be.null
  })

  it("names JSONata that does not parse, in the field's own words", () => {
    expect(formulaIssueOf('Formula', '$sum(')).to.match(/^Formula does not read as JSONata: /)
  })

  it('refuses a formula past a screenful', () => {
    expect(formulaIssueOf('Formula', `$.${'a'.repeat(PA.Formulaish.max)}`)).to.eq(`Formula should be at most ${String(PA.Formulaish.max)} characters.`)
  })
})
