import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { Validator, callable } from '../../src/lib/validator'

const LightbulbTechVals = ['led', 'incandescent', 'fluorescent'] as const

const LightbulbValidators = Validator(({ obj, titleish, uint, oneof }) => {
  const lightbulbTech = oneof(LightbulbTechVals)
  const lightbulb = obj({
    title:  titleish,
    lumens: uint.max(20_000).nullable().default(null),
    tech:   lightbulbTech.default('led'),
  })
  return { lightbulb, lightbulbTech }
})

type LightbulbDNA = Z.input<typeof LightbulbValidators.lightbulb>
type LightbulbT   = Z.output<typeof LightbulbValidators.lightbulb>

describe('Validator', () => {
  it('returns each schema as its own parse function', () => {
    const bulb: LightbulbT = LightbulbValidators.lightbulb({ title: 'Anglepoise' })
    expect(bulb).to.deep.eq({ title: 'Anglepoise', lumens: null, tech: 'led' })
  })

  it('keeps the schema surface reachable on the callable', () => {
    expect(LightbulbValidators.lightbulb.safeParse({}).success).to.eq(false)
    expect(LightbulbValidators.lightbulbTech.options).to.deep.eq([...LightbulbTechVals])
  })

  it('composes onward like any other schema', () => {
    const maybeBulb = LightbulbValidators.lightbulb.nullable()
    expect(maybeBulb.parse(null)).to.eq(null)
  })

  it('narrows input and output types apart', () => {
    const dna: LightbulbDNA = { title: 'Anglepoise' }
    expect(LightbulbValidators.lightbulb(dna).tech).to.eq('led')
  })

  it('throws on data the schema rejects', () => {
    expect(() => LightbulbValidators.lightbulb({ title: 'Anglepoise', lumens: -1 })).to.throw(Z.ZodError)
  })

  it('publishes only what the block returns', () => {
    expect(Object.keys(LightbulbValidators)).to.deep.eq(['lightbulb', 'lightbulbTech'])
  })
})

describe('callable', () => {
  it('parses when called', () => {
    expect(callable(Z.string())('hi')).to.eq('hi')
  })

  it('reports instanceof as the wrapped schema does', () => {
    expect(callable(Z.string()) instanceof Z.ZodString).to.eq(true)
  })
})
