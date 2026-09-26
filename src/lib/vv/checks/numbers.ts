import { int, num } from '../kit'
import * as PA from '../patterns'

/** Any integer, without the safe-range guard */
export const bareint  = int.describe('integer')
/** An integer JavaScript can still count on */
export const safeint  = int.min(PA.Safeint.min).max(PA.Safeint.max).describe('safe integer')
/** A number JavaScript can still count on */
export const safenum  = num.min(PA.Safeint.min).max(PA.Safeint.max).describe('safe number')
/**
 * A real number.
 *
 * The relic spelled this `num.finite()`; zod 4 rejects `Infinity` and `NaN` from `ZZ.number()`
 * already, and `.finite()` is a deprecated no-op. Kept as a name because "float" says what the
 * field holds in a way that "number" does not.
 */
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
