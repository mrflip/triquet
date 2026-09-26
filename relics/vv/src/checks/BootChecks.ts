import      _                                   /**/ from 'lodash'
//
import type {
  Zcasted, Zsketch, ZodType, ZodArray, ZodTypeAny, ZodPipeline,
  ZodRawShape, ZodAny, ZodReadonly, ZodEnum, ZodEffects, ZodUnion, ZodTuple,
  Zchecker,
}                                                     from '../validation/ZodInternal.js'
import      { checknameFor, Z }                       from '../validation/ZodInternal.js'
import type { ArrNZ, NotNil, NotUnd }                 from '../types/TSTools.ts'
import      * as CO                                   from '../Consts.ts'
import { inspectify } from '../utils/UF.ts'
//
export type {
  Zcasted, Zsketch, Zobcasted, Zobsketch, ZodType, Zensure, ZodArray, ZodTypeAny, ZodPipeline, ZodString,
  ZodRawShape, ZodAny, ZodReadonly, ZodEnum, ZodCtx, ZodObject,
}                                                     from '../validation/ZodInternal.ts'
export      {
  Z, zShape, ZodIssueCode, FailedTransform, FailedRefine,
}                                                     from '../validation/ZodInternal.ts'

/* eslint-disable prefer-destructuring */

export function isNotund(val: any): val is NotUnd { return (val !== undefined) }
export function isNotnil(val: any): val is NotNil { if (val) { return true } return (! _.isNil(val)) }

export const custom         = Z.custom               // ; const customR   = custom   //
export const notund         = custom(isNotund, 'defined or null').describe('any value or null')  as ZodType<NotUnd>
export const notnil         = custom(isNotnil,         'non-nil').describe('any non-absent value') as ZodType<NotNil>
export const anything       = Z.any().describe('any')
export const unk            = Z.unknown().describe('non-nil')
export const idk            = notnil as ZodAny

// Primitives
export const bool           = Z.boolean()
export const regexp         = Z.instanceof(RegExp)
export const jsdate         = Z.date()
export const num            = Z.number()
export const safenum        = Z.number().min(CO.SAFEINT.min).max(CO.SAFEINT.max)
export const str            = Z.string()
export const anybag         = Z.record(str, anything)
export const idkbag         = Z.record(str, idk)
export const unkbag         = Z.record(str, unk)
export const bareint        = Z.number().int()
export const safeint        = safenum.int()
export const bigint         = Z.bigint()
export const znever         = Z.never()
// ZMakers //
export const arr            = Z.array
export const bag            = Z.record
export const jsmap          = Z.map
export const jsset          = Z.set
export const jssym          = Z.symbol
export const lazy           = Z.lazy
export const literal        = Z.literal
export const obj            = Z.object
export const oneof          = Z.enum
export const tuple          = Z.tuple
export const typish         = Z.instanceof
export const union          = Z.union
export const cases          = Z.discriminatedUnion
export const preprocess     = Z.preprocess
export const coerce         = Z.coerce
export const instance       = Z.instanceof
export const promise        = Z.promise
//
export const func0args:     ZodType<()               => any> = custom(_.isFunction, 'should be a 0-arg Function').describe('func0args')       as ZodType<()               => any>
export const func1arg:      ZodType<(val: any)       => any> = custom(_.isFunction, 'should be a 1-arg Function').describe('func1arg')        as ZodType<(val: any)       => any>
export const funcPassthru:  ZodType<<XT>(val: XT)    => XT>  = custom(_.isFunction, 'should be a passthru Function').describe('funcPassthru') as ZodType<<XT>(val: XT)    =>  XT>
export const funcAnyargs:   ZodType<(...args: any[]) => any> = custom(_.isFunction, 'should be a Function').describe('funcAnyargs')           as ZodType<(...args: any[]) => any>
export const func = funcAnyargs
//
type BagIterFunc    = (val: any, key: string, ...args: any[]) => any // seq: number, clxn: Record<string, any>) => any
type ArrIterFunc    = (val: any, key: number, ...args: any[]) => any // seq: number, clxn: any[]) => any
type EitherIterFunc = BagIterFunc | ArrIterFunc
export const iterfunc = (custom(_.isFunction, 'should be a (val,key,num,clxn)=>any Function').describe('Collection Function')) as ZodType<EitherIterFunc>
// interface Bob { foo: EitherIterFunc } ; const bob: Bob = { foo(val: boolean, key, seq, clxn: Record<number | string, string>): any { return val } }

//
// export const notund            = Z.unknown().nullable().describe('any present-or-null value')
// export const notnil            = Z.unknown().describe('any non-absent value')
// export const notnull           = Z.unknown().or(Z.undefined()).describe('unset or non-null')

// const demo = obj({ anything, unk, notnull, notnil, notund  })
// export type Dicks = Zcasted<typeof demo>
// const xx = undefined
// const yy: Dicks = { anything: xx, unk: xx, notnull: xx, notnil: xx, notund: xx }
// function onUnd(xx1: undefined): Dicks { return { anything: xx, unk: xx, notnull: xx, notnil: xx, notund: xx } }
// function noNonNull(xx: NonNull) { return { anything: xx, unk: xx, notnull: xx, notnil: xx, notund: xx } }
// function noNonNil(xx: NonNull)  { return xx }
// function tryit(xx:   undefined) { return [noNonNull(xx), noNonNil(xx), noNonNull(xx)]}

export function arrNZROCk<NT extends ZodTypeAny>(check: NT): ZodReadonly<ZodArray<NT, 'atleastone'>> {
  return arr(check).nonempty().readonly()
}
export function arrROCk<NT extends ZodTypeAny>(check: NT): ZodReadonly<ZodArray<NT>> {
  return arr(check).readonly()
}
export function arrNZCk<NT extends ZodTypeAny>(check: NT): ZodArray<NT, 'atleastone'> {
  return arr(check).nonempty()
}

export type Zenum<ET extends string = string> = ZodEnum<ArrNZ<ET>>
export type Zbag<ZKT extends ZodTypeAny, ZVT extends ZodTypeAny> =
  ZodType<Record<Zcasted<ZKT> & string, Zcasted<ZVT>>, any, Record<Zsketch<ZKT> & string, Zsketch<ZVT>>>

export type PartialZbag<ZKT extends ZodTypeAny, ZVT extends ZodTypeAny> =
  ZodType<Partial<Record<Zcasted<ZKT> & string, Zcasted<ZVT>>>, any, Partial<Record<Zsketch<ZKT> & string, Zsketch<ZVT>>>>

/**
 * Check that all keys in the bag belong to the keyCK
 * does not check that the bag covers all keys in the enum,
 * returned type is Partial<Record<ZKT, ZVT>>
 */
export function bagWithKeys<ZKT extends ZodTypeAny, ZVT extends ZodTypeAny>(keyCK: ZKT, itemCk: ZVT): Zbag<ZKT, ZVT> {
  const ck = bag(itemCk).refine((boxenbag) => (_.every(_.keys(boxenbag), (key) => (_.isString(key) && keyCK.check(key)))))
  return ck as Zbag<ZKT, ZVT>
}
export function bagWithSomeKeys<ZKT extends ZodTypeAny, ZVT extends ZodTypeAny>(keyCK: ZKT, itemCk: ZVT): PartialZbag<ZKT, ZVT> {
  return bagWithKeys(keyCK, itemCk) as PartialZbag<ZKT, ZVT>
}
export function bagWithAllKeys<ZKT extends ZodTypeAny, ZVT extends ZodTypeAny>(keyCK: ZKT, itemCk: ZVT): Zbag<ZKT, ZVT> {
  return bagWithKeys(keyCK, itemCk)
}

// /**
//  * Check that all keys in the bag belong to the keyCK
//  * and that the bag covers all keys in the enum
//  * the return type is incorrect, it should be the all-keys bag but is a Partial<Record<ZKT, ZVT>>
//  */
// export function bagWithAllKeys<ZKT extends ZodTypeAny, ZVT extends ZodTypeAny>(keyCK: ZKT, itemCk: ZVT): Zbag<ZKT, ZVT> {
//   const ck = bag(itemCk).refine((boxenbag) => (_.every(boxenbag, (_item, key) => (_.isString(key) && keyCK.check(key)))))
//   return ck as Zbag<ZKT, ZVT>
// }

function __splitStr<ZT extends ZodTypeAny>(ck: ZT, sep: string | RegExp = /\W+/g): ZodPipeline<ZodEffects<any, string[], string>, ZodArray<ZT>> {
  return str.transform((val) => _.filter(val.split(sep))).pipe(arr(ck))
}
export function splitStr<ZT extends ZodTypeAny>(ck: ZT, sep?: string | RegExp | undefined): ZodUnion<[ZodPipeline<ZodEffects<any, string[], string>, ZodArray<ZT>>, ZodArray<ZT>]> {
  return union([__splitStr(ck, sep), arr(ck)])
}
export function oneOrMany<ZT extends ZodTypeAny>(ck: ZT): ZodEffects<ZodArray<ZT, "many">, ZT["_output"][], unknown> {
  return preprocess((val) => (_.isArray(val) ? val : [val]), arr(ck), { message: `should be one or many of ${checknameFor(ck)}` })
}

/**
 * due to the difficulty of determining if items have a default value,
 * you must put .optional() or .default() on the items you want to be optional.
 * Also, this may not respond to .items or other features of ZodTuple;
 * but for it to type correctly, we are coercing it to the effective type. */
export function tupleOptionals<TT extends [ZodTypeAny, ...ZodTypeAny[]]>(schemas: TT): ZodTuple<TT, null> {
  return arr(anything)
    .transform((vals) => padToLength(vals, schemas.length))
    .pipe(tuple(schemas)) as unknown as ZodTuple<TT, null>
}
function padToLength<ElT>(existing: readonly ElT[], length: number): (ElT | undefined)[] {
  const extras = (existing.length >= length) ? [] : Array(length - existing.length).fill(undefined)
  return existing.concat(extras)
}

type ZNumMakerParams = Parameters<typeof Z.number>[0]
export function among(vals: any[], params: ZNumMakerParams = {}) {
  const valset = new Set(vals)
  const valstr = vals.map((val) => inspectify(val)).join('|')
  const message = params.message || `Value should be one of: ${valstr}`
  return Z.number(params).refine((value) => valset.has(value), { message })
}
// const amongR    = among

export const ZPrims = {
  bool, str, anybag, idk, regexp, jsdate, znever, num, safenum, bareint, safeint,
  idkbag, unk, unkbag, notund, notnil, func, func0args, funcAnyargs,
} as const satisfies ZodRawShape

export const ZMakers      = {
  among,   arr,     bag,       jsmap,   jsset,  jssym,  obj, oneof, tuple, znever,
  custom,  lazy,    literal,   union,   cases, coerce, typish, preprocess, instance, oneOrMany,
  arrROCk, arrNZCk, arrNZROCk, promise, bagWithKeys, bagWithAllKeys, bagWithSomeKeys, splitStr, tupleOptionals,
} as const

export type  ZMakersT = typeof ZMakers
