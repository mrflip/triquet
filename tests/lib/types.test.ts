import { describe, expect, expectTypeOf, it } from 'vitest'
import type * as TY from '../../src/lib/types'

describe('shared utility types', () => {
  it('StringMaybe admits a string, null or undefined', () => {
    const vals: TY.StringMaybe[] = ['a', null, undefined]
    expectTypeOf(vals).toEqualTypeOf<(string | null | undefined)[]>()
    expect(vals).to.have.length(3)
  })
  it('Bag maps string keys to the given value type', () => {
    const bag: TY.Bag<number> = { one: 1 }
    expectTypeOf(bag).toEqualTypeOf<Record<string, number>>()
    expect(bag.one).to.eq(1)
  })
  it('AnyBag holds any property values', () => {
    const bag: TY.AnyBag = { one: 1, two: 'two' }
    expectTypeOf(bag).toEqualTypeOf<Record<string, any>>()
    expect(bag.two).to.eq('two')
  })
  it('ArrRO is a read-only array', () => {
    const arr: TY.ArrRO<number> = [1, 2]
    expectTypeOf(arr).toEqualTypeOf<readonly number[]>()
    expect(arr).to.have.length(2)
  })
  it('ArrNZ and ArrNZRO require a first element', () => {
    const nonEmpty: TY.ArrNZ<number> = [1, 2]
    const nonEmptyRO: TY.ArrNZRO<number> = [1]
    // @ts-expect-error an empty array is not non-empty
    const nope: TY.ArrNZ<number> = []
    expect(nonEmpty).to.have.length(2)
    expect(nonEmptyRO).to.have.length(1)
    expect(nope).to.have.length(0)
  })
})
