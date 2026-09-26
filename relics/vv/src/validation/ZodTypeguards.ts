import _                           /**/ from 'lodash'
import type {
  ZodAny, ZodArray, ZodBigInt, ZodBoolean, ZodDate, ZodEnum, ZodLiteral, ZodNever,
  ZodNullable,  ZodNumber, ZodPromise, ZodRecord, ZodString, ZodTuple, ZodTypeAny,
  ZodOptional,  ZodReadonly, ZodPipeline, ZodBranded, ZodTypenames,
}                                       from './ZodInternal.ts'
import type { ArrNZ, StrArrNZ, Invert } from '../types/TSTools.ts'
import      { inspectify }              from '../utils/stringify.ts'
import      { scrubNil }                from '../utils/BaseUtils.ts'

export function zcheckZodTypename(checker: ZodTypeAny): Zodname
export function zcheckZodTypename(checker: any):        Zodname | undefined
export function zcheckZodTypename(checker: ZodTypeAny): Zodname | undefined {
  return checker?._def?.typeName
}

export function zShapename(checker: ZodTypeAny): Primcheckname
export function zShapename(checker: any):        Primcheckname | 'nonChecker'
export function zShapename(checker: any):        Primcheckname | 'nonChecker' {
  if (! isChecker(checker)) { return 'nonChecker' }
  const zodTypename = zcheckZodTypename(checker)
  if (isUnwrappable(checker))    { return zShapename(checker.unwrap()) }
  if (isPipelineCk(checker))     { return zShapename(checker._def.out) }
  // if (isBrandedCk(checker))   { return zShapename(checker.unwrap()) }
  if (isArrChecker(checker))     {
    const ofname = zcheckZodTypename(checker._def?.type)
    if (ofname === 'ZodString')  { return 'strArr' }
    if (ofname === 'ZodNumber')  { return 'numArr' }
    return 'anyArr'
  }
  return ZodToCuteNameLookup[zodTypename] ?? zodTypename
}
// const xx = Z.string().brand('xxxxx')
// const yy = xx.unwrap

export function isChecker(checker: any): checker is ZodTypeAny {
  return Boolean(zcheckZodTypename(checker))
}

export function isIdkChecker(check:     ZodTypeAny): check is ZodAny               { return check?._def?.typeName === 'ZodAny'     }
export function isBigintChecker(check:  ZodTypeAny): check is ZodBigInt            { return check?._def?.typeName === 'ZodBigInt'  }
export function isBoolChecker(check:    ZodTypeAny): check is ZodBoolean           { return check?._def?.typeName === 'ZodBoolean' }
export function isJsdateChecker(check:  ZodTypeAny): check is ZodDate              { return check?._def?.typeName === 'ZodDate'    }
export function isZneverChecker(check:  ZodTypeAny): check is ZodNever             { return check?._def?.typeName === 'ZodNever'   }
export function isNumChecker(check:     ZodTypeAny): check is ZodNumber            { return check?._def?.typeName === 'ZodNumber'  }
export function isBagChecker(check:     ZodTypeAny): check is ZodRecord            { return check?._def?.typeName === 'ZodRecord'  }
export function isStrChecker(check:     ZodTypeAny): check is ZodString            { return check?._def?.typeName === 'ZodString'  }
export function isTupleChecker(check:   ZodTypeAny): check is ZodTuple             { return check?._def?.typeName === 'ZodTuple'   }
export function isOneofChecker(check:   ZodTypeAny): check is ZodEnum<StrArrNZ>    { return check?._def?.typeName === 'ZodEnum'    }
export function isStrPipelineCk(check:  ZodTypeAny): check is ZodPipeline<ZodTypeAny, ZodString>  { return isPipelineCk(check) && isStrChecker(check._def.out) }
export function isPipelineCk(check:     ZodTypeAny): check is ZodPipeline<ZodTypeAny, ZodTypeAny> { return check?._def?.typeName === 'ZodPipeline'    }
export function isBrandedCk(check:      ZodTypeAny): check is ZodBranded<ZodTypeAny, string | number | symbol> { return check?._def?.typeName === 'ZodBranded'    }
export function isUnwrappable(check:    ZodTypeAny): check is ZodUnwrappable       { return (check as ZodUnwrappable)?.unwrap !== undefined }
//
export function isStrArrChecker(check:  ZodTypeAny): check is ZodArray<ZodString>  { return isArrChecker(check, 'str') }
export function isBoolArrChecker(check: ZodTypeAny): check is ZodArray<ZodBoolean> { return isArrChecker(check, 'bool') }
export function isNumArrChecker(check:  ZodTypeAny): check is ZodArray<ZodNumber>  { return isArrChecker(check, 'num') }
export function isAnyArrChecker(check:  ZodTypeAny): check is ZodArray<ZodTypeAny> { return check?._def?.typeName === 'ZodArray' }

export function isArrChecker(check: any):                                                     check is ZodArray<ZodTypeAny>
export function isArrChecker<ST extends SimplePrimcheckname>(check: ZodTypeAny, subtype: ST): check is ZodArray<ZodSimpleRegistry[ST]>
export function isArrChecker(check: ZodTypeAny, subtype?: SimplePrimcheckname):               check is ZodArray<ZodTypeAny> {
  const zodname = zcheckZodTypename(check)
  if (zodname !== 'ZodArray') { return false }
  if (! subtype) { return true }
  const ofname  = zcheckZodTypename(check._def.type)
  return (ofname === CuteToZodNameLookup[subtype])
}

type SimplePrimcheckname   = 'idk' | 'bigint' | 'bool' | 'jsdate' | 'znever' | 'num' | 'oneof' | 'bag' | 'str' | 'tuple' | 'litStr'
type OfsimplePrimcheckname = 'numArr' | 'strArr' | 'anyArr' | 'literal'
type FancyPrimcheckname    = 'prom' | 'obj' | 'union' | 'arr' | 'tuple' | 'literal'
type WrappedPrimcheckname  = 'nullable' | 'optional' | 'branded' | 'effects' | 'intersection' | 'pipeline' | 'readonly'
type Primcheckname = SimplePrimcheckname | FancyPrimcheckname | OfsimplePrimcheckname | WrappedPrimcheckname
type ZodNameToTSName<T extends string> = T extends `Zod${infer Rest}` ? Uncapitalize<Rest> : never
type Zodname =
  | 'ZodAny'      | 'ZodBigInt'   | 'ZodBoolean' | 'ZodDate'    | 'ZodNever'
  | 'ZodNumber'   | 'ZodEnum'     | 'ZodRecord'  | 'ZodString'  | 'ZodTuple'
  | 'ZodLiteral'  | 'ZodArray'    | 'ZodObject'  | 'ZodPromise' | 'ZodUnion'
  | 'ZodNullable' | 'ZodOptional' | 'ZodBranded' | 'ZodEffects' | 'ZodIntersection'
  | 'ZodPipeline' | 'ZodReadonly'
type ZodUnwrappable = ZodNullable<any> | ZodOptional<any> | ZodPromise<any> | ZodReadonly<any>

export const CuteToZodNameLookup = {
  idk:      'ZodAny',      bigint:   'ZodBigInt',    bool:    'ZodBoolean',  jsdate:  'ZodDate',
  oneof:    'ZodEnum',     znever:   'ZodNever',     num:     'ZodNumber',   bag:     'ZodRecord',
  str:      'ZodString',   literal:  'ZodLiteral',   prom:    'ZodPromise',  tuple:  'ZodTuple',
  arr:      'ZodArray',    strArr:   'ZodArray',     numArr:  'ZodArray',    anyArr:  'ZodArray',
  litStr:   'ZodLiteral',  obj:      'ZodObject',    union:   'ZodUnion',
  nullable: 'ZodNullable', branded:  'ZodBranded',   effects: 'ZodEffects',  intersection: 'ZodIntersection',
  optional: 'ZodOptional', pipeline: 'ZodPipeline', readonly: 'ZodReadonly',
} as const satisfies Record<Primcheckname, Zodname>

export const ZodShortToZodnameLookup = {
  any:      'ZodAny',      bigInt:   'ZodBigInt',   boolean:  'ZodBoolean',  date:    'ZodDate',
  enum:     'ZodEnum',     never:    'ZodNever',    number:   'ZodNumber',   record: 'ZodRecord',
  string:   'ZodString',   literal:  'ZodLiteral',  promise:  'ZodPromise',  tuple:   'ZodTuple',
  array:    'ZodArray',    union:    'ZodUnion',    object:   'ZodObject',
  nullable: 'ZodNullable', branded:  'ZodBranded',  effects:  'ZodEffects',  intersection: 'ZodIntersection',
  optional: 'ZodOptional', pipeline: 'ZodPipeline', readonly: 'ZodReadonly',
} as const satisfies Record<ZodNameToTSName<Zodname>, Zodname>

export const CuteToZodtstypeLookup = {
  idk:      'ZodAny',      bigint:   'ZodBigInt',    bool:     'ZodBoolean',  jsdate:  'ZodDate',
  znever:   'ZodNever',     num:      'ZodNumber',   bag:     'ZodRecord',
  str:      'ZodString',   tuple:    'ZodTuple',
  literal:  'ZodLiteral<any>',     prom:     'ZodPromise<any>',           oneof:    'ZodEnum<StrArrNZ>',
  arr:      'ZodArray<ZodAny>',    strArr:   'ZodArray<ZodString>',       numArr:   'ZodArray<ZodNumber>',
  anyArr:   'ZodArray<ZodAny>',    obj:      'ZodObject<any, any, any>',  union:    'ZodUnion<any[]>',
  litStr:   'ZodLiteral<string>',  other:    'ZodTypeAny',                nonChecker: 'any',
  // nullable: 'ZodNullable', branded:  'ZodBranded',   effects:  'ZodEffects',  intersection: 'ZodIntersection',
  // optional: 'ZodOptional', pipeline: 'ZodPipeline',  readonly: 'ZodReadonly',
} as const satisfies Record<SimplePrimcheckname | FancyPrimcheckname | OfsimplePrimcheckname | 'other' | 'nonChecker', string>

export const ZodToCuteNameLookup = {
  ZodAny:     'idk',       ZodBigInt:   'bigint',     ZodBoolean:  'bool',     ZodDate:   'jsdate', ZodNever: 'znever',
  ZodNumber:  'num',       ZodEnum:     'oneof',      ZodRecord:   'bag',      ZodString: 'str',    ZodTuple: 'tuple',
  ZodLiteral: 'literal',   ZodArray:    'anyArr',     ZodObject:   'obj',      ZodPromise: 'prom',  ZodUnion: 'union',
  ZodBranded: 'branded',   ZodEffects:  'effects',    ZodPipeline: 'pipeline', ZodIntersection: 'intersection',
  ZodNullable: 'nullable', ZodOptional: 'optional',   ZodReadonly: 'readonly',
} as const satisfies Invert<typeof CuteToZodNameLookup>

export function checkernameForZodname(zodname:       Zodname):       Primcheckname
export function checkernameForZodname(zodname:       string):        Primcheckname | undefined
export function checkernameForZodname(zodname:       string):        Primcheckname | undefined { return ZodToCuteNameLookup[zodname as Zodname] }

export function zodtstypeForCheckername(checkername: Primcheckname): string
export function zodtstypeForCheckername(checkername: string):        string        | undefined
export function zodtstypeForCheckername(checkername: string):        string        | undefined { return CuteToZodtstypeLookup[checkername as SimplePrimcheckname | FancyPrimcheckname | OfsimplePrimcheckname | 'other' | 'nonChecker'] }

export function zodnameForCheckername(checkername:   Primcheckname): Zodname
export function zodnameForCheckername(checkername:   string):        Zodname       | undefined
export function zodnameForCheckername(checkername:   string):        Zodname       | undefined { return CuteToZodNameLookup[checkername as Primcheckname] }

export interface CheckerSummary {
  typeName:   ZodTypenames | '(prim)',
  ofType?:    ZodTypenames | '(prim)' | '??' | undefined,
  shape?:     Record<string, CheckerSummary>,
  ofShape?:   Record<string, CheckerSummary>,
  type?:      CheckerSummary,
  innerType?: CheckerSummary,
  catchall?:  CheckerSummary,
  items?:     CheckerSummary[],
  options?:   CheckerSummary[],
}
// interface CheckerSummaryT extends CheckerSummary { errorMap?: any }
export function summarizeCheckerDef(checker: ZodTypeAny): CheckerSummary {
  if (! checker?._def) { return { typeName: '(prim)' } }
  function brute(obj: any) { return inspectify(obj).slice(0, 100) }
  if (checker._def?.typeName === 'ZodOptional' || checker._def?.typeName === 'ZodNullable') {
    const  summ = { [checker._def?.typeName]: true, ...summarizeCheckerDef(checker._def.innerType) }
    return summ
  }
  const raw  = { ...checker._def }
  const summ: CheckerSummary = { typeName: checker._def?.typeName, ..._.omit(raw, ['type', 'innerType', 'catchall', 'items', 'options', 'errorMap']) }
  if (raw.type)              { summ.type      = summarizeCheckerDef(raw.type)     }
  if (raw.innerType)         { summ.innerType = summarizeCheckerDef(raw.innerType) }
  if (raw.catchall)          { summ.catchall  = summarizeCheckerDef(raw.catchall) }
  if (raw.items)             { summ.items     = _.map(raw.items,  (subcheck) => summarizeCheckerDef(subcheck)) }
  if (raw.options)           { summ.options   = _.map(raw.options, (subcheck) => summarizeCheckerDef(subcheck)) }
  if (summ.type?.shape)      { const { shape, ...rest } = summ.type;      summ.ofShape = shape; summ.type      = rest }
  if (summ.innerType?.shape) { const { shape, ...rest } = summ.innerType; summ.ofShape = shape; summ.innerType = rest }
  if (summ.typeName === 'ZodArray') { summ.ofType = summ.type?.typeName ?? summ.innerType?.typeName ?? '??' }
  if (raw.shape) {
    if (! _.isFunction(raw.shape)) { summ.shape = { like: brute(summ.shape) } as any; return summ }
    summ.shape = _.mapValues(raw.shape(), (subcheck) =>  summarizeCheckerDef(subcheck))
  }
  const  { typeName, ofType, ...rest } = summ
  return scrubNil({ typeName, ofType, ...rest })
}

export type ZodFancyRegistry<XT> = {
  literal:          ZodLiteral<XT>,
  oneof:            ZodEnum<ArrNZ<XT & string>>,
  enum:             ZodEnum<ArrNZ<XT & string>>,
  arr:              ZodArray<XT     & ZodTypeAny>,
  prom:             ZodPromise<XT   & ZodTypeAny>,
  nullable:         ZodNullable<XT  & ZodTypeAny>,
}

export type ZodSimpleRegistry = {
  idk:             ZodAny,
  bigint:          ZodBigInt,
  bool:            ZodBoolean,
  jsdate:          ZodDate,
  znever:          ZodNever,
  num:             ZodNumber,
  oneof:           ZodEnum<ArrNZ<any>>,
  bag:             ZodRecord,
  str:             ZodString,
  tuple:           ZodTuple,
  litStr:          ZodLiteral<string>,
  numArr:          ZodArray<ZodNumber>,
  strArr:          ZodArray<ZodString>,
  anyArr:          ZodArray<ZodAny>,
  any:             ZodAny,
  bigInt:          ZodBigInt,
  boolean:         ZodBoolean,
  date:            ZodDate,
  never:           ZodNever,
  number:          ZodNumber,
  record:          ZodRecord,
  string:          ZodString,
  literal:         ZodLiteral<string>,
  numberArray:     ZodArray<ZodNumber>,
  otherArray:      ZodArray<ZodAny>,
  stringArray:     ZodArray<ZodString>,
}
