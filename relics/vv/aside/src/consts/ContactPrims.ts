import { oneof } from '../checks/BootChecks.ts'
import * as CO from './internal.ts'

//
// == [Address and Contact]
//
export const namestr   /**/ = CO.trimmed.min(1).max(CO.NAMESTR.max).regex(CO.STRINGISH.re,  CO.STRINGISH.msg)
export const namepart       = CO.trimmed.min(1).max(CO.NAMEPART.max).regex(CO.STRINGISH.re, CO.STRINGISH.msg)
export const company        = namestr.min(1)
export const stradd1        = namestr.min(1)
export const stradd2        = namestr.min(1)
export const deliveryHints  = CO.notestr.min(1)
export const familyName     = namestr.min(1)
export const givenName      = namestr.min(1)
export const firstName      = namestr.min(1)
export const lastName       = namestr.min(1)
export const nickname       = namestr.min(1)
export const city           = namestr.min(1)
export const reg            = namestr.min(1)
export const country        = oneof(CO.CountryCodeVals)
export const phone          = CO.trimmed.max(CO.PHONE_STR.max)
export const postcode       = CO.trimmed.regex(CO.POSTCODE.re, CO.POSTCODE.msg)
export const email          = CO.lower.regex(CO.EMAIL_STR.re, CO.EMAIL_STR.msg).max(CO.FULLSTR.max)

export const fullname         = namepart
export const middleName       = namepart

export const poBox            = namepart
