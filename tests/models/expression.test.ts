import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import * as Formulas from '../../src/lib/formulas'
import { Expression, ExpressionValidators, SeedExpressions, keyOf } from '../../src/models/expression'

describe('Expression.fill', () => {
  it('defaults the owner to tq and the description to nothing', () => {
    expect(Expression.fill({ label: 'shout', formula: '$uppercase(qn.title)' })).to.deep.eq({
      owner: 'tq', label: 'shout', formula: '$uppercase(qn.title)', description: '',
    })
  })

  it('keeps a formula exactly as typed, newlines and all', () => {
    const formula = '  (\n  $sum(a)\n)\n'
    expect(Expression.fill({ label: 'laid_out', formula }).formula).to.eq(formula)
  })

  const Refused: [object, string][] = [
    [{ label: 'Shout' },                     'a label that is not one'],
    [{ label: 'x' },                         'a label too short to be one'],
    [{ formula: '' },                        'an empty formula'],
    [{ formula: 'x'.repeat(1000) },          'a formula past 999 characters'],
    [{ formula: 'a\u{1}b' },                 'a formula with a control character in it'],
    [{ owner: 'somebody' },                  'an owner there is not'],
  ]
  for (const [overrides, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => Expression.fill({ label: 'shout', formula: '1', ...overrides })).to.throw(Z.ZodError)
    })
  }

  it('takes a formula of exactly 999 characters', () => {
    expect(Expression.fill({ label: 'long_one', formula: '1'.repeat(999) }).formula).to.have.length(999)
  })
})

describe('ExpressionValidators.expressionPatch', () => {
  it('leaves absent keys absent, so a patch never carries a default along', () => {
    expect(ExpressionValidators.expressionPatch({ description: 'Louder.' })).to.deep.eq({ description: 'Louder.' })
  })

  it('does not take a new label or owner, which are what other things refer to it by', () => {
    expect(ExpressionValidators.expressionPatch({ label: 'other', owner: 'tq', formula: '2' } as never)).to.deep.eq({ formula: '2' })
  })

  it('refuses an empty formula', () => {
    expect(() => ExpressionValidators.expressionPatch({ formula: '' })).to.throw(Z.ZodError)
  })
})

describe('keyOf', () => {
  it('joins the owner and the label', () => {
    expect(keyOf({ owner: 'tq', label: 'letter_count' })).to.eq('tq/letter_count')
  })
})

describe('SeedExpressions', () => {
  it('holds the eight sums and five text calculations, each under its own label', () => {
    const labels = SeedExpressions.map((expression) => expression.label)
    expect(labels).to.have.length(13)
    expect(new Set(labels).size).to.eq(13)
  })

  it('has a description for every expression, for the author choosing between them', () => {
    expect(SeedExpressions.filter((expression) => expression.description === '')).to.deep.eq([])
  })

  it('has only formulas that parse', () => {
    const broken = SeedExpressions.filter((expression) => Formulas.check(expression.formula) !== null)
    expect(broken.map((expression) => expression.label)).to.deep.eq([])
  })
})
