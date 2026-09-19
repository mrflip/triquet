import { describe, expect, it } from 'vitest'
import * as CX from '../../src/lib/collections'
import * as EE from '../../src/lib/errors'

class Lightbulb { lumens = 40 }

describe('predicates', () => {
  const Cases: [unknown, boolean, boolean, boolean, string][] = [
    // value                  nil    blank  void   description
    // absent:
    [null,                    true,  true,  true,  'null'],
    [undefined,               true,  true,  true,  'undefined'],
    // empty but present:
    ['',                      false, true,  true,  'the empty string'],
    [[],                      false, false, true,  'an empty array'],
    [{},                      false, false, true,  'an empty bag'],
    [new Map(),               false, false, true,  'an empty Map'],
    [new Set(),               false, false, true,  'an empty Set'],
    [Object.create(null),     false, false, true,  'a prototype-less empty object'],
    // values someone meant, which no predicate may discard:
    [0,                       false, false, false, 'zero'],
    [-0,                      false, false, false, 'negative zero'],
    [NaN,              false, false, false, 'NaN'],
    [false,                   false, false, false, 'false'],
    [0n,                      false, false, false, 'a zero bigint'],
    // non-empty:
    ['aa',                    false, false, false, 'a string'],
    [' ',                     false, false, false, 'a single space'],
    [[0],                     false, false, false, 'an array holding a zero'],
    [{ aa: undefined },       false, false, false, 'a bag with one undefined value'],
    [new Map([['aa', 1]]),    false, false, false, 'a Map with an entry'],
    // things, not containers -- keyless but emphatically present:
    [new Date(),              false, false, false, 'a Date'],
    [/re/,                    false, false, false, 'a RegExp'],
    [new Lightbulb(),         false, false, false, 'a class instance'],
  ]

  for (const [val, nil, blank, empty, blurb] of Cases) {
    it(`${blurb}: isNil ${String(nil)}, isBlank ${String(blank)}, isVoid ${String(empty)}`, () => {
      expect(CX.isNil(val)).to.eq(nil)
      expect(CX.isBlank(val)).to.eq(blank)
      expect(CX.isVoid(val)).to.eq(empty)
    })
  }

  it('an empty buffer is void, a filled one is not', () => {
    expect(CX.isVoid(new Uint8Array(0))).to.eq(true)
    expect(CX.isVoid(new Uint8Array(2))).to.eq(false)
    expect(CX.isVoid(new ArrayBuffer(0))).to.eq(true)
  })
})

describe('arrayish', () => {
  it('is true for the things that spread as collections', () => {
    expect(CX.arrayish([])).to.eq(true)
    expect(CX.arrayish([1, 2])).to.eq(true)
    expect(CX.arrayish(new Set([1]))).to.eq(true)
    expect(CX.arrayish(new Map())).to.eq(true)
    expect(CX.arrayish(new Uint8Array(2))).to.eq(true)
  })
  it('is false for a string, whose spread gives characters rather than entries', () => {
    expect(CX.arrayish('abc')).to.eq(false)
    expect(CX.arrayish('')).to.eq(false)
  })
  it('is false for a bag, and for things that are not collections at all', () => {
    expect(CX.arrayish({ aa: 1 })).to.eq(false)
    expect(CX.arrayish(null)).to.eq(false)
    expect(CX.arrayish(undefined)).to.eq(false)
    expect(CX.arrayish(42)).to.eq(false)
    expect(CX.arrayish(new Date())).to.eq(false)
  })
})

describe('baggish', () => {
  it('is true for a plain bag and a Map', () => {
    expect(CX.baggish({})).to.eq(true)
    expect(CX.baggish({ aa: 1 })).to.eq(true)
    expect(CX.baggish(new Map())).to.eq(true)
    expect(CX.baggish(Object.create(null))).to.eq(true)
  })
  it('is false for the decoys that merely look keyed', () => {
    expect(CX.baggish(new Date())).to.eq(false)
    expect(CX.baggish(/re/)).to.eq(false)
    expect(CX.baggish(new Error('x'))).to.eq(false)
    expect(CX.baggish(new Lightbulb())).to.eq(false)
    expect(CX.baggish(() => 1)).to.eq(false)
    expect(CX.baggish('aa')).to.eq(false)
  })
  it('is false for arrays and Sets, which are collections but not bags', () => {
    expect(CX.baggish([])).to.eq(false)
    expect(CX.baggish(new Set())).to.eq(false)
  })
  it('is false for nil', () => {
    expect(CX.baggish(null)).to.eq(false)
    expect(CX.baggish(undefined)).to.eq(false)
  })
})

describe('isAnyIterable', () => {
  it('is true for sync iterables', () => {
    expect(CX.isAnyIterable([1])).to.eq(true)
    expect(CX.isAnyIterable(new Set())).to.eq(true)
  })
  it('is true for a string, unlike arrayish', () => {
    expect(CX.isAnyIterable('abc')).to.eq(true)
    expect(CX.arrayish('abc')).to.eq(false)
  })
  it('is true for an async iterable', () => {
    const streamish = { [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ value: 1, done: true }) }) }
    expect(CX.isAnyIterable(streamish)).to.eq(true)
  })
  it('is false for a bag and for nil', () => {
    expect(CX.isAnyIterable({ aa: 1 })).to.eq(false)
    expect(CX.isAnyIterable(null)).to.eq(false)
  })
})

describe('clxnsize', () => {
  it('counts an array by length and a bag by keys', () => {
    expect(CX.clxnsize([1, 2, 3])).to.eq(3)
    expect(CX.clxnsize({ aa: 1, bb: 2 })).to.eq(2)
  })
  it('counts a Map and a Set by size', () => {
    expect(CX.clxnsize(new Map([['aa', 1]]))).to.eq(1)
    expect(CX.clxnsize(new Set([1, 2]))).to.eq(2)
  })
  it('counts nothing as nothing rather than falling over', () => {
    expect(CX.clxnsize(null)).to.eq(0)
    expect(CX.clxnsize(undefined)).to.eq(0)
    expect(CX.clxnsize([])).to.eq(0)
    expect(CX.clxnsize({})).to.eq(0)
  })
})

describe('scrubNil', () => {
  it('drops nil entries from an array and keeps its shape', () => {
    expect(CX.scrubNil(['aa', null, 'bb', undefined])).to.eql(['aa', 'bb'])
  })
  it('drops nil values from a bag and keeps it a bag', () => {
    expect(CX.scrubNil({ aa: 1, bb: null, cc: undefined })).to.eql({ aa: 1 })
  })
  it('keeps every value that someone meant', () => {
    expect(CX.scrubNil([0, '', false, NaN, [], {}])).to.eql([0, '', false, NaN, [], {}])
    expect(CX.scrubNil({ zero: 0, blank: '', no: false })).to.eql({ zero: 0, blank: '', no: false })
  })
  it('does not mutate what it was handed', () => {
    const arr = ['aa', null]
    const bag = { aa: 1, bb: null }
    CX.scrubNil(arr)
    CX.scrubNil(bag)
    expect(arr).to.have.length(2)
    expect(bag).to.have.property('bb')
  })
  it('leaves a collection with nothing to remove alone', () => {
    expect(CX.scrubNil(['aa'])).to.eql(['aa'])
    expect(CX.scrubNil({})).to.eql({})
    expect(CX.scrubNil([])).to.eql([])
  })
  it('only looks at immediate entries, not nested ones', () => {
    expect(CX.scrubNil([{ aa: null }])).to.eql([{ aa: null }])
  })
})

describe('scrubVoid', () => {
  it('drops the empties as well as the nils', () => {
    expect(CX.scrubVoid(['aa', '', null, 'bb', undefined])).to.eql(['aa', 'bb'])
    expect(CX.scrubVoid({ aa: 1, bb: {}, cc: [], dd: '', ee: null })).to.eql({ aa: 1 })
  })
  it('still keeps zero and false, which are values and not absences', () => {
    expect(CX.scrubVoid([0, false, NaN])).to.eql([0, false, NaN])
  })
  it('keeps a Date, which has no keys but is not empty', () => {
    const when = new Date('2022-05-04T00:00:00Z')
    expect(CX.scrubVoid([when])).to.eql([when])
  })
  it('does not mutate what it was handed', () => {
    const arr = ['aa', '']
    CX.scrubVoid(arr)
    expect(arr).to.have.length(2)
  })
})

describe('non-empty arrays', () => {
  describe('arrNZ', () => {
    it('hands back an array that has something in it', () => {
      expect(CX.arrNZ(['aa', 'bb'])).to.eql(['aa', 'bb'])
    })
    it('refuses an empty one, rather than minting a lie', () => {
      expect(() => CX.arrNZ([])).to.throw(/non-empty/)
    })
    it('throws a BlankError, so a handler can tell what happened', () => {
      const thrown = (() => { try { CX.arrNZ([]); return null } catch (err) { return err } })()
      expect(thrown).to.be.instanceOf(EE.BlankError)
    })
    it('returns the very same array, not a copy', () => {
      const arr = ['aa']
      expect(CX.arrNZ(arr)).to.eq(arr)
    })
  })

  describe('arrNZRO', () => {
    it('accepts a non-empty array', () => {
      expect(CX.arrNZRO(['aa'])).to.eql(['aa'])
    })
    it('refuses an empty one', () => {
      expect(() => CX.arrNZRO([])).to.throw(/non-empty/)
    })
  })

  describe('cheatNZ', () => {
    it('hands the array straight back', () => {
      const arr = ['aa']
      expect(CX.cheatNZ(arr)).to.eq(arr)
    })
    it('does not check, which is the whole point of the name', () => {
      expect(CX.cheatNZ([])).to.eql([])
    })
  })

  describe('arrNZToFill', () => {
    it('starts empty, ready to be filled', () => {
      const acc = CX.arrNZToFill<string>()
      expect(acc).to.eql([])
      acc.push('aa')
      expect(acc).to.eql(['aa'])
    })
  })

  describe('isArrNZ', () => {
    it('is true for an array with entries', () => {
      expect(CX.isArrNZ(['aa'])).to.eq(true)
      expect(CX.isArrNZ([0])).to.eq(true)
    })
    it('is false for an empty array and for nil', () => {
      expect(CX.isArrNZ([])).to.eq(false)
      expect(CX.isArrNZ(null)).to.eq(false)
      expect(CX.isArrNZ(undefined)).to.eq(false)
    })
  })

  describe('appendMutatingly', () => {
    it('grows the array the caller is holding', () => {
      const target = ['aa']
      const result = CX.appendMutatingly(target, ['bb'], ['cc'])
      expect(target).to.eql(['aa', 'bb', 'cc'])
      expect(result).to.eq(target)
    })
    it('flattens one level, so several arrays go in at once', () => {
      expect(CX.appendMutatingly([] as number[], [1, 2], [3])).to.eql([1, 2, 3])
    })
    it('leaves the array alone when there is nothing to add', () => {
      expect(CX.appendMutatingly(['aa'])).to.eql(['aa'])
      expect(CX.appendMutatingly(['aa'], [])).to.eql(['aa'])
    })
    it('refuses a target that is not an array', () => {
      // @ts-expect-error the point of the test is the wrong type
      expect(() => CX.appendMutatingly('nope', ['aa'])).to.throw(/array to append/)
    })
    it('copes with a large append, where a spread could be a problem', () => {
      const big = Array.from({ length: 50_000 }, (_unused, ii) => ii)
      expect(CX.appendMutatingly([] as number[], big)).to.have.length(50_000)
    })
  })
})
