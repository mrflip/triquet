import stringify from 'safe-stable-stringify'

// Lives in its own file because it resolves differently on the server and in the browser, but
// it belongs to this toolkit: reach for it as `UU.inspectify`.
export { inspectify, Uninspectable, type InspectifyOpts } from './inspectify'

export type JsonifyOpts = {
  /** Indent by two spaces, one field per line; compact when false */
  pretty?: boolean
}

/**
 * `val` as JSON with its object keys in alphabetical order, at every depth.
 *
 * Reach for this rather than `JSON.stringify` whenever JSON leaves the program -- an export, a
 * file, anything that will be diffed or compared. The same value always yields the same bytes,
 * however its object happened to be built, so a diff shows what changed and not a shuffle.
 * Array order is preserved: it carries meaning.
 *
 * @param val - Any JSON-serialisable value.
 * @param opts - `pretty` indents by two spaces; the default is compact.
 * @returns The JSON text.
 *
 * @example jsonify({ b: 1, a: 2 })                    // => '{"a":2,"b":1}'
 * @example jsonify({ b: 1, a: [3, 1] }, { pretty: true })  // => '{\n  "a": [\n    3,\n    1\n  ],\n  "b": 1\n}'
 */
export function jsonify(val: unknown, opts: Readonly<JsonifyOpts> = {}): string {
  return stringify(val, null, opts.pretty === true ? 2 : undefined) ?? 'null'
}
