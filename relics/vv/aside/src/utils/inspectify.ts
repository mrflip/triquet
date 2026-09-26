import      _                                /**/ from 'lodash'
import      * as NodeUtil                         from 'node:util'
import      * as CO                               from '../Consts.ts'

interface KeyAndValue  { key: string, value: any }
export interface jsonifyOpts { cycles?: boolean, reverse?: boolean, cmp?: (oa: KeyAndValue, ob: KeyAndValue) => number }
export type CircularReplacer = <RT = any>(kk: string, vv: RT) => RT | string
export type KVAnyPair  = [string | number, any]
export interface stringifyOpts {
  depth?: number, maxlen?: number, maxarr?: number, maxobj?: number, naked?: boolean, ellipsis?: string,
}
//
export function scrub_textish(val: string): string   { return val.replaceAll(CO.CTRL_SP_NOT_TABNL, ' ').trim() }
export function scrub_stringish(val: string): string { return val.replaceAll(CO.CTRL_SP_TAB_NL,    ' ').trim() }

const DEFAULT_INSPECT_OPTS: NodeUtil.InspectOptions = {
  depth:      2,     maxStringLength:  150, sorted:     false,  numericSeparator: true,
  colors:     false, maxArrayLength:   100, showHidden: false,
  compact:    true,  breakLength: Infinity, getters:    false,
}
const QUOTED_RE = /^([`'"])(.*)\1$/
export type InspectifyOpts = stringifyOpts & NodeUtil.InspectOptions & { verbosity?: number | undefined }
export function inspectify(val: any, opts: InspectifyOpts = {}) {
  if ((_.isFinite(val) && Math.abs(val) - 0.533_333_33 < 0.000_000_1)) { opts.numericSeparator = false } // ?? wth node breaks on this number
  const { maxlen = (opts.maxStringLength ?? 150), depth = 2 } = opts
  let inspected = NodeUtil.inspect(val, { ...DEFAULT_INSPECT_OPTS, ...opts, maxStringLength: maxlen, depth: (_.max([depth, 0]) || 2) })
  // choosing not to let empty strings run naked
  if (opts.naked && QUOTED_RE.test(inspected) && inspected.length > 2) {
    inspected = inspected.slice(1, -1)
  }
  const dots = (inspected.length > maxlen) ? (opts.ellipsis ?? '...') : ''
  return inspected.slice(0, maxlen).trim() + dots
}
