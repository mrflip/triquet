import { omitBy } from 'es-toolkit/compat'
import { BlankValue, Mistyped } from './errors'
import type * as TT from './type-tools'
import type * as TY from './types'

/**
 * `true` for `null` and `undefined`, and nothing else.
 *
 * @param val - Anything at all.
 * @returns Whether the value is absent.
 *
 * @example isNil(null)  // => true
 * @example isNil(0)     // => false
 */
export function isNil(val: unknown): val is null | undefined {
  return val === null || val === undefined
}

/**
 * `true` for `null`, `undefined` and the empty string.
 *
 * Everything else is non-blank, including `0`, `false`, `NaN`, `{}` and `[]`. Use it where a
 * field is text that someone either filled in or did not.
 *
 * @param val - Anything at all.
 * @returns Whether the value is absent or an empty string.
 *
 * @example isBlank('')   // => true
 * @example isBlank(0)    // => false
 * @example isBlank([])   // => false
 */
export function isBlank(val: unknown): boolean {
  return isNil(val) || val === ''
}

/**
 * `true` if `[...val]` is likely to give you something useful.
 *
 * Arrays, Sets, Maps, typed arrays and any other iterable. **Strings are excluded**: spreading
 * one works but yields characters, which is essentially never what a caller asking "is this a
 * collection?" wants.
 *
 * @param val - Anything at all.
 * @returns Whether the value spreads as a collection.
 *
 * @example arrayish([1, 2])          // => true
 * @example arrayish(new Set([1]))    // => true
 * @example arrayish('abc')           // => false
 * @example arrayish({ aa: 1 })       // => false
 */
export function arrayish(val: unknown): boolean {
  if (typeof val === 'string') { return false }
  if (Array.isArray(val)) { return true }
  return typeof (val as { [Symbol.iterator]?: unknown } | null | undefined)?.[Symbol.iterator] === 'function'
}

/**
 * `true` for a plain bag of properties, or a Map.
 *
 * The decoys are what this is for: a Date, a RegExp, an Error, a class instance and a function
 * all answer `'object'` or carry keys, and none of them is a bag you should iterate as data.
 * A prototype-less object (`Object.create(null)`) counts.
 *
 * @param val - Anything at all.
 * @returns Whether the value is a plain keyed collection.
 *
 * @example baggish({ aa: 1 })          // => true
 * @example baggish(new Map())          // => true
 * @example baggish(new Date())         // => false
 * @example baggish([1, 2])             // => false
 */
export function baggish(val: unknown): val is TY.AnyBag {
  if (val === null || typeof val !== 'object') { return false }
  if (val instanceof Map) { return true }
  if (arrayish(val)) { return false }
  const proto = Object.getPrototypeOf(val) as object | null
  return proto === null || proto === Object.prototype
}

/**
 * `true` for a value carrying nothing: nil, `''`, `{}`, `[]`, an empty Map, Set or buffer.
 *
 * Numbers and booleans are never void -- `0`, `-0`, `false` and `NaN` are all values someone
 * meant. Neither is an object that merely has no own keys but is something in its own right,
 * like a Date.
 *
 * @param val - Anything at all.
 * @returns Whether the value is empty of content.
 *
 * @example isVoid({})          // => true
 * @example isVoid([])          // => true
 * @example isVoid(0)           // => false
 * @example isVoid(new Date())  // => false
 */
export function isVoid(val: unknown): boolean {
  if (isBlank(val)) { return true }
  if (typeof val !== 'object') { return false }
  if (Array.isArray(val)) { return val.length === 0 }
  if (val instanceof Map || val instanceof Set) { return val.size === 0 }
  if (ArrayBuffer.isView(val)) { return val.byteLength === 0 }
  if (val instanceof ArrayBuffer) { return val.byteLength === 0 }
  // Anything left that is not a plain bag is a thing, not a container: present, so not void.
  if (! baggish(val)) { return false }
  return Object.keys(val).length === 0
}

/**
 * How many entries a collection holds.
 *
 * @param clxn - An array, bag, Map or Set; nil counts as empty.
 * @returns The entry count.
 *
 * @example clxnsize([1, 2])        // => 2
 * @example clxnsize({ aa: 1 })     // => 1
 * @example clxnsize(new Set([1]))  // => 1
 * @example clxnsize(null)          // => 0
 */
export function clxnsize(clxn: unknown): number {
  if (isNil(clxn)) { return 0 }
  if (Array.isArray(clxn)) { return clxn.length }
  if (clxn instanceof Map || clxn instanceof Set) { return clxn.size }
  if (typeof clxn !== 'object') { return 0 }
  return Object.keys(clxn).length
}

/**
 * `true` if the value can be iterated, synchronously or not.
 *
 * Unlike {@link arrayish} this says nothing about spreading -- an async iterable answers `true`
 * here and `false` there.
 *
 * @param val - Anything at all.
 * @returns Whether the value carries either iterator protocol.
 */
export function isAnyIterable(val: unknown): boolean {
  const probe = val as { [Symbol.iterator]?: unknown, [Symbol.asyncIterator]?: unknown } | null | undefined
  return typeof probe?.[Symbol.iterator] === 'function' || typeof probe?.[Symbol.asyncIterator] === 'function'
}

/**
 * The collection with its nil entries gone: dropped from an array, absent from a bag.
 *
 * Only immediate entries are considered, and only `null` and `undefined` count -- `{}`, `[]`,
 * `''`, `false`, `0`, `-0` and `NaN` all survive. For the stricter sweep see {@link scrubVoid}.
 *
 * @param clxn - The collection to scrub; never mutated.
 * @returns A new collection of the same shape.
 *
 * @example scrubNil(['aa', null, 'bb'])        // => ['aa', 'bb']
 * @example scrubNil({ aa: 1, bb: null })       // => { aa: 1 }
 * @example scrubNil([0, '', false, NaN])       // => [0, '', false, NaN]
 */
export function scrubNil<CT extends object>(clxn: CT): TT.WithoutNilVals<CT> {
  return scrubBy(clxn, isNil) as TT.WithoutNilVals<CT>
}

/**
 * The collection with its void entries gone -- nil, `''`, `{}`, `[]` and other empties.
 *
 * The type says only that nil is gone, because "a string that is not empty" is not a type
 * TypeScript can express. See {@link isVoid} for exactly what goes.
 *
 * @param clxn - The collection to scrub; never mutated.
 * @returns A new collection of the same shape.
 *
 * @example scrubVoid(['aa', '', null, 'bb'])   // => ['aa', 'bb']
 * @example scrubVoid({ aa: 1, bb: {}, cc: 0 }) // => { aa: 1, cc: 0 }
 */
export function scrubVoid<CT extends object>(clxn: CT): TT.WithoutNilVals<CT> {
  return scrubBy(clxn, isVoid) as TT.WithoutNilVals<CT>
}

/** An array keeps its shape as an array, a bag as a bag -- the one branch both scrubbers need */
function scrubBy(clxn: object, reject: (val: unknown) => boolean): object {
  if (Array.isArray(clxn)) { return (clxn as unknown[]).filter((val) => ! reject(val)) }
  return omitBy(clxn, (val: unknown) => reject(val))
}

//
// == [Non-empty arrays] ==
//

/**
 * `arr` as a non-empty array, checked.
 *
 * The relic routed this through a Zod schema; a length check is all it ever was.
 *
 * @param arr - The array to vouch for.
 * @returns The same array, typed as carrying at least one entry.
 * @throws BlankError when the array is empty.
 *
 * @example arrNZ(['aa'])  // => ['aa'], typed [string, ...string[]]
 */
export function arrNZ<AT>(arr: readonly AT[]): TY.ArrNZ<AT> {
  if (arr.length === 0) { throw BlankValue('Need a non-empty array, got an empty one', { length: 0 }) }
  return arr as unknown as TY.ArrNZ<AT>
}

/**
 * `arr` as a non-empty read-only array, checked.
 *
 * @param arr - The array to vouch for.
 * @returns The same array, typed read-only and non-empty.
 * @throws BlankError when the array is empty.
 */
export function arrNZRO<AT>(arr: readonly AT[]): TY.ArrNZRO<AT> {
  return arrNZ(arr)
}

/**
 * `arr` typed as non-empty **without checking**.
 *
 * For the case where you have just built the array and the compiler cannot see it. The name is
 * the warning: if you are wrong, the lie surfaces somewhere far from here. Prefer {@link arrNZ}.
 *
 * @param arr - The array to assert about.
 * @returns The same array, typed as non-empty.
 */
export function cheatNZ<AT>(arr: readonly AT[]): TY.ArrNZ<AT> {
  return arr as unknown as TY.ArrNZ<AT>
}

/**
 * An empty array already typed as non-empty, to be filled before anyone looks.
 *
 * A deliberate lie, for building an accumulator whose type is settled before its contents are.
 * Fill it in the very next statements; a caller that receives it empty has been misled.
 *
 * @returns An empty array wearing a non-empty type.
 */
export function arrNZToFill<AT>(): TY.ArrNZ<AT> {
  return [] as unknown as TY.ArrNZ<AT>
}

/**
 * Whether `arr` holds at least one entry, narrowing it if so.
 *
 * Sound, unlike the casts above: the element type comes from the argument rather than from a
 * caller's hopes.
 *
 * @param arr - The array to check; nil counts as empty.
 * @returns Whether it is non-empty.
 *
 * @example isArrNZ(['aa'])  // => true
 * @example isArrNZ([])      // => false
 */
export function isArrNZ<AT>(arr: readonly AT[] | null | undefined): arr is TY.ArrNZ<AT> {
  return Array.isArray(arr) && arr.length > 0
}

/**
 * Append every entry of `rest` to `target`, in place.
 *
 * Flattens one level, so several arrays can go in at once. Mutating is the point: use it where
 * a caller is holding the array and expects to see it grow.
 *
 * @param target - The array to grow; mutated.
 * @param rest - Arrays whose entries to append.
 * @returns `target`.
 * @throws MistypedError when `target` is not an array.
 *
 * @example appendMutatingly(['aa'], ['bb'], ['cc'])  // => ['aa', 'bb', 'cc']
 */
export function appendMutatingly<AT>(target: AT[], ...rest: AT[][]): AT[] {
  if (! Array.isArray(target)) { throw Mistyped('Need an array to append to', { got: typeof target }) }
  target.push(...rest.flat())
  return target
}
