import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { Expression, SeedExpressions } from '../../src/models/expression'
import { Expressing, ExpressingValidators, defaultsFor, expressingLabelOf, sortkeyOf } from '../../src/models/expressing'

describe('Expressing.fill', () => {
  it('defaults the shape to skinny', () => {
    expect(Expressing.fill({ label: 'letters', expression_label: 'answer_letter_count', title: 'Letters' }).shape).to.eq('skinny')
  })

  it('keeps the shape it is given', () => {
    expect(Expressing.fill({ label: 'backward', expression_label: 'answer_reversed', title: 'Backward', shape: 'medium' }).shape).to.eq('medium')
  })

  const Refused: [object, string][] = [
    [{ label: 'Letters' },           'a label that is not one'],
    [{ expression_label: 'A B' },    'an expression label that is not one'],
    [{ title: 'x'.repeat(83) },      'a title past 82 characters'],
    [{ shape: 'wide' },              'a shape there is not'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => Expressing.fill({ label: 'letters', expression_label: 'answer_letter_count', title: 'Letters', ...overrides })).to.throw(Z.ZodError)
    })
  }
})

describe('ExpressingValidators.expressingPatch', () => {
  it('leaves absent keys absent, so a patch never carries a default along', () => {
    expect(ExpressingValidators.expressingPatch({ title: 'Renamed' })).to.deep.eq({ title: 'Renamed' })
  })

  it('refuses a shape there is not', () => {
    expect(() => ExpressingValidators.expressingPatch({ shape: 'wide' as never })).to.throw(Z.ZodError)
  })
})

describe('Expressing.forExpression', () => {
  const expression = Expression.fill({ label: 'answer_reversed', formula: '1' })

  it('is labelled and titled after the expression', () => {
    expect(Expressing.forExpression(expression, new Set())).to.deep.eq({
      label: 'answer_reversed', expression_label: 'answer_reversed', title: 'Answer Reversed', shape: 'skinny',
    })
  })

  it('takes a suffixed label when a sibling already has the plain one, and still names the same expression', () => {
    const second = Expressing.forExpression(expression, new Set(['answer_reversed']))
    expect(second.label).to.match(/^answer_reversed_[a-z0-9]{8}$/)
    expect(second.expression_label).to.eq('answer_reversed')
  })
})

describe('sortkeyOf and expressingLabelOf', () => {
  it('make and read a sort memory for a computed column', () => {
    expect(sortkeyOf({ label: 'clueing_full' })).to.eq('expressing:clueing_full')
    expect(expressingLabelOf('expressing:clueing_full')).to.eq('clueing_full')
  })

  it('read a built-in column\'s sort memory as no expressing at all', () => {
    expect(['qnum', 'title', 'chain_order', ''].map((sortkey) => expressingLabelOf(sortkey))).to.deep.eq([null, null, null, null])
  })
})

describe('defaultsFor', () => {
  it('is the eight sum columns, in the order they have always appeared, with their old titles', () => {
    expect(defaultsFor(SeedExpressions).map((column) => column.title)).to.deep.eq([
      'Clueing + Rank', 'Clueing Full Sum', 'Clueing Numeral Sum', 'BUT NOT Full Sum',
      'BUT NOT Numeral Sum', 'Hint Full Sum', 'Hint Numeral Sum', 'Clueing+BUT NOT Full',
    ])
  })

  it('makes every column skinny, as the number columns always were', () => {
    expect(new Set(defaultsFor(SeedExpressions).map((column) => column.shape))).to.deep.eq(new Set(['skinny']))
  })

  it('leaves out a column whose expression the workspace no longer has', () => {
    const without = SeedExpressions.filter((expression) => expression.label !== 'hint_full')
    expect(defaultsFor(without).map((column) => column.label)).to.not.include('hint_full')
    expect(defaultsFor(without)).to.have.length(7)
  })

  it('is nothing for a workspace with no expressions', () => {
    expect(defaultsFor([])).to.deep.eq([])
  })
})
