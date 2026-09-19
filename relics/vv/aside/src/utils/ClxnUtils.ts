import      _                                /**/ from 'lodash'
import type { ArrNZ, ArrNZRO }                    from '../types/TSTools.ts'
import      { Z, type ZodType }                   from '../validation/ZodInternal.ts'
import { throwable } from './OutcomeUtils.ts'

type AnyBag = Record<string, any>

export const arrNZT   = Z.array(Z.any()).nonempty().describe('Non-empty array')   as ZodType<ArrNZ<any>,   any, any[]>
export const arrNZROT = arrNZT.readonly().describe('Non-empty readonly array')    as ZodType<ArrNZRO<any>, any, readonly any[]>

export function     arrNZ<AT>(arr: readonly AT[]): ArrNZ<AT>     { return arrNZT.cast(arr as any) as ArrNZ<AT> }
export function   cheatNZ<AT>(arr: readonly AT[]): ArrNZ<AT>     { return arr          as unknown as ArrNZ<AT> }
export function nonemptyArrToFill<AT>():           ArrNZ<AT>     { return []           as unknown as ArrNZ<AT> }
export function   isArrRO<AT>(arr: any): arr is readonly AT[] { return _.isArray(arr) }
export function isArrNZRO<AT>(arr: any): arr is ArrNZRO<AT>   { return _.isArray(arr) && arr.length > 0 }
//
export function   arrNZRO<AT>(arr: AT[]):               ArrNZRO<AT>
export function   arrNZRO<AT>(arr:        ArrNZRO<AT>): ArrNZRO<AT>
export function   arrNZRO<AT>(arr: AT[] | ArrNZRO<AT>): ArrNZRO<AT> { return arrNZROT.cast(arr) as ArrNZRO<AT> }
export function cheatNZRO<AT>(arr: AT[]):               ArrNZRO<AT>
export function cheatNZRO<AT>(arr:        ArrNZRO<AT>): ArrNZRO<AT>
export function cheatNZRO<AT>(arr: AT[] | ArrNZRO<AT>): ArrNZRO<AT> { return arr as unknown as ArrNZRO<AT> }
//
export function     arrRO<AT>(arr: AT[]): readonly AT[] { return arr }

export function appendMutatingly<IT>(target: IT[], ...rest: IT[][]): IT[] {
  if (! _.isFunction(target?.splice)) { throw throwable('Need an array to append to', 'mistyped', { val: target, rest }) }
  target.splice(target.length, 0, ...rest.flat())
  return target
}