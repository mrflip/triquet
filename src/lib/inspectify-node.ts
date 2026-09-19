import { inspect } from 'node:util'

/** Deeper than node's own default of 2: these dumps exist to answer "what is actually in there" */
const DefaultDepth = 4

/**
 * Render `val` with node's own `util.inspect`.
 *
 * This is the server half of `inspectify`; see that function for the contract. Only the server
 * build resolves to this file, so `node:util` never reaches the client bundle.
 *
 * @param val - Anything at all.
 * @param opts - `depth` bounds the descent (`null` for no bound); `showHidden` includes
 *   non-enumerable own properties.
 * @returns The rendered text. Throws only if the caller's own getters do.
 */
export function runInspect(val: unknown, opts: { depth?: number | null, showHidden?: boolean } = {}): string {
  return inspect(val, {
    // `?? 4` would be wrong: an explicit `depth: null` means no limit, and is not absence.
    depth:          opts.depth === undefined ? DefaultDepth : opts.depth,
    showHidden:     opts.showHidden ?? false,
    colors:         false,
    // A dump exists to be read. Past a hundred entries you are looking at a haystack, and the
    // tail of a giant array is rarely what went wrong.
    maxArrayLength: 100,
    breakLength:    Infinity,
    compact:        true,
    sorted:         false,
    getters:        false,
  })
}
