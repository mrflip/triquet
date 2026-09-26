import { describe, expectTypeOf, it } from 'vitest'
import type * as TT from '../../src/lib/type-tools'
import type { Bag } from '../../src/lib/types'

/** The shape every reshaping helper is tried against */
type Bulb = {
  title:    string
  lumens:   number
  tech:     string | null
  socket?:  string
}

describe('loosening', () => {
  it('WithNullable admits null on the named keys and leaves the rest', () => {
    expectTypeOf<TT.WithNullable<Bulb, 'lumens'>>()
      .toEqualTypeOf<{ title: string, lumens: number | null, tech: string | null, socket?: string }>()
  })
  it('WithNullable defaults to every key', () => {
    expectTypeOf<TT.WithNullable<{ aa: string, bb: number }>>()
      .toEqualTypeOf<{ aa: string | null, bb: number | null }>()
  })
  it('WithOptional makes the named keys optional', () => {
    expectTypeOf<TT.WithOptional<Bulb, 'title'>>()
      .toEqualTypeOf<{ title?: string, lumens: number, tech: string | null, socket?: string }>()
  })
  it('WithNilable does both at once', () => {
    expectTypeOf<TT.WithNilable<Bulb, 'lumens'>>()
      .toEqualTypeOf<{ title: string, lumens?: number | null, tech: string | null, socket?: string }>()
  })
})

describe('tightening', () => {
  it('WithoutNull takes null out and leaves optionality alone', () => {
    expectTypeOf<TT.WithoutNull<Bulb, 'tech'>>()
      .toEqualTypeOf<{ title: string, lumens: number, tech: string, socket?: string }>()
  })
  it('WithoutOptional makes an optional key required', () => {
    expectTypeOf<TT.WithoutOptional<Bulb, 'socket'>>()
      .toEqualTypeOf<{ title: string, lumens: number, tech: string | null, socket: string }>()
  })
  it('WithoutOptional does not touch an explicit null', () => {
    expectTypeOf<TT.WithoutOptional<Bulb, 'tech'>>()
      .toEqualTypeOf<{ title: string, lumens: number, tech: string | null, socket?: string }>()
  })
  it('WithoutNil takes both, which is the difference from WithoutOptional', () => {
    expectTypeOf<TT.WithoutNil<{ aa?: string | null }, 'aa'>>().toEqualTypeOf<{ aa: string }>()
  })
  it('WithoutNil over every key is the whole shape made solid', () => {
    expectTypeOf<TT.WithoutNil<Bulb>>()
      .toEqualTypeOf<{ title: string, lumens: number, tech: string, socket: string }>()
  })
})

describe('round trips', () => {
  it('loosening then tightening the same key returns the shape', () => {
    expectTypeOf<TT.WithoutNull<TT.WithNullable<Bulb, 'lumens'>, 'lumens'>>()
      .toEqualTypeOf<Bulb>()
  })
  it('the helpers compose, so an "all but these" is just an Exclude away', () => {
    // Replaces the relic's OptionalizePick: everything optional except `title`.
    expectTypeOf<TT.WithOptional<Bulb, Exclude<keyof Bulb, 'title'>>>()
      .toEqualTypeOf<{ title: string, lumens?: number, tech?: string | null, socket?: string }>()
  })
})

describe('Invert', () => {
  it('trades keys for values', () => {
    expectTypeOf<TT.Invert<{ aa: 'one', bb: 'two' }>>().toEqualTypeOf<{ one: 'aa', two: 'bb' }>()
  })
})

describe('WithoutNilVals', () => {
  it('an array loses nil from its element type', () => {
    expectTypeOf<TT.WithoutNilVals<(string | null | undefined)[]>>().toEqualTypeOf<string[]>()
  })
  it('a readonly array comes back mutable and solid', () => {
    expectTypeOf<TT.WithoutNilVals<readonly (string | null)[]>>().toEqualTypeOf<string[]>()
  })
  it('a bag keeps its open keys and loses nil from its values', () => {
    expectTypeOf<TT.WithoutNilVals<Bag<number | null>>>().toEqualTypeOf<Bag<number>>()
  })
  it('a known shape turns its nil-able keys optional, since they may be gone', () => {
    expectTypeOf<TT.WithoutNilVals<{ aa: string, bb: number | null, cc: number }>>()
      .toEqualTypeOf<{ aa: string, cc: number, bb?: number }>()
  })
  it('a shape with nothing nil-able is unchanged', () => {
    expectTypeOf<TT.WithoutNilVals<{ aa: string }>>().toEqualTypeOf<{ aa: string }>()
  })
  it('distributes over a union rather than collapsing it', () => {
    expectTypeOf<TT.WithoutNilVals<(string | null)[] | Bag<number | null>>>()
      .toEqualTypeOf<string[] | Bag<number>>()
  })
})

describe('Simplify', () => {
  it('flattens an intersection without changing what it means', () => {
    expectTypeOf<TT.Simplify<{ aa: string } & { bb: number }>>()
      .toEqualTypeOf<{ aa: string, bb: number }>()
  })
})

describe('RequiredOnly', () => {
  it('keeps the named keys required and makes the rest optional', () => {
    expectTypeOf<TT.RequiredOnly<Bulb, 'title'>>()
      .toEqualTypeOf<{ title: string, lumens?: number, tech?: string | null, socket?: string }>()
  })
  it('is the inverse selection from WithOptional', () => {
    expectTypeOf<TT.RequiredOnly<Bulb, 'title'>>()
      .toEqualTypeOf<TT.WithOptional<Bulb, Exclude<keyof Bulb, 'title'>>>()
  })
  it('naming more than one key keeps them all required', () => {
    expectTypeOf<TT.RequiredOnly<Bulb, 'title' | 'lumens'>>()
      .toEqualTypeOf<{ title: string, lumens: number, tech?: string | null, socket?: string }>()
  })
})
