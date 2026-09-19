// import either named types, or as `import * as TT from ...`
// Mapped-type helpers for reshaping an object type. The small, always-reached vocabulary
// (Bag, ArrRO, ArrNZ and friends) lives in ./types -- this file is for the machinery.

/**
 * An intersection, flattened into a single object type.
 *
 * Every helper below is built as `Omit<OT, KT> & { ... }`, which is correct but hovers and
 * error messages render it verbatim. Mapping over the result collapses it to one object with
 * no change in meaning, which is the difference between a readable type error and a wall.
 */
export type Simplify<TT> = { [KK in keyof TT]: TT[KK] } & {}

//
// == [Loosening] == each takes the keys to act on, defaulting to all of them
//

/** `OT` with `KT` also admitting `null` */
export type WithNullable<OT, KT extends keyof OT = keyof OT> =
  Simplify<Omit<OT, KT> & { [PP in KT]: OT[PP] | null }>

/** `OT` with `KT` made optional */
export type WithOptional<OT, KT extends keyof OT = keyof OT> =
  Simplify<Omit<OT, KT> & { [PP in KT]?: OT[PP] }>

/** `OT` with `KT` made optional and also admitting `null` */
export type WithNilable<OT, KT extends keyof OT = keyof OT> =
  Simplify<Omit<OT, KT> & { [PP in KT]?: OT[PP] | null }>

//
// == [Tightening] ==
//

/** `OT` with `null` taken out of `KT`, leaving optionality alone */
export type WithoutNull<OT, KT extends keyof OT = keyof OT> =
  Simplify<Omit<OT, KT> & { [PP in KT]: Exclude<OT[PP], null> }>

/** `OT` with `KT` made required, and `undefined` taken out of them */
export type WithoutOptional<OT, KT extends keyof OT = keyof OT> =
  Simplify<Omit<OT, KT> & { [PP in KT]-?: Exclude<OT[PP], undefined> }>

/** `OT` with `KT` made required and stripped of both `null` and `undefined` */
export type WithoutNil<OT, KT extends keyof OT = keyof OT> =
  Simplify<Omit<OT, KT> & { [PP in KT]-?: NonNullable<OT[PP]> }>

//
// == [Rearranging] ==
//

/** `BT` with its keys and values traded places */
export type Invert<BT extends Record<string, string>> = { [KK in keyof BT as BT[KK]]: KK }

//
// == [Scrubbing] == the type side of removing nil values from a collection
//

/** Keys whose declared value admits nil -- after a scrub they may be absent */
type NilKeyOf<OT> = {
  [KK in keyof OT]-?: null extends OT[KK] ? KK : undefined extends OT[KK] ? KK : never
}[keyof OT]

/** A bag keeps its open key set; only the values lose nil */
type ScrubbedBag<OT> = { [KK in keyof OT]: NonNullable<OT[KK]> }

/** A known shape keeps its solid keys and turns its nil-able ones optional -- they may be gone */
type ScrubbedObj<OT> = Simplify<
  & { [KK in Exclude<keyof OT, NilKeyOf<OT>>]: OT[KK] }
  & { [KK in NilKeyOf<OT>]?: NonNullable<OT[KK]> }
>

/**
 * `CT` with its nil values gone: dropped from an array, absent from a bag or object.
 *
 * The type side of a runtime scrub. Because it tests a bare type parameter it distributes,
 * so a union of collections maps arm by arm rather than collapsing.
 *
 * @example WithoutNilVals<(string | null)[]>            // => string[]
 * @example WithoutNilVals<Bag<number | null>>           // => Bag<number>
 * @example WithoutNilVals<{ aa: string, bb: number | null }>  // => { aa: string, bb?: number }
 */
/* eslint-disable @stylistic/indent -- a conditional chain reads as a case table; the rule wants a staircase */
export type WithoutNilVals<CT> =
  CT extends readonly (infer AT)[] ? NonNullable<AT>[]
  : string extends keyof CT        ? ScrubbedBag<CT>
  : CT extends object              ? ScrubbedObj<CT>
  : never
/* eslint-enable @stylistic/indent */
