import      _                                /**/ from 'lodash'
import type { StringMaybe, URLStr }               from '../types/PrimTypeAliases.ts'
import      { URLSTR, IPV4HOST, IPV6HOST, HOSTNAME, HOSTORIP, URLPATH } from '../consts/internal.ts'
import      { trimmed, alnum }                    from '../consts/AllPrimchecks.ts'
import type { Anypath  }                          from '../types/index.ts'
import      {
  bareint, coerce, FailedTransform, instance, num, str, union,
  ZodIssueCode, tupleOptionals, type ZodCtx, type ZodType,
}                                                 from './BootChecks.ts'

// ***********************************************************************
//
// URL types
//

// ***********************************************************************
//
// URL types
//
// FIXME -- remove url in favor of URLStr
export const urlstr            = trimmed.url().max(URLSTR.max).regex(URLSTR.re, URLSTR.msg)
export const ipv4host          = trimmed.regex(IPV4HOST.re, IPV4HOST.msg).max(IPV4HOST.max)
export const ipv6host          = trimmed.regex(IPV6HOST.re, IPV6HOST.msg).max(IPV6HOST.max)
export const hostname          = trimmed.regex(HOSTNAME.re, HOSTNAME.msg).max(HOSTNAME.max)
export const hostorip          = trimmed.regex(HOSTORIP.re, HOSTORIP.msg).max(HOSTORIP.max)

// Don't use this for validation; it's just to unpack -- actual validation will follow
const BOBO_HOST_OR_HOSTPORT_RE = /^(?:([A-Za-z0-9\.\-]+)|\[([A-Fa-f0-9:\.]+)\]):?(\d{1,5})?$/

export const portnum        = union([str.pipe(coerce.number()), num]).pipe(bareint.max(65535))
export const hostPortStr    = str.max(1000).regex(BOBO_HOST_OR_HOSTPORT_RE)
export const hostPortPair   = tupleOptionals([hostorip, portnum.nullable().optional()])
// const tt1 = tuple([hostorip, portnum.nullable()])
// const tt2 = tupleOptionals([hostorip, portnum.nullable()])
// type TT1 = [Zcasted<typeof tt1>, Zsketch<typeof tt1>]
// type TT2 = [Zcasted<typeof tt2>, Zsketch<typeof tt2>]

export const strToHostPort  = union([
  hostPortStr.transform(_validishHostOrHostPortToHostPortPairZTransform).pipe(hostPortPair),
  hostPortPair,
]).nullable().default(null) as ZodType<HostPortPair, any, _HostPortPairSk>
export const urlobj        = instance(URL)
export const liveurl       = urlobj.or(str.url({ message: 'must be conventional URL' }).transform(_urlstrZtransform)) as ZodType<URL, any, string | URL>
export const urlpath       = str.regex(URLPATH.re, URLPATH.msg).transform(_urlpathZtransform)
export const parsedUrlpath = str.transform(_urlpathZtransform)

const _looseProtoMaybe    = alnum.nullable().default('http')
/**
 * generally intended to be called as [pathOrURL, hostPortStr?, protoStr?]:
 *   eg ['/foo', 'localhost:8080', 'https'] or ['https://whatever.com:8080/foo', undefined], etc
 * For idempotence, may be called with URL object or URLStr;
 * and the second arg may be a 'host:port', 'hostname', or [hostname?, port?] tuple*/
export const urlOrPathToLiveurl = liveurl.or(
  tupleOptionals([urlobj.or(str), strToHostPort, _looseProtoMaybe]).transform(_urlstrAndHostPortZtransform),
) as ZodType<URL, any, string | URL | _HostPortSketchTuple>

export type HostPortPair   = [string, number | null]
// please don't export these, they're just to shorthand and aren't validating (that will be handled by the URL.parse better than we could)
type _PortMaybe = number | StringMaybe
type _HostPortPairSk      = readonly [StringMaybe, _PortMaybe?] | string
type _HostPortPairMaybe   = readonly [StringMaybe, _PortMaybe?] | string | null | undefined
type _HostPortSketchTuple = readonly [URLStr | Anypath | URL, _HostPortPairMaybe?, StringMaybe?]

const EXACTLYONESLASH_RE = /^(?!^\/\/)\//

function _validishHostOrHostPortToHostPortPairZTransform(val: string) {
  const [_s, host, ipv6, port] = val.match(BOBO_HOST_OR_HOSTPORT_RE)!
  return [host ?? ipv6, port ? parseInt(port) : null]
}
function _urlpathZtransform(val: string, ctx: ZodCtx) {
  if (! EXACTLYONESLASH_RE.test(val)) { ctx.addIssue({ code: ZodIssueCode.custom, message: 'just the /path part of a URL' }); return FailedTransform }
  const parsedURLObj = URL.parse(val, 'http://placeholder')
  if (! parsedURLObj) { ctx.addIssue({ code: ZodIssueCode.custom, message: 'a conventional URL' }); return FailedTransform }
  return parsedURLObj.pathname
}
function _urlstrZtransform(val: string | URL, ctx: ZodCtx) {
  if (val instanceof URL) { return val }
  const parsedURLObj = URL.parse(val)
  if (! parsedURLObj) { ctx.addIssue({ code: ZodIssueCode.custom, message: 'a conventional URL' }); return FailedTransform }
  return parsedURLObj
}
function _urlstrAndHostPortZtransform([pathOrURL, hostPortMaybe, protoMaybe = 'http']: _HostPortSketchTuple, ctx: ZodCtx) {
  if (pathOrURL instanceof URL) { return pathOrURL }
  const [hostnameMaybe = null, portMaybe = null] = hostPortMaybe ?? []
  if (! hostnameMaybe) { return _urlstrZtransform(pathOrURL as string, ctx) }
  const portpart = portMaybe ? `:${portMaybe}` : ''
  const baseurl = `${protoMaybe}://${hostnameMaybe}${portpart}`
  const parsedURLObj = URL.parse(pathOrURL as string, baseurl)
  if (! parsedURLObj) { ctx.addIssue({ code: ZodIssueCode.custom, message: 'must be conventional URL' }); return FailedTransform }
  return parsedURLObj
}

// function _foo(xx: _HostPortSketchTuple) { console.log(xx) }
// const examples = {
//   ro1:   ['http://localhost:9999/foo', null, 'http'],
//   ro2:   ['http://localhost:9999/foo', ['hh', 'b'], 'http'],
//   ro3:   ['http://localhost:9999/foo', ['hh', null], 'http'],
//   ro4:   ['http://localhost:9999/foo', ['hh', undefined], 'http'],
//   ro5:   ['http://localhost:9999/foo', ['hh', 123], 'http'],
//   ro6:   ['http://localhost:9999/foo', ['hh'], 'http'],
//   ro7:   ['http://localhost:9999/foo', ['hh'], 'http'],
//   ro8:   ['http://localhost:9999/foo', null, 'http'],
//   ro9:   ['http://localhost:9999/foo'],
//   ro10:  ['http://localhost:9999/foo', ['hh', 'b']],
//   ro11:  ['http://localhost:9999/foo', ['hh']],
//   ro12:  ['http://localhost:9999/foo', ['hh', 123]],
//   ro13:  ['http://localhost:9999/foo', ['hh', null]],
// } as const satisfies Record<string, _HostPortSketchTuple>
// function _bar(xx: keyof typeof examples, ctx: ZodCtx) {
//   _foo(examples[xx]); _urlstrAndHostPortZtransform(examples[xx], ctx)
// }
