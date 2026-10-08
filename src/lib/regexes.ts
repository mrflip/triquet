/**
 * An author's own regular expression, as a `text` entry's `regex` param holds it: its source and
 * its flags, kept apart as a `RegExp` keeps them. Everything here is cheap and synchronous, and
 * safe in the browser and on the server alike. Whether a pattern could take too long to match is
 * `Redos`'s question (`lib/redos.ts`), asked where a pattern is written; a pattern stored has been
 * asked it, and past that boundary it is trusted, compiled once (`compiled`) and handed to Zod.
 */

/** A regular expression an author wrote: its source, as typed between the slashes, and its flags */
export type RegexT = { source: string, flags: string }

/**
 * The flags a pattern may carry: ignore case, `^` and `$` at each line, `.` across a newline, and
 * Unicode. Never `g` or `y`, which make a `RegExp` remember where it last matched, so one cell's
 * check would start where another's stopped.
 */
export const FlagVals = ['i', 'm', 's', 'u'] as const
export type Flag = typeof FlagVals[number]

/** The flags, each at most once and in the order `FlagVals` lists them: what a stored pattern's flags look like */
export const FlagsRe = /^i?m?s?u?$/

/** The longest a pattern's source may be: room for any check a quiz's cell wants, and short enough to read at a glance */
export const SourceMax = 200

/**
 * What is wrong with `regex` as JavaScript reads it, or null when it compiles. Compiling reads
 * only the pattern, never a text, so it takes no longer than the pattern is long.
 *
 * @example compileIssueOf({ source: '(a', flags: '' })   // => 'will not compile: Unterminated group'
 * @example compileIssueOf({ source: '^a+$', flags: 'i' })  // => null
 */
export function compileIssueOf({ source, flags }: RegexT): string | null {
  try {
    void new RegExp(source, flags)
    return null
  } catch (err) {
    const said = err instanceof Error ? err.message : String(err)
    return `will not compile: ${said.replace(/^Invalid regular expression: \/.*\/[a-z]*: /su, '')}`
  }
}

/** Every pattern compiled so far, by how it is shown: a stored pattern is compiled once, however many cells are checked against it */
const Compiled = new Map<string, RegExp>()

/**
 * `regex` compiled, once: a pattern already through `compileIssueOf` and `Redos`, as a stored one
 * is. Its flags never include `g` or `y`, so the same `RegExp` checks every cell.
 *
 * @throws A `SyntaxError` for a pattern that does not compile, which a stored one always does.
 *
 * @example compiled({ source: '^a+$', flags: 'i' }).test('AA')  // => true
 */
export function compiled(regex: RegexT): RegExp {
  const shownAs = shown(regex)
  const held = Compiled.get(shownAs)
  if (held) { return held }
  const made = new RegExp(regex.source, regex.flags)
  Compiled.set(shownAs, made)
  return made
}

/**
 * `regex` as JavaScript writes one, between slashes with its flags after.
 *
 * @example shown({ source: '^a+$', flags: 'i' })  // => '/^a+$/i'
 */
export function shown({ source, flags }: RegexT): string {
  return `/${source}/${flags}`
}

/**
 * `flags` with `flag` turned on or off, in the order a stored pattern keeps them.
 *
 * @example toggled('is', 'm')  // => 'ims'
 * @example toggled('ims', 'i')  // => 'ms'
 */
export function toggled(flags: string, flag: Flag): string {
  const held = new Set(flags)
  if (held.has(flag)) { held.delete(flag) } else { held.add(flag) }
  return FlagVals.filter((each) => held.has(each)).join('')
}
