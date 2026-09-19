import      _                                /**/ from 'lodash'
import      * as ZImp                             from 'zod'
import type { ZodTypeAny }                        from 'zod'
//
import      { repairError, customErrorMap }       from './ZodReporting.ts'
import      { isChecker }                         from './ZodTypeguards.ts'
import      * as _ZMP                             from './ZodMonkeypunch.ts'
import      { decorate }                          from '../utils/BaseUtils.ts'
import type { GoodOutcome }                       from '../types/UtilityTypes.ts'
//
export type {
  infer as Zcasted, input as Zsketch, ZodRawShape, ZodTypeAny, ZodType, ZodDefault,
  ZodAny, ZodArray, ZodBigInt, ZodBoolean, ZodBranded, ZodDate, ZodEffects, ZodEnum,
  ZodIntersection, ZodLiteral, ZodNever, ZodNullable, ZodNumber, ZodObject, ZodOptional,
  ZodPipeline, ZodPromise, ZodRecord, ZodString, ZodTuple, ZodUnion, ZodReadonly, ZodTypeDef,
  RefinementCtx as ZodCtx, RawCreateParams as ZodTypeParams,
}                                                 from 'zod'

// turn the enum into a union of strings
export type ZodTypenames = `${ZImp.ZodFirstPartyTypeKind}`
export {
  ZodIssueCode, NEVER as FailedTransform, NEVER as FailedRefine,
}                           from 'zod'

export type Zensure<TT, ZDT extends ZImp.ZodTypeDef = ZImp.ZodTypeDef> = ZImp.ZodType<TT, ZDT, TT | undefined>
export type Zforced<TT, ZDT extends ZImp.ZodTypeDef = ZImp.ZodTypeDef> = ZImp.ZodType<TT, ZDT, never>
export type Zobsketch<ZT extends ZImp.ZodRawShape> = ZImp.input<ZImp.ZodObject<ZT>>
export type Zobcasted<ZT extends ZImp.ZodRawShape> = ZImp.output<ZImp.ZodObject<ZT>>

// type AnyBag = Record<string, any>
interface Story { act?: string | null | undefined }
type AnyBag = Record<string, any>

// function setNormalProps<TT>(obj: TT, props: Partial<TT>): TT {
//   Object.defineProperties(obj, _.mapValues(props, (value) => ({ configurable: true, enumerable: false, value })))
//   return obj
// }
/* eslint-disable prefer-destructuring */

export interface Zchecker<Output = any, _Def extends ZImp.ZodTypeDef = ZImp.ZodTypeDef, Input = Output> extends ZImp.ZodType<Output, _Def, Input> {
  checkname:       string
  hasDescription:  boolean
  isChecker:       true
  cast(data: Input, story?: Story | undefined, params?: Partial<ZImp.ParseParams> | undefined): Output
  check(subj: any,  story?: Story | undefined, params?: Partial<ZImp.ParseParams> | undefined): boolean
  report<RT, Paths extends string>(subj: RT, story?: Story | undefined, params?: Partial<ZImp.ParseParams> | undefined): ParseReport<RT, Paths>
}
export interface IssueDetails { msg: string, badpropStr: string, badprop: any, subIssues?: ZodSubIssue[] }
export type ZodSubIssue  = ZImp.ZodIssue & {
  message: string, badprop: any, badpropStr: string,
}
export type ZIssue     = ZImp.ZodIssue & {
  message: string, badprop: any, badpropStr: string, propmsg: string, issues: ZodSubIssue[],
}
export type ProtoZodIssue = Omit<ZIssue, 'message'> & { message: IssueDetails | string | undefined }
export type DetailedIssue = ProtoZodIssue             & { message: IssueDetails }
export interface TKZodError<RT, Paths extends string = string> extends ZImp.ZodError<RT> { // Omit<ZImp.ZodError, 'issues'> {
  ok:           false
  success:      false
  pathed:       Record<Paths, readonly ZIssue[]>
  messages:     Record<Paths, string>
  badprops:     Partial<RT>  & Record<Paths, any>
  _repair(subj: any, checker: ZImp.ZodTypeAny, story?: Story): ThisType<TKZodError<RT>>
  story:        Story
  extensions:   AnyBag,
}

export interface BadParseReport<RT, Paths extends string> extends TKZodError<RT, Paths> {}
export interface GoodParseReport<RT> extends GoodOutcome<RT> { success: true }
export type ParseReport<RT, Paths extends string> = GoodOutcome<RT> | TKZodError<RT, Paths>

function report<RT, Paths extends string>(this: ZImp.ZodTypeAny, subj: RT, tmi: Story = {}): GoodParseReport<RT> | TKZodError<RT, Paths> {
  const result = this.safeParse(subj)
  if (result.success) {
    const { data, success, ...rest } = result
    return decorate(
      { tmi, act: this.checkname ?? this.constructor.name, ...rest, ok: true, val: data } as const,
      { checker: this, success },
    )
  }
  const err = result.error as TKZodError<RT, Paths>
  err._repair?.(subj, this, tmi)
  Error.captureStackTrace?.(err, report)
  return err
}

function check(this: Zchecker, subj: any, _story?: Story | undefined, params?: Partial<ZImp.ParseParams> | undefined): boolean {
  const  result = this.safeParse(subj, params)
  return result.success
}

function cast<RT>(this: Zchecker, subj: RT, story?: Story | undefined, _params?: Partial<ZImp.ParseParams> | undefined): RT | undefined {
  const result = this.report(subj, story)
  if (result.ok) { return result.val }
  Error.captureStackTrace?.(result, cast)
  throw result
}

export function demand<ZOT extends ZImp.ZodTypeAny>(zod: ZOT, obj: ZImp.infer<ZOT>, opts: Partial<ZImp.ParseParams> = {}): ZImp.infer<ZOT> {
  try {
    return zod.parse(obj, opts)
  } catch (zerr) {
    console.error(zerr, obj)
    Error.captureStackTrace?.(zerr, demand)
    throw zerr
  }
}

export function ensureDescribed<ZT extends ZImp.ZodTypeAny>(zcheck: ZT, descr: string): ZT {
  if (! zcheck.describe) { return zcheck }
  const existing = zcheck._def?.description
  if (existing) { return zcheck.describe(`${descr} (${existing})`) }
  return zcheck?.describe(descr)
}

export function zShape(checker: ZImp.ZodTypeAny, depth = 5): any {
  if (depth <= 0) { return checker }
  const shapebag = { ...(_.isFunction(checker?._def?.shape) ? checker._def.shape() : checker._def) }
  // console.warn('shapebag', shapebag)
  if (shapebag.type) {
    return { ...shapebag, type: zShape(shapebag.type, depth - 1) }
  }
  if (_.isObject(shapebag)) {
    return _.mapValues(shapebag, (subcheck, _nn) => (isChecker(subcheck) ? zShape(subcheck, depth - 1) : subcheck))
  }
  return shapebag
}

function mergeObjectSyncNoUndef(
  status: ZImp.ParseStatus,
  pairs: {
    key: ZImp.SyncParseReturnType<any>
    value: ZImp.SyncParseReturnType<any>
    alwaysSet?: boolean
  }[],
): ZImp.SyncParseReturnType {
  const finalObject: any = {}
  for (const pair of pairs) {
    const { key, value } = pair
    if (key.status    === "aborted") return ZImp.INVALID
    if (value.status  === "aborted") return ZImp.INVALID
    if (key.status    === "dirty") status.dirty()
    if (value.status  === "dirty") status.dirty()

    if (
      key.value !== "__proto__" &&
      (typeof value.value !== "undefined")
      // (typeof value.value !== "undefined" || pair.alwaysSet) // don't set undefined values
    ) {
      finalObject[key.value] = value.value
    }
  }

  return { status: status.value, value: finalObject }
}
ZImp.ParseStatus.mergeObjectSync = mergeObjectSyncNoUndef

function _repairError<RT, ZE extends TKZodError<RT>>(this: ZE, subj: any, checker: Zchecker, story: Story = {}): ZE {
  return repairError(this, subj, checker, story)
}

export function checknameFor(checker: ZodTypeAny): string {
  return checker._def?.description || String(checker._def?.typeName || checker.constructor.name).replace(/^Zod/, '')
}

function monkeypatchZod(): typeof ZImp.z {
  const monkey = ZImp as any
  /* eslint-disable no-param-reassign */
  // monkey.setErrorMap(customErrorMap as any)
  //
  const ZcheckerClass: Zchecker = monkey.ZodSchema.prototype
  ZcheckerClass.check   = check
  ZcheckerClass.report  = report
  ZcheckerClass.cast    = cast
  Object.defineProperties(monkey.ZodSchema.prototype, {
    checkname:      { get(this: ZodTypeAny): string  { return checknameFor(this) }, configurable: true },
    hasDescription: { get(this: ZodTypeAny): boolean { return Boolean(this._def?.description) }, configurable: true },
  })
  ;(ZImp.ZodError as any).prototype._repair = _repairError
  ZImp.setErrorMap(customErrorMap as any)
  //
  // ZImp.setErrorMap(customErrorMap as any)
  return ZImp.z
} /* eslint-enable no-param-reassign */

export const Z = monkeypatchZod()
export const ZLib = ZImp
