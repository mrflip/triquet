import { DateTime, Duration }                     from 'luxon'
import { obj, num, jsdate, custom, bareint }      from '../checks/BootChecks.ts'
import * as CO                                    from './internal.ts'
export { timestamp, timecode }                    from './PrimshapeChecks.ts'

// ***********************************************************************
//
// Time Types
//

//
// Note that there are 1000 milliseconds and 1024 bits ; it is a nanosecond timestamp
//

// ***********************************************************************
//
// Time Types
//
export function isDuration(val: any): val is Duration { return val instanceof Duration }

export const isodur_str     = CO.trimmed.max(CO.ISODUR.max).regex(CO.ISODUR.re, CO.ISODUR.msg)
export const duration       = custom<Duration>(isDuration, 'ISO Duration')
export const duration2obj   = duration.transform((dur) => dur.toObject())
export const duration2str   = duration.transform((dur) => dur.toISO()!)
export const isodur         = isodur_str.or(duration)
export const isotime        = CO.trimmed.max(CO.ISO.max).regex(CO.ISO.re, CO.ISO.msg)
export const isodate        = CO.trimmed.max(CO.ISO.max).regex(CO.ISO_YMD.re, CO.ISO_YMD.msg)
export const iso            = isotime
export const isonearfut     = CO.trimmed.max(CO.ISO_NEARFUT.max).regex(CO.ISO_NEARFUT.re, CO.ISO_NEARFUT.msg)
export const isonowish      = CO.trimmed.max(CO.ISO_NOWISH.max).regex(CO.ISO_NOWISH.re, CO.ISO_NOWISH.msg)
export const isoymdhms      = CO.trimmed.max(CO.ISO_YMDHMS.max).regex(CO.ISO_YMDHMS.re, CO.ISO_YMDHMS.msg)
export const isoymd         = CO.trimmed.max(CO.ISO_YMD.max).regex(CO.ISO_YMD.re, CO.ISO_YMD.msg)

export const neartc        = CO.lower.length(CO.NEARTC.len).regex(CO.NEARTC.re, { message: CO.NEARTC.msg }).describe('Near Timecode')
export const nearfuttc     = CO.lower.length(CO.NEARFUTTC.len).regex(CO.NEARFUTTC.re, { message: CO.NEARFUTTC.msg }).describe('Near Future Timecode')
export const nearts        = num.int().gte(CO.NEARTS.min, CO.NEARTS.min_msg).lte(CO.NEARTS.max, CO.NEARTS.max_msg).describe('Near Timestamp')
export const nearfutts     = num.int().gte(CO.NEARFUTTS.min, CO.NEARFUTTS.min_msg).lte(CO.NEARFUTTS.max, CO.NEARFUTTS.max_msg).describe('Near Future Timestamp')
export const nearpastts     = num.int().gte(CO.NEARPASTTS.gt).lte(CO.NEARPASTTS.lt)
export const monthnum      = bareint.min(1).max(12)
export const monthday      = bareint.min(1).max(31)
export const hrutc         = bareint.min(0).max(23)
export const minutc        = bareint.min(0).max(59)
export const secutc        = bareint.min(0).max(59) // disallowing 60 (leap seconds) as most other systems will barf
export const nearyear      = bareint.min(2025).max(2050)
export type  HrUTC         = number
export type  MinUTC        = number
export type  SecUTC        = number
//
export function isLuxontime(val: any): val is DateTime { return (!! (val as DateTime)?.isValid) }
export const luxontime      = custom<DateTime>(isLuxontime, 'Luxon Time')
export const loosetime      = isotime.or(isodate).or(jsdate).or(luxontime).describe('dateish')
export type  LooseTime      = DateTime | Date | string | number
//
export const timevals = obj({ ts: CO.timestamp, tc: CO.timecode, iso: isotime })
//
export const crTC           = CO.timecode;  export const rqTC         = CO.timecode
export const upTC           = CO.timecode;  export const expiresTC    = CO.timecode
export const tkvTC          = CO.timecode;  export const refreshedTC  = CO.timecode
export const crTS           = CO.timestamp; export const rqTS         = CO.timestamp
export const upTS           = CO.timestamp; export const expiresTS    = CO.timestamp
export const tkvTS          = CO.timestamp; export const refreshedTS  = CO.timestamp
export const crDT           = loosetime; export const rqDT         = loosetime
export const upDT           = loosetime; export const expiresDT    = loosetime
export const tkvDT          = loosetime; export const refreshedDT  = loosetime
export const crISO          = iso;       export const rqISO        = iso
export const upISO          = iso;       export const expiresISO   = iso
export const tkvISO         = iso;       export const refreshedISO = iso
//
export const years          = num.min(CO.YEARS.min).max(CO.YEARS.max)
export const quarters       = num.min(CO.QUARTERS.min).max(CO.QUARTERS.max)
export const months         = num.min(CO.MONTHS.min).max(CO.MONTHS.max)
export const weeks          = num.min(CO.WEEKS.min).max(CO.WEEKS.max)
export const days           = num.min(CO.DAYS.min).max(CO.DAYS.max)
export const hours          = num.min(CO.HOURS.min).max(CO.HOURS.max)
export const minutes        = num.min(CO.MINUTES.min).max(CO.MINUTES.max)
export const seconds        = num.min(CO.SECONDS.min).max(CO.SECONDS.max)
export const millis         = num.min(CO.MILLIS.min).max(CO.MILLIS.max)

