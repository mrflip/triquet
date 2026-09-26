import { str } from '../kit'
import * as PA from '../patterns'
import { lower, trimmed } from './strings'

/** A name, or a line of an address: real text, no control characters, phone-width */
export const namestr  = trimmed.min(1).max(PA.Namestr.max).describe('name')
/** One part of a name: given, family, middle */
export const namepart = trimmed.min(1).max(PA.Namepart.max).describe('part of a name')

export const company    = namestr.describe('company name')
export const stradd1    = namestr.describe('street address')
export const stradd2    = namestr.describe('street address, second line')
export const city       = namestr.describe('city')
export const reg        = namestr.describe('region or state')
export const familyName = namestr.describe('family name')
export const givenName  = namestr.describe('given name')
export const firstName  = namestr.describe('first name')
export const lastName   = namestr.describe('last name')
export const nickname   = namestr.describe('nickname')
export const fullname   = namepart.describe('full name')
export const middleName = namepart.describe('middle name')
export const poBox      = namepart.describe('PO box')

export const phone      = str.trim().max(PA.Phone.max).describe('phone number')
export const postcode   = str.trim().regex(PA.Postcode.re, PA.Postcode.msg).describe('postal code')
/**
 * An email address, by rules deliberately stricter than the RFC.
 *
 * One delimiter per segment, at most a few plus-parts, a real TLD and no bare IP address. The
 * standard permits a great deal that no real mailbox uses, and accepting it costs more in
 * typos let through than it gains in addresses allowed.
 */
export const email      = lower.regex(PA.Email.re, PA.Email.msg).max(PA.Email.max).describe('email address')
