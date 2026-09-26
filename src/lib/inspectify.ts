import stringify   from 'safe-stable-stringify'
import { runInspect } from '#inspect-env'

/** What comes back when a value defeats every formatter we have, including `String()` */
export const Uninspectable = '(uninspectable)'

export type InspectifyOpts = {
  /** Levels to descend before printing `[Object]`; `null` descends without limit. @default 4 */
  depth?: number | null
  /** Clamp the rendered text to this many characters, marking the cut with a single `…` */
  maxlen?: number
  /** Include non-enumerable own properties */
  showHidden?: boolean
}

/**
 * `val` rendered for a human to read, on either side of the wire, without ever throwing.
 *
 * Reach for this over `JSON.stringify` whenever a value is going into a message a person will
 * read -- an error, a log line, a test failure. It shows what JSON drops: properties explicitly
 * set to `undefined` (usually the interesting ones), functions, symbols, `Map` and `Set`,
 * class names, and cycles. Deep structures are bounded by `depth` rather than followed off a
 * cliff.
 *
 * It is synchronous, and it does not throw. A value whose getters explode falls back to stable
 * JSON, then to `String(val)`, then to `Uninspectable`. That matters because the callers are
 * error handlers: a formatter that throws while explaining a failure costs you the failure.
 *
 * The server renders with node's `util.inspect` and the browser with a close approximation of
 * it, resolved by the `#inspect-env` subpath import, so `node:util` never enters the client
 * bundle. The two agree on everyday values; exotic ones may differ in detail.
 *
 * @param val - Anything at all.
 * @param opts - `depth` bounds the descent, `maxlen` clamps the result, `showHidden` includes
 *   non-enumerable own properties.
 * @returns The rendered text, never longer than `maxlen`.
 *
 * @example inspectify({ bb: 1, aa: undefined })      // => '{ bb: 1, aa: undefined }'
 * @example inspectify([1, 2])                        // => '[ 1, 2 ]'
 * @example inspectify('hi')                          // => "'hi'"
 * @example inspectify(new Set([1, 2]))               // => 'Set(2) { 1, 2 }'
 * @example inspectify({ aa: 'wordy' }, { maxlen: 8 })  // => '{ aa: w…'
 */
export function inspectify(val: unknown, opts: InspectifyOpts = {}): string {
  try {
    return clamp(runInspect(val, opts), opts.maxlen)
  } catch {
    return lastResort(val, opts.maxlen)
  }
}

/** The fallback ladder, itself wrapped: stable JSON, then `String`, then a shrug */
function lastResort(val: unknown, maxlen: number | undefined): string {
  try {
    const json = stringify(val)
    if (json !== undefined) { return clamp(json, maxlen) }
  } catch { /* a throwing getter or a bigint; try plainer still */ }
  try {
    return clamp(String(val), maxlen)
  } catch {
    return Uninspectable
  }
}

/** `str` cut to `maxlen` characters, the last of which becomes `…` when anything was dropped */
function clamp(str: string, maxlen: number | undefined): string {
  if (maxlen === undefined || str.length <= maxlen) { return str }
  if (maxlen <= 1) { return '…'.slice(0, maxlen) }
  return str.slice(0, maxlen - 1) + '…'
}
