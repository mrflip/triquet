import { describe, expectTypeOf, it } from 'vitest'
import type * as TY from '../../src/lib/types'

describe('shared utility types', () => {
  it('StringMaybe admits a string, null or undefined', () => {
    expectTypeOf<TY.StringMaybe>().toEqualTypeOf<string | null | undefined>()
  })
  it('Bag maps string keys to the given value type', () => {
    expectTypeOf<TY.Bag<number>>().toEqualTypeOf<Record<string, number>>()
  })
  it('AnyBag holds any property values', () => {
    expectTypeOf<TY.AnyBag>().toEqualTypeOf<Record<string, any>>()
  })
  it('ArrRO is a read-only array', () => {
    expectTypeOf<TY.ArrRO<number>>().toEqualTypeOf<readonly number[]>()
  })
  it('ArrNZ is a mutable array with a guaranteed first element', () => {
    expectTypeOf<TY.ArrNZ<number>>().toEqualTypeOf<[number, ...number[]]>()
  })
  it('ArrNZRO is the read-only flavour of the same', () => {
    expectTypeOf<TY.ArrNZRO<number>>().toEqualTypeOf<readonly [number, ...number[]]>()
  })
  it('a non-empty array rejects an empty literal', () => {
    // @ts-expect-error an empty array is not non-empty
    const nope: TY.ArrNZ<number> = []
    expectTypeOf(nope).toEqualTypeOf<[number, ...number[]]>()
  })
})
