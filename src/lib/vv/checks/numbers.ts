import type * as Z from 'zod'
import { codec, int, lit, num, str, union } from '../kit'
import * as PA from '../patterns'

/** Any integer, without the safe-range guard */
export const bareint  = int.describe('integer')
/** An integer JavaScript can still count on */
export const safeint  = int.min(PA.Safeint.min).max(PA.Safeint.max).describe('safe integer')
/** A number JavaScript can still count on */
export const safenum  = num.min(PA.Safeint.min).max(PA.Safeint.max).describe('safe number')
/** A real number: `num` already refuses `Infinity` and `NaN`. Named for what the field holds. */
export const float    = num.describe('decimal')

export const uint32   = bareint.min(PA.Uint32.min).max(PA.Uint32.max).describe('uint32')
export const int32    = bareint.min(PA.Sint32.min).max(PA.Sint32.max).describe('int32')
export const uint64   = bareint.min(PA.Uint64.min).max(PA.Uint64.max).describe('uint64')
export const int64    = bareint.min(PA.Sint64.min).max(PA.Sint64.max).describe('int64')
export const byte     = bareint.min(PA.Byte.min).max(PA.Byte.max).describe('byte')

/** A count of things: never negative, capped where a typo stops looking like a number */
export const quantity = bareint.min(PA.Quantity.min).max(PA.Quantity.max).describe('quantity')
/** Money in its smallest unit, signed */
export const ubux     = safeint.min(PA.Ubux.min).max(PA.Ubux.max).describe('money amount')
export const portnum  = bareint.min(PA.Portnum.min).max(PA.Portnum.max).describe('port number')

export const lat      = safenum.min(PA.Lat.min).max(PA.Lat.max).describe('latitude degrees')
export const lng      = safenum.gt(PA.Lng.min).max(PA.Lng.max).describe('longitude degrees')

//
// == [Numberlike strings] == a number written as text, as a field or a file holds one. Each takes
// the text or the number itself, and hands back one or the other: the `...str` checks keep it as
// text, the `str...` checks make it the number it spells. Both are codecs, so `.encode()` goes
// back the other way.
//

/** Nought up to the largest safe integer */
const Usafe = { min: 0, max: PA.Safeint.max } as const

/**
 * Text that spells a number in `bounds`: shaped as `pattern` says, then held to the number it
 * spells. Nothing is trimmed: a space is not part of any number.
 *
 * @param pattern - The shape the text must have.
 * @param bounds - The least and most the number it spells may be.
 * @returns A check of text, handing back the text.
 */
function spelling(pattern: PA.Patternbag & { re: RegExp, max: number }, bounds: { min: number, max: number }): Z.ZodString {
  return str.max(pattern.max).regex(pattern.re, pattern.msg)
    .refine((val) => Number(val) >= bounds.min && Number(val) <= bounds.max, {
      message: `should be from ${String(bounds.min)} to ${String(bounds.max)}`,
      when:    (payload) => payload.issues.length === 0,
    })
}

/** The text a number is written as, or the number itself, kept as that text */
function keptAsText(text: Z.ZodString, number: Z.ZodNumber) {
  return codec(union([text, number]), text, { decode: String, encode: (val) => val })
}

/** The text a number is written as, or the number itself, made into that number */
function madeNumber(text: Z.ZodString, number: Z.ZodNumber) {
  return codec(union([text, number]), number, { decode: Number, encode: String })
}

const intText  = spelling(PA.Intstr,  PA.Safeint)
const uintText = spelling(PA.Uintstr, Usafe)
const numText  = spelling(PA.Numstr,  PA.Safeint)
const unumText = spelling(PA.Unumstr, Usafe)
const uint     = safeint.min(0)
const unum     = safenum.min(0)
const unumOrBlankText = unumText.or(lit(''))

/** A whole number, as text: `'-12'`, or `-12` made `'-12'` */
export const intstr  = keptAsText(intText,  safeint).describe('whole number (as text)')
/** A whole number of nought or more, as text */
export const uintstr = keptAsText(uintText, uint).describe('whole number, zero or more (as text)')
/** A number, as text: `'2.5'`, or `2.5` made `'2.5'` */
export const numstr  = keptAsText(numText,  safenum).describe('number (as text)')
/** A number of nought or more, as text */
export const unumstr = keptAsText(unumText, unum).describe('number, zero or more (as text)')
/** A number of nought or more, as text, or blank text: what a number a person may leave out is kept as */
export const unumstrOrBlank = codec(union([unumOrBlankText, unum]), unumOrBlankText, { decode: String, encode: (val) => val })
  .describe('number, zero or more (as text), or blank')

/** A whole number, from text or as it is: `'-12'` made `-12` */
export const strint  = madeNumber(intText,  safeint).describe('whole number (from text)')
/** A whole number of nought or more, from text or as it is */
export const ustrint = madeNumber(uintText, uint).describe('whole number, zero or more (from text)')
/** A number, from text or as it is: `'2.5'` made `2.5` */
export const strnum  = madeNumber(numText,  safenum).describe('number (from text)')
/** A number of nought or more, from text or as it is */
export const ustrnum = madeNumber(unumText, unum).describe('number, zero or more (from text)')

