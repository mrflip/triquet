import { describe, expect, expectTypeOf, it } from 'vitest'
import * as Z from 'zod'
import { zodOutputToConvex } from 'convex-helpers/server/zod4'
import { Validator, ValidatorKit, callable, plain } from '../../src/lib/validator'

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
    expect(LightbulbValidators.lightbulb.safeParse({}).success).to.be.false
    expect(LightbulbValidators.lightbulbTech.options).to.deep.eq([...LightbulbTechVals])
  })

  it('composes onward like any other schema', () => {
    const maybeBulb = LightbulbValidators.lightbulb.nullable()
    expect(maybeBulb.parse(null)).to.be.null
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

describe('Validator with sources', () => {
  const SocketValidators = Validator(({ oneof }) => ({ socket: oneof(['e26', 'gu10']) }))

  const LampValidators = Validator(({ obj, titleish, lightbulb, lightbulbTech }) => {
    const lamp = obj({ title: titleish, bulb: lightbulb, tech: lightbulbTech })
    return { lamp }
  }, LightbulbValidators)

  const FixtureValidators = Validator(({ obj, lamp, socket }) => {
    const fixture = obj({ lamp, socket })
    return { fixture, socket }
  }, [LampValidators, SocketValidators])

  it('spreads one namespace into the kit', () => {
    const lamp = LampValidators.lamp({ title: 'Desk', bulb: { title: 'Anglepoise' }, tech: 'led' })
    expect(lamp.bulb).to.deep.eq({ title: 'Anglepoise', lumens: null, tech: 'led' })
  })

  it('spreads a list of namespaces into the kit', () => {
    const lamp = { title: 'Desk', bulb: { title: 'Anglepoise' }, tech: 'led' } as const
    expect(FixtureValidators.fixture({ lamp, socket: 'gu10' }).socket).to.eq('gu10')
    expect(() => FixtureValidators.fixture({ lamp, socket: 'bayonet' as never })).to.throw(Z.ZodError)
  })

  it('carries the sources\' types through to what it publishes', () => {
    type FixtureT = Z.output<typeof FixtureValidators.fixture>
    expectTypeOf<FixtureT['lamp']['bulb']>().toEqualTypeOf<LightbulbT>()
    expectTypeOf<FixtureT['socket']>().toEqualTypeOf<'e26' | 'gu10'>()
  })

  it('republishes a source\'s schema as it was, not a wrapper of a wrapper', () => {
    expect(Object.getPrototypeOf(FixtureValidators.socket)).to.eq(Object.getPrototypeOf(SocketValidators.socket))
    expect(typeof plain(FixtureValidators.socket)).to.eq('object')
  })

  it('refuses a name the kit or another source already gives', () => {
    const Shadowing = Validator(({ oneof }) => ({ uint: oneof(['one']) }))
    expect(() => Validator(({ uint }) => ({ uint }), Shadowing)).to.throw(/repeat a name/)
    expect(() => Validator(({ socket }) => ({ socket }), [SocketValidators, SocketValidators])).to.throw(/repeat a name/)
  })
})

describe('callable', () => {
  it('parses when called', () => {
    expect(callable(Z.string())('hi')).to.eq('hi')
  })

  it('reports instanceof as the wrapped schema does', () => {
    expect(callable(Z.string()) instanceof Z.ZodString).to.be.true
  })
})

describe('plain', () => {
  const inner = Validator(({ oneof }) => ({ tier: oneof(['a', 'b']).default('a') }))
  const outer = Validator(({ obj, num }) => ({ both: obj({ tier: inner.tier.optional(), num }) }))

  it('lets Z.toJSONSchema see through a wrapped default, which it cannot otherwise', () => {
    expect(() => Z.toJSONSchema(outer.both)).to.throw(TypeError)
    expect(() => Z.toJSONSchema(plain(outer.both))).to.not.throw()
  })

  it('leaves parsing exactly as it was', () => {
    plain(outer.both)
    expect(outer.both({ num: 3 })).to.deep.eq({ tier: 'a', num: 3 })
    expect(inner.tier(undefined as never)).to.eq('a')
    expect(() => outer.both({ num: 3, tier: 'z' as never })).to.throw(Z.ZodError)
  })

  it('is safe to call twice, and returns the plain schema', () => {
    const once = plain(outer.both)
    expect(plain(once)).to.eq(once)
    expect(typeof once).to.eq('object')
  })
})

describe('ValidatorKit.zid', () => {
  const pointer = ValidatorKit.zid('quizzes').describe('The quiz.')

  it('takes a Convex document id, or a UUID', () => {
    expect(pointer.parse('j97d0qbj35dar1v8edndzckvsx8f828f')).to.eq('j97d0qbj35dar1v8edndzckvsx8f828f')
    expect(pointer.parse('3f0c9b1e-5d7a-4c2e-9f3b-8a1d6e2c4b70')).to.eq('3f0c9b1e-5d7a-4c2e-9f3b-8a1d6e2c4b70')
  })

  it('refuses what is not shaped like a row id', () => {
    const refused = ['flip_kromer', '', 'J97D0QBJ35DAR1V8EDNDZCKVSX8F828F', 17]
    expect(refused.map((val) => pointer.safeParse(val).success)).to.deep.eq([false, false, false, false])
  })

  it('is an id of its table to Convex, described or not', () => {
    const converted = zodOutputToConvex(pointer)
    expect([converted.kind, converted.tableName]).to.deep.eq(['id', 'quizzes'])
  })
})

describe('ValidatorKit.labelAllowing', () => {
  const allowing = ValidatorKit.labelAllowing(new Set(['min', 'max']))

  it("takes a reserved word it is allowed, and refuses one it is not, per the doc examples", () => {
    expect(ValidatorKit.labelAllowing(new Set(['min'])).parse('min')).to.eq('min')
    expect(() => ValidatorKit.labelAllowing(new Set(['min'])).parse('max')).to.throw(Z.ZodError)
  })

  it("holds every other word to a label's shape and the reserved words, as label does", () => {
    expect(allowing.parse('dumdum')).to.eq('dumdum')
    expect(allowing.safeParse('total').success).to.be.false
    expect(allowing.safeParse('Min').success).to.be.false
  })
})
