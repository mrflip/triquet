import { clamp } from 'es-toolkit/compat'
import { scrubVoid } from './collections'
import { BadValue, UnknownTag } from './errors'
import { inspectify } from './inspectify'
import type * as TY from './types'

export const Ellipsis3Dots = '...'
export const Ellipsis1Glyph = '…'

/**
 * How a value is rendered inside a sentence: text as itself, anything else inspected.
 *
 * A string is what the reader wants to see, not a quoted literal -- except the empty string,
 * where the quotes are the only thing that shows there was anything there at all.
 */
function briefly(val: unknown): string {
  return (typeof val === 'string' && val !== '') ? val : inspectify(val, { maxlen: 80 })
}

/** The shapes a capped collection can take; `iam` says which, and which fields are filled */
export type ManyAndLast<VT> =
  | { iam: 'void' }                        // empty
  | { iam: 'solo', first: VT }             // one entry
  | { iam: 'pair', first: VT, last: VT }   // exactly two, and two is under the cap
  | { iam: 'many', many: VT[], last: VT }  // more than two but under the cap
  | { iam: 'xnil' }                        // nothing was asked for, though there was something
  | { iam: 'xone', first: VT }             // one was asked for, though there were more
  | { iam: 'xtwo', first: VT, last: VT }   // two were asked for, though there were more
  | { iam: 'xtra', many: VT[], last: VT }  // over the cap: the first several, and the last

export type ManyAndLastKind = ManyAndLast<unknown>['iam']

export type ManyAndLastOpts = {
  /** Most entries to keep; the rest are elided */
  max?:   number
  /** Keep this many fewer than `max` when eliding, to make room for the marker */
  shave?: number
}

/**
 * Sort a collection into one of eight shapes, so a caller can phrase each differently.
 *
 * Joining a list well means treating "nothing", "one", "two", "several" and "more than we will
 * show" as different sentences rather than one loop with special cases. This does the counting
 * and the trimming once; {@link toSentence} and {@link hardcapList} do the phrasing.
 *
 * The `x`-prefixed shapes mean entries were left out. `last` is always the collection's real final
 * entry, so an elided list still ends where the real one does.
 *
 * @param clxn - Entries to sort; a bag is read as its values.
 * @param opts - `max` caps how many are kept, `shave` keeps fewer still to leave room.
 * @returns One of the eight shapes.
 *
 * @example manyAndLast([])                       // => { iam: 'void' }
 * @example manyAndLast(['aa'])                   // => { iam: 'solo', first: 'aa' }
 * @example manyAndLast(['aa', 'bb'])             // => { iam: 'pair', first: 'aa', last: 'bb' }
 * @example manyAndLast(['aa', 'bb', 'cc'])       // => { iam: 'many', many: ['aa', 'bb'], last: 'cc' }
 * @example manyAndLast(['aa', 'bb', 'cc'], { max: 2 })  // => { iam: 'xtwo', first: 'aa', last: 'cc' }
 */
export function manyAndLast<VT>(clxn: readonly VT[] | TY.Bag<VT>, opts: ManyAndLastOpts = {}): ManyAndLast<VT> {
  const { max = Infinity, shave = 0 } = opts
  const arr = Object.values(clxn)
  const size = arr.length

  if (size <= max) {
    if (size === 0) { return { iam: 'void' } }
    if (size === 1) { return { iam: 'solo', first: arr[0] as VT } }
    const last = arr.pop() as VT
    if (size === 2) { return { iam: 'pair', first: arr[0] as VT, last } }
    return { iam: 'many', many: arr, last }
  }
  if (max < 1) { return { iam: 'xnil' } }
  const cap = shave > 0 ? clamp(max - shave, 1, max) : max
  if (cap <= 1) { return { iam: 'xone', first: arr[0] as VT } }
  const last = arr.at(-1) as VT
  if (cap === 2) { return { iam: 'xtwo', first: arr[0] as VT, last } }
  return { iam: 'xtra', many: arr.slice(0, cap - 1), last }
}

export type SomeManyAndLast<VT> = {
  iam: ManyAndLastKind
  /** The kept entries in order, with no joiners: `body` then `tail` */
  some:      VT[]
  /** The leading entries, including the last one when nothing was elided */
  body:      VT[]
  /** The final entry, only when entries were elided before it */
  tail:      VT[]
  /** How many entries survived */
  postsize:  number
  /** Whether anything was left out, and so whether a marker belongs between body and tail */
  ellipsize: boolean
}

/**
 * {@link manyAndLast}, flattened into plain lists for a caller that would rather not switch.
 *
 * @param clxn - Entries to sort.
 * @param opts - As {@link manyAndLast}.
 * @returns The same decision, as `some` / `body` / `tail` plus the count and the flag.
 *
 * @example someManyAndLast(['aa', 'bb']).some           // => ['aa', 'bb']
 * @example someManyAndLast(['aa', 'bb', 'cc', 'dd'], { max: 3 }).tail  // => ['dd']
 */
export function someManyAndLast<VT>(clxn: readonly VT[] | TY.Bag<VT>, opts: ManyAndLastOpts = {}): SomeManyAndLast<VT> {
  const result    = manyAndLast(clxn, opts)
  const parts     = result as { iam: ManyAndLastKind, many?: VT[], first?: VT, last?: VT }
  const ellipsize = (parts.iam === 'xtra' || parts.iam === 'xtwo')
  const body: VT[] = parts.many ?? (parts.first === undefined ? [] : [parts.first])
  const tail: VT[] = []
  if ('last' in parts && parts.last !== undefined) {
    if (ellipsize) { tail.push(parts.last) } else { body.push(parts.last) }
  }
  const some = [...body, ...tail]
  return { ...result, some, body, tail, postsize: some.length, ellipsize }
}

export type HardcapOpts = ManyAndLastOpts & {
  /** What stands in for the entries left out */
  yadayada?: string
}

/**
 * The collection, capped, with a marker standing in for whatever was left out.
 *
 * Unlike {@link toSentence} this stays a list, so a caller can format the entries itself.
 *
 * @param clxn - Entries to cap.
 * @param opts - `max`, `shave`, and the `yadayada` marker.
 * @returns The original array when nothing was cut, otherwise a new one with the marker inside.
 *
 * @example hardcapList(['aa', 'bb'])  // => ['aa', 'bb']
 * @example hardcapList(['aa', 'bb', 'cc', 'dd'], { max: 3, shave: 1 })  // => ['aa', '…', 'dd']
 */
export function hardcapList<VT>(clxn: VT[], opts: HardcapOpts = {}): (VT | string)[] {
  const { yadayada = Ellipsis1Glyph, ...rest } = { max: 7, shave: 1, ...opts }
  const result = manyAndLast(clxn, rest)
  switch (result.iam) {
  case 'void': case 'solo': case 'pair': case 'many': { return clxn }
  case 'xnil': { return [] }
  case 'xone': { return [result.first] }
  case 'xtwo': { return [result.first, yadayada, result.last] }
  case 'xtra': { return [...result.many, yadayada, result.last] }
  default:     { throw UnknownTag('Unreachable shape from manyAndLast', { result, size: clxn.length }) }
  }
}

export type ToSentenceOpts = ManyAndLastOpts & {
  /** Between ordinary entries */
  joiner?:      string
  /** The word before the final entry; `'and'` unless you say otherwise */
  conj?:        string
  /** Before the final entry of three or more; built from `joiner` and `conj` by default */
  lastJoiner?:  string
  /** Between the two entries of a pair; built from `conj` by default */
  pairJoiner?:  string
  /** Stands in for elided entries */
  yadayada?:    string
  /** Appended whenever anything was elided */
  whoa?:        string
  /** Returned in place of an empty collection */
  empty?:       string
  /** Fewest entries to keep */
  min?:         number
  /** How each entry is rendered */
  stringifier?: (val: unknown) => string
}

/**
 * A collection as an English list: `'aa, bb, and cc'`.
 *
 * Counts as the reader does -- one entry is itself, two are joined by the conjunction, three or
 * more take the serial comma, and past `max` the middle is replaced by a marker while the real
 * final entry is kept, so the sentence still ends where the list does.
 *
 * @param clxn - Entries to phrase; a bag is read as its values.
 * @param opts - Joiners, the `max`/`shave` cap, and how each entry is rendered.
 * @returns The phrased list.
 *
 * @example toSentence([])                                  // => ''
 * @example toSentence(['aa'])                              // => 'aa'
 * @example toSentence(['aa', 'bb'])                        // => 'aa and bb'
 * @example toSentence(['aa', 'bb', 'cc'])                  // => 'aa, bb, and cc'
 * @example toSentence(['aa', 'bb'], { conj: 'or' })        // => 'aa or bb'
 * @example toSentence([], { empty: 'nothing' })            // => 'nothing'
 */
export function toSentence(clxn: readonly unknown[] | TY.AnyBag, opts: ToSentenceOpts = {}): string {
  const {
    conj = 'and', joiner = ', ', max: wantmax = Infinity, min = 0, shave = 0,
    whoa = '', empty = '', stringifier = briefly,
    lastJoiner = `${joiner}${conj} `, pairJoiner = ` ${conj} `,
    yadayada = `${joiner}...${joiner}${conj} `,
    ...rest
  } = opts
  const strays = Object.keys(rest)
  if (strays.length > 0) {
    throw BadValue('Unrecognised options for toSentence', { strays })
  }
  const max = clamp(wantmax, clamp(min, 0, Infinity), wantmax)

  const parts = manyAndLast(Object.values(clxn), { max, shave })
  switch (parts.iam) {
  case 'void': { return empty }
  case 'xnil': { return empty + whoa }
  case 'solo': { return stringifier(parts.first) }
  case 'xone': { return stringifier(parts.first) + whoa }
  case 'pair': { return stringifier(parts.first) + pairJoiner + stringifier(parts.last) }
  case 'xtwo': { return stringifier(parts.first) + yadayada + stringifier(parts.last) + whoa }
  case 'many': { return parts.many.map((val) => stringifier(val)).join(joiner) + lastJoiner + stringifier(parts.last) }
  case 'xtra': { return parts.many.map((val) => stringifier(val)).join(joiner) + yadayada + stringifier(parts.last) + whoa }
  default:     { throw UnknownTag('Unreachable shape from manyAndLast', { parts }) }
  }
}

/**
 * {@link toSentence} with every joiner the same, for a terse list rather than a sentence.
 *
 * @param clxn - Entries to join.
 * @param opts - As {@link toSentence}; the joiners default to plain commas.
 * @returns The joined list.
 *
 * @example snipjoin(['aa', 'bb', 'cc'])  // => 'aa, bb, cc'
 */
export function snipjoin(clxn: readonly unknown[] | TY.AnyBag, opts: ToSentenceOpts = {}): string {
  const joiner = opts.joiner ?? ', '
  return toSentence(clxn, {
    max: 8, shave: 1, yadayada: ', ...', joiner, lastJoiner: joiner, pairJoiner: joiner, ...opts,
  })
}

/** The same call as {@link snipjoin} */
export const briefSentence = snipjoin

export type ShortenOpts = {
  /** What marks the cut */
  tail?: string
}

/**
 * `str` trimmed to `maxlen`, cut at a word boundary where there is room to be tidy about it.
 *
 * Under about sixteen characters there is no room for manners, so it is a plain slice. Above
 * that the tail is walked back off a partial word and the marker appended.
 *
 * @param str - The text to shorten.
 * @param maxlen - Longest result to allow, marker included.
 * @param opts - `tail` is the marker; three dots by default.
 * @returns The shortened text, trimmed at both ends.
 *
 * @example shorten('hello world', 20)   // => 'hello world'
 * @example shorten('  padded  ', 20)    // => 'padded'
 * @example shorten('')                  // => ''
 */
export function shorten(str: string, maxlen = 29, opts: ShortenOpts = {}): string {
  const { tail = Ellipsis3Dots } = opts
  if (! str) { return '' }
  if (str.trim().length <= maxlen) { return str.trim() }
  if (! tail || maxlen <= 16) { return str.slice(0, maxlen).trim() }
  const breaklen = maxlen - (12 + tail.length)
  const most = str.slice(0, breaklen)
  const rest = dropTrailing(dropTrailing(str.slice(breaklen, maxlen - tail.length), true), false)
  return `${most}${rest}${tail}`.trim()
}

/**
 * {@link shorten} with the single-glyph ellipsis.
 *
 * Note that `…` counts as several bytes in an SMS and will cost you a segment; prefer
 * {@link shorten} where that matters.
 *
 * @param str - The text to shorten.
 * @param maxlen - Longest result to allow, marker included.
 * @returns The shortened text.
 */
export function shortenWithEllipsis(str: string, maxlen = 29): string {
  return shorten(str, maxlen, { tail: Ellipsis1Glyph })
}

/**
 * The parts joined by `sep`, with the empty ones left out.
 *
 * Saves the usual `[aa, bb].filter(Boolean).join(' ')` dance, and keeps `0` -- which `Boolean`
 * would have thrown away.
 *
 * @param sep - What to put between the surviving parts.
 * @param parts - The pieces; nil and empty ones are dropped.
 * @returns The joined text.
 *
 * @example smush('-', 'aa', 'bb')                  // => 'aa-bb'
 * @example smush(',', 'aa', undefined, null, 'bb') // => 'aa,bb'
 * @example smush('', 1, 2, 3)                      // => '123'
 */
export function smush(sep: string, ...parts: (string | number | null | undefined)[]): string {
  return scrubVoid(parts).join(sep)
}

/**
 * `val` in single quotes, with any it contains escaped.
 *
 * @param val - The text to quote.
 * @returns The quoted text.
 *
 * @example qt('hello')  // => "'hello'"
 * @example qt("it's")   // => "'it\\'s'"
 */
export function qt(val: string): string {
  const escaped = val.replaceAll("'", String.raw`\'`)
  return `'${escaped}'`
}

/**
 * `val` in double quotes, with any it contains escaped.
 *
 * @param val - The text to quote.
 * @returns The quoted text.
 *
 * @example dqt('say "hi"')  // => '"say \\"hi\\""'
 */
export function dqt(val: string): string {
  const escaped = val.replaceAll('"', String.raw`\"`)
  return `"${escaped}"`
}

/**
 * `val` with a comma after it.
 *
 * @param val - The text to follow with a comma.
 * @returns The text plus a comma.
 *
 * @example comma('foo')  // => 'foo,'
 */
export function comma(val: string): string {
  return `${val},`
}

/**
 * `val` single-quoted and followed by a comma -- one line of a generated list.
 *
 * @param val - The text to quote and follow.
 * @returns The quoted text plus a comma.
 *
 * @example qtc('x')  // => "'x',"
 */
export function qtc(val: string): string {
  return comma(qt(val))
}

const WordRe = /\w/

/**
 * `str` with its trailing run of word (or non-word) characters removed.
 *
 * Scanned rather than matched with `/\w+$/`: an anchored greedy run backtracks, and a linter
 * is right to say so even where the string is short.
 */
function dropTrailing(str: string, wordish: boolean): string {
  let end = str.length
  while (end > 0 && WordRe.test(str.charAt(end - 1)) === wordish) { end -= 1 }
  return str.slice(0, end)
}

/** A count becomes that many spaces; a string is the indent itself */
function indentStr(by: number | string): string {
  return typeof by === 'number' ? ' '.repeat(by) : by
}

/**
 * Every line of `text` pushed right, the whole trimmed first.
 *
 * A line that would be nothing but spaces is emptied instead, so the result carries no
 * trailing whitespace for a linter or a diff to complain about.
 *
 * @param text - The text to indent.
 * @param by - Spaces to indent by, or the exact string to use.
 * @returns The indented text.
 *
 * @example indent('aa\nbb')        // => '  aa\n  bb'
 * @example indent('aa\nbb', 4)     // => '    aa\n    bb'
 * @example indent('aa\nbb', '\t')  // => '\taa\n\tbb'
 */
export function indent(text: string, by: number | string = 2): string {
  const indenting = indentStr(by)
  return text.trim()
    .split('\n')
    .map((line) => `${indenting}${line}`.replace(/^ +$/, ''))
    .join('\n')
}

/**
 * One level of indent taken off the start of `text` and off every line after a newline.
 *
 * The mirror of {@link indent} for a template literal written inside indented code. Only a
 * leading run that matches exactly is removed, so a line indented further keeps the remainder.
 *
 * @param text - The text to dedent.
 * @param by - Spaces to remove, or the exact string to remove.
 * @returns The dedented text.
 *
 * @example dedent('  aa\n  bb')     // => 'aa\nbb'
 * @example dedent('  aa\n     bb')  // => 'aa\n   bb'
 */
export function dedent(text: string, by: number | string = 2): string {
  const indenting = indentStr(by)
  return text.replace(indenting, '').replaceAll(`\n${indenting}`, '\n')
}
