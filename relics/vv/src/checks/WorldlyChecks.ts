import      {
  num, obj, str, oneof, arr, safeint,
}                                                from './BootChecks.ts'
import      { LABEL, MEDSTR, IMAGE_PATH, HEXCOLOR, MONEYISH, UBUX } from '../Consts.ts'
import      { namestr, handleish, asciish }      from '../consts/index.ts'
import      {
  keyish, medstr, quantity, lat, lng, trimmed, lower,
}            from '../consts/PrimshapeChecks.ts'
import      { currency }                         from '../consts/EnumChecks.ts'
import type { Currency }                         from '../consts/EnumVals.ts'
import      { urlstr }                           from './UrlChecks.ts'

type AnyBag = Record<string, any>

// == [Price Related Types] ==

export const ubux           = num.int().min(UBUX.min).max(UBUX.max)
export const price          = obj({ ubux, currency })
export const moneyish       = trimmed.regex(MONEYISH.re)
export const tax_rate       = trimmed.regex(LABEL.re, LABEL.msg).max(LABEL.max)
export const masked_num     = trimmed.max(MEDSTR.max).regex(/^[0-9#\-]*$/)

export type Ubux           = number
export interface PriceCore {
  currency:             Currency
  ubux:                 number
  str?:                 string | null
  _extensions?:         AnyBag
}
export const pts_stub = obj({ num: quantity })
export const place_stub = obj({ lat, lng })
// --

// == [Image and Color Types] ==

export const hexcolor       = lower.regex(HEXCOLOR.re)
export const imageStub      = obj({ url0: urlstr.optional() }).passthrough()

export const brandcode      = keyish
export const brandname      = namestr
export const family         = handleish
export const fmt            = medstr
export const mashword       = medstr
export const pricestr       = str.max(20).regex(/^([\$\-\d\.\s]*)$/)

export const image_path     = trimmed.regex(IMAGE_PATH.re)
export const imageOrUrl     = imageStub.or(urlstr)

export const distance       = safeint.describe('Distance')
export type  Distance       = number
// --

// == [Other Semantic Strings] ==

export const namespace        = handleish
export const maskedccnum      = asciish
export const orig             = medstr
export const plainwords       = arr(medstr)
export const plan             = asciish

export type  AWSRegion = 'us-east-1'

export const HTTPMethodVals = ['get', 'delete', 'head', 'options', 'post', 'put', 'patch', 'purge', 'link', 'unlink'] as const
export const HTTPMETHODVals = ['GET', 'DELETE', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'PURGE', 'LINK', 'UNLINK'] as const
export type HTTPMethod      = (typeof HTTPMethodVals)[number]
export type HTTPMETHOD      = (typeof HTTPMETHODVals)[number]
export const httpMethod     = oneof(HTTPMethodVals)
export const httpMETHOD     = oneof(HTTPMETHODVals)
export type JWTTokenStr     = string
export type SecretTokenStr  = string
// --
