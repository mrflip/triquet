import {
  arr, str, literal, bareint, safenum, num, jsdate, anything, bool, coerce, safeint, union,
} from '../checks/BootChecks.ts'
import type { ZodType } from '../validation/ZodInternal.ts'
import * as CO                                    from './internal.ts'

//
// == [Fundamental Types]
//
export const uint32         = bareint.min(CO.UINT_32.min).max(CO.UINT_32.max)
export const int32          = bareint.min(CO.SINT_32.min).max(CO.SINT_32.max)
export const uint64         = bareint.min(CO.UINT_64.min).max(CO.UINT_64.max)
export const int64          = bareint.min(CO.SINT_64.min).max(CO.SINT_64.max)
export const byte           = bareint.min(0).max(7).describe(`byte`)
export const lat            = safenum.gte(-90).max(90).describe('latitude degrees')
export const lng            = safenum.gt(-180).max(180).describe('longitude degrees')
//
export const float          = num.finite()
export const quantity       = bareint.min(0).max(CO.QUANTITY.max)
//
// By default dates must be convertable to a timestamp greater than one billion and less than sixty years in the future
// This avoids careless conversion from a working number to a timestamp
export const modern         = jsdate.min(new Date(CO.TS_EARLIEST)).max(new Date(CO.TS_LAST_ALLOWED))
// --

//
// == [Generic Strings]
//
export const trimmed        = str.trim().regex(CO.STRINGISH.re, CO.STRINGISH.msg)
export const lower          = str.trim().regex(CO.LOWER.re,     CO.LOWER.msg).describe('plain lowercase')
//
export const textish        = str.trim().regex(CO.TEXTISH.re, CO.TEXTISH.msg)
export const blobbish       = str.regex(CO.TEXTISH.re, CO.TEXTISH.msg).max(CO.BLOBBISH.max)
// --

//
// == [Identifier Types]
//
export const tagsegs        = lower.min(1).max(40).regex(/^([a-z][a-z0-9_]*-)*[a-z0-9_]+$/, 'simple lowercase labels separated by dashes')
export const keyish         = trimmed.max(CO.MEDSTR.max).regex(CO.KEYISH.re, CO.KEYISH.msg)
// --

//
// == [Generic String checks]
//
export const shortstr       = trimmed.max(CO.SHORTSTR.max)
export const medstr         = trimmed.max(CO.MEDSTR.max)
export const fullstr        = trimmed.max(CO.FULLSTR.max)
export const bigstr         = trimmed.max(CO.BIGSTR.max)
export const idkstr         = fullstr
export const FALLBACK       = idkstr
export const titleish       = trimmed.max(CO.TITLEISH.max).describe('title')
export const longtitle      = trimmed.max(CO.LONGTITLE.max).describe('title')
export const noteish        = textish.max(CO.NOTESTR.max).regex(CO.NOTESTR.re,  CO.NOTESTR.msg).describe('standard multiline text')
export const notestr        = noteish
export const phrasetag      = lower.max(CO.PHRASETAG.max).min(CO.PHRASETAG.min).regex(CO.PHRASETAG.re, CO.PHRASETAG.msg).describe('simple lowercase+dash label')
export const regexstr       = str.regex(CO.STRINGISH_RE).describe('re pattern string')
export const handle         = str.min(CO.HANDLEISH.min).max(CO.HANDLEISH.max).regex(CO.HANDLEISH.re, CO.HANDLEISH.msg).describe('record handle')
export const emoji          = trimmed.regex(CO.STRINGISH.re, CO.STRINGISH.msg)
export const timestamp      = num.int().gte(CO.TIMESTAMP.min, CO.TIMESTAMP.min_msg).lte(CO.TIMESTAMP.max, CO.TIMESTAMP.max_msg).describe('ms timestamp')
export const timecode       = lower.length(CO.TIMECODE.len).regex(CO.TIMECODE.re, { message: CO.TIMECODE.msg }).describe('timecode')

// --

//
// == [Numberlike Strings]
//
export const boolstr        = union([literal('true'), literal('false'), bool]).pipe(coerce.boolean())
export const snumstr        = union([str.trim().regex(CO.SNUMSTR.re, CO.SNUMSTR.msg), safenum]).pipe(coerce.string().max(CO.SNUMSTR.max)).describe('number (as number/text)')                // gives a string
export const unumstr        = union([str.trim().regex(CO.UNUMSTR.re, CO.UNUMSTR.msg), safenum]).pipe(coerce.string().max(CO.UNUMSTR.max)).describe('positive number (as number/text)')       // gives a string
export const sintstr        = union([str.trim().regex(CO.SINTSTR.re, CO.SINTSTR.msg), safeint]).pipe(coerce.string().max(CO.SINTSTR.max)).describe('whole number (as number/text)')          // gives a string
export const uintstr        = union([str.trim().regex(CO.UINTSTR.re, CO.UINTSTR.msg), safeint]).pipe(coerce.string().max(CO.UINTSTR.max)).describe('positive whole number (as number/text)') // gives a string
export const intstr         = sintstr
export const numstr         = snumstr
export const qtystr         = str.trim().regex(CO.UINTSTR.re, CO.UINTSTR.msg).max(CO.UINTSTR.max).describe('positive number (as text)')

export const sstrnum        = union([str.trim().regex(CO.SNUMSTR.re, CO.SNUMSTR.msg), safenum]).pipe(coerce.number()).describe('number (as number/text)')                as ZodType<string | number, any, number> // gives a number
export const ustrnum        = union([str.trim().regex(CO.UNUMSTR.re, CO.UNUMSTR.msg), safenum]).pipe(coerce.number()).describe('positive number (as number/text)')       as ZodType<string | number, any, number> // gives a number
export const sstrint        = union([str.trim().regex(CO.SINTSTR.re, CO.SINTSTR.msg), safeint]).pipe(coerce.number()).describe('whole number (as number/text)')          as ZodType<string | number, any, number> // gives a number
export const ustrint        = union([str.trim().regex(CO.UINTSTR.re, CO.UINTSTR.msg), safeint]).pipe(coerce.number()).describe('positive whole number (as number/text)') as ZodType<string | number, any, number> // gives a number
export const strint         = sstrint
export const strnum         = sstrnum
export const hexrange       = lower.regex(CO.HEXRANGE.re)
export const pxdim          = bareint.min(1).max(20200).describe('pixels')
// --

//
// == [Booleans / Boolean-like Strings]
//
export const ok = bool
export const yayOK = literal(true)
export const notOK = literal(false)
//
const BOOLISH_TRUES     = [true,  1, 'true',  'True',  'TRUE',  '1', 'Yes', 'yes', 'YES', 'Y', 'y']
const BOOLISH_FALSES    = [false, 0, 'false', 'False', 'FALSE', '0', 'No',  'no',  'NO',  'N', 'n']
const BOOLISH_ALLOW_SET = new Set([...BOOLISH_TRUES, ...BOOLISH_FALSES])
const BOOLISH_TRUE_SET  = new Set(BOOLISH_TRUES)
const BOOLISH_FALSE_SET = new Set(BOOLISH_FALSES)
export const boolish = anything
  .refine(((val) => BOOLISH_ALLOW_SET.has(val)), { params: { msg: 'should be identifiably true or false'  } })
  .transform((val) => {
    if (BOOLISH_FALSE_SET.has(val)) { return false }
    if (BOOLISH_TRUE_SET.has(val)) {  return true  }
    return val
  }).pipe(bool)

// == [ID Types]

export const id26          = trimmed.length(CO.ID26.len).regex(CO.ID26.re, { message: CO.ID26.msg }).describe('idkeyish')
export const ulid          = trimmed.length(CO.ULID.len).regex(CO.ULID.re, { message: CO.ULID.msg }).describe('ulid')
export const extkey        = str.regex(/^[\w@!#%\.,\/:\-\+]*$/, 'should be a freeform identifier').describe('extkey')

export const guidv4         = lower.min(CO.GUIDV4.min).max(CO.GUIDV4.max).regex(CO.GUIDV4.re, { message: CO.GUIDV4.msg }).describe('V4 GUID')
export const guidv4TT       = guidv4.brand('guidv4')
export const extkeyish     = trimmed.max(CO.MEDSTR.max).regex(CO.EXTKEYISH.re, CO.EXTKEYISH.msg).min(1)
export const pctcode       = trimmed.max(CO.MEDSTR.max).regex(CO.PCTCODE.re,   CO.PCTCODE.msg).min(1)


//
// == [Datamodel-related strings] (typename, fieldname, classname, etc)
//
export const snake          = str.trim().min(1).regex(CO.SNAKE.re,        CO.SNAKE.msg)
export const locamel        = str.trim().min(1).regex(CO.LOCAMEL.re,      CO.LOCAMEL.msg)
export const camel          = str.trim().min(1).regex(CO.CAMEL.re,        CO.CAMEL.msg)
export const varname        = str.trim().min(1).regex(CO.VARNAME.re,      CO.VARNAME.msg)
export const tstype         = str.trim().min(1).regex(CO.TSTYPE.re,       CO.TSTYPE.msg)
export const typenamestr    = str.trim().min(1).regex(CO.CAMEL.re,        CO.CAMEL.msg).max(20)
export const tblname        = str.trim().min(1).regex(CO.DASHDOTLABEL.re, CO.DASHDOTLABEL.msg)
export const fieldname      = str.trim().min(1).regex(CO.FIELDNAME.re,    CO.FIELDNAME.msg)
export const dotfield       = str.trim().min(1).regex(CO.DOTFIELD.re,     CO.DOTFIELD.msg)
export const colname        = dotfield
export const lodotfield     = str.trim().min(1).regex(CO.LODOTFIELD.re,   CO.LODOTFIELD.msg)
export const qtdotfield     = str.trim().min(1).regex(CO.QTDOTFIELD.re,   "should be a maybe-quoted field path")

//
// == [Other strings]
//
export const whim = str.regex(/^[a-z0-9_-]{5,80}$/).describe('whim')

export const addrpart = str
export const strset   = arr(str)
export const exturi   = extkey
export const ccmasked = str

export type Pctcode   = string
export type Extkey    = string
export type SecretStr = string
export type Perms     = { view: boolean, edit: boolean }
export type Strset    = string[]
//
export type Pxdim     = number
export type Addrpart  = string
export type Exturi    = string
export type Ccmasked  = string

