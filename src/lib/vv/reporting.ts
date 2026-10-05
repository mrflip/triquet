import * as Z from 'zod'
import { inspectify } from '../inspectify'
import { shortenWithEllipsis, smush, toSentence } from '../strings'
import * as PA from './patterns'

/**
 * The issue as Zod hands it to an error map: every field the check recorded, plus `input`.
 *
 * `input` is only there because `patches/zod@4.6.5.patch` turns `reportInput` on -- without it
 * the value that failed never reaches us, and every message below would be the poorer for it.
 */
export type Rawissue = Z.core.$ZodRawIssue

/** Longest rendering of a value we will put inside a message before trimming it */
const ValueMaxlen = 180

/** How Zod names the thing a check was measuring; `origin` in an issue */
const OriginWords: Record<string, string> = {
  string: 'characters', array: 'items', set: 'items', map: 'entries', file: 'bytes',
}

/** What each `expected` type is called in a sentence */
const TypeWords: Record<string, string> = {
  string:  'text',        number:   'a number',    int:      'an integer',
  bigint:  'a bigint',    boolean:  'true/false',  symbol:   'a jssym',
  date:    'a date',      array:    'an array',    object:   'an object',
  function: 'a function', promise:  'an async',    map:      'a js Map',
  set:     'a js Set',    file:     'a file',      null:     'null',
  undefined: 'undefined', void:     'void',        never:    'never',
  unknown: 'an idk',      any:      'an idk',      nan:      'not-a-number',
}

/**
 * A number with its digits grouped, so a reader can see the size at a glance.
 *
 * `20_000_000` rather than `20000000`: the whole point of a bounds message is "how far off was
 * I", and eight undifferentiated digits do not answer that. Grouped in threes either side of
 * the point, and left alone once a number is in exponent form.
 */
function groupDigits(num: number): string {
  const parts = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(num))
  if (parts === null) { return String(num) }   // exponent form, Infinity, NaN
  const [, sign = '', whole = '', fraction] = parts
  const lead = chunked(whole, false)
  if (fraction === undefined) { return `${sign}${lead}` }
  return `${sign}${lead}.${chunked(fraction, true)}`
}

/** `digits` in groups of three, counted from the left for a fraction and the right for a whole */
function chunked(digits: string, fromLeft: boolean): string {
  const groups: string[] = []
  if (fromLeft) {
    for (let at = 0; at < digits.length; at += 3) { groups.push(digits.slice(at, at + 3)) }
  } else {
    for (let at = digits.length; at > 0; at -= 3) { groups.unshift(digits.slice(Math.max(0, at - 3), at)) }
  }
  return groups.join('_')
}

/** `val` rendered for a message: bounded, control characters tamed, wrapped in guillemets */
export function display(val: unknown): string {
  const raw = typeof val === 'number' ? groupDigits(val) : inspectify(val, { maxlen: ValueMaxlen + 10 })
  const shown = shortenWithEllipsis(raw, ValueMaxlen)
  return `«${shown.replaceAll('\\', '~^')}»`
}

/**
 * The word for a value that is absent rather than wrong, or `null` when it is a real value.
 *
 * Four different absences deserve four different words: a caller who sent `null` made a
 * different mistake from one who sent nothing at all, and being told so is the difference
 * between a fix and a guess.
 */
export function vacancy(val: unknown): string | null {
  if (val === undefined)          { return 'missing' }
  if (val === null)               { return 'nil' }
  if (val === '')                 { return 'blank' }
  if (typeof val === 'number' && Number.isNaN(val)) { return 'an invalid number' }
  return null
}

/** How many of whatever the check was counting: characters, items, entries */
function sizeOf(val: unknown): number {
  if (typeof val === 'string' || Array.isArray(val)) { return val.length }
  if (val instanceof Set || val instanceof Map) { return val.size }
  return 0
}

/** A date bound arrives as epoch millis; show it the way the value itself shows */
function bound(val: unknown, origin: string | undefined): string {
  if (origin !== 'date') { return display(val) }
  return display(new Date(Number(val)))
}

function invalidTypeAdvice(issue: Rawissue): string {
  const expected = TypeWords[String(issue.expected)] ?? String(issue.expected)
  const absent   = vacancy(issue.input)
  if (absent !== null) { return `is ${absent}, should be ${expected}` }
  const actual = TypeWords[typeof issue.input] ?? `a ${typeof issue.input}`
  return `is ${actual} but should be ${expected}`
}

function tooSmallAdvice(issue: Rawissue): string {
  const origin  = String(issue.origin)
  if (origin === 'date') { return `should be on or after ${bound(issue.minimum, origin)}` }
  const { minimum } = issue
  const counted = OriginWords[origin]
  if (counted === undefined)  { return `should be ${display(minimum)} or more` }
  if (issue.exact === true)   { return `has ${display(sizeOf(issue.input))} ${counted} but should have exactly ${display(minimum)}` }
  if (Number(minimum) <= 1)   { return 'should not be empty' }
  return `has ${display(sizeOf(issue.input))} ${counted} but should have ${display(minimum)} or more`
}

function tooBigAdvice(issue: Rawissue): string {
  const origin  = String(issue.origin)
  if (origin === 'date') { return `should be on or before ${bound(issue.maximum, origin)}` }
  const { maximum } = issue
  const counted = OriginWords[origin]
  if (counted === undefined)  { return `should be ${display(maximum)} or less` }
  if (Number(maximum) === 0)  { return 'should be empty' }
  if (issue.exact === true)   { return `has ${display(sizeOf(issue.input))} ${counted} but should have exactly ${display(maximum)}` }
  return `is too long: ${display(sizeOf(issue.input))} ${counted} vs ${display(maximum)} available`
}

function invalidFormatAdvice(issue: Rawissue): string {
  const format = String(issue.format)
  if (format === 'regex')       { return 'should match pattern' }
  if (format === 'starts_with') { return `should start with ${display(issue.prefix)}` }
  if (format === 'ends_with')   { return `should end with ${display(issue.suffix)}` }
  if (format === 'includes')    { return `should contain ${display(issue.includes)}` }
  return `should be a ${format.replaceAll('_', ' ')}`
}

function invalidValueAdvice(issue: Rawissue): string {
  const values = Array.isArray(issue.values) ? issue.values : []
  if (values.length === 1) { return `should be the value ${display(values[0])}` }
  const choices = toSentence(values, { conj: 'or', max: 4, joiner: ', ', yadayada: ', …, ' })
  return `should be one of ${choices}`
}

function unrecognizedKeysAdvice(issue: Rawissue): string {
  const keys = Array.isArray(issue.keys) ? (issue.keys as string[]) : []
  const bag  = (issue.input ?? {}) as Record<string, unknown>
  const shown = keys.map((ckey) => `${ckey}=${display(bag[ckey])}`)
  const label = keys.length === 1 ? 'unknown property' : 'unknown properties'
  return `${label} ${toSentence(shown, { max: 5, yadayada: ', …, ' })}`
}

/**
 * Zod's error map, rephrased as advice: what the value should have been.
 *
 * One function, one switch, no recursion and no second pass. Every branch reads `issue` and
 * returns a sentence; a code it has no opinion about returns `undefined`, and Zod's own wording
 * stands. That last part is what keeps this small -- it does not have to be complete to be an
 * improvement.
 *
 * Deliberately *not* here: the offending value, and the path. Both are already on the issue,
 * and a check that carries its own message (`str.regex(re, 'should be a postcode')`) never
 * reaches this function at all -- Zod takes the check's wording first. Keeping the message to
 * pure advice is what lets those two kinds of message read alike. {@link explain} puts the
 * path and the value in front.
 *
 * @param issue - The raw issue, carrying `input` thanks to the zod patch.
 * @returns The advice, or `undefined` to accept Zod's default.
 *
 * @example customError({ code: 'too_small', origin: 'string', minimum: 3, input: 'x' })
 *   // => 'has «1» characters but should have «3» or more'
 */
export function customError(issue: Rawissue): string | undefined {
  switch (issue.code) {
  case 'invalid_type':       { return invalidTypeAdvice(issue) }
  case 'too_small':          { return tooSmallAdvice(issue) }
  case 'too_big':            { return tooBigAdvice(issue) }
  case 'invalid_format':     { return invalidFormatAdvice(issue) }
  case 'invalid_value':      { return invalidValueAdvice(issue) }
  case 'unrecognized_keys':  { return unrecognizedKeysAdvice(issue) }
  case 'not_multiple_of':    { return `should be an exact multiple of ${display(issue.divisor)}` }
  // invalid_union, invalid_key, invalid_element and custom keep Zod's wording: each is either
  // about other issues we have already phrased, or about a check that supplied its own message.
  default:                   { return undefined }
  }
}

/**
 * Install {@link customError} as Zod's global error map.
 *
 * Idempotent, and the only way this module changes anything. Call it once where an app or a
 * test run starts; importing this file on its own does nothing.
 */
export function installErrorMap(): void {
  Z.config({ customError })
}

/**
 * Every offending value in a failed parse, by the path it was found at.
 *
 * A plain read of `err.issues` -- it wraps nothing and intercepts nothing. `cuts[0].year`
 * rather than `cuts.0.year`, because that is how you would type it to go look.
 *
 * @param err - The error from a failed parse.
 * @returns The bad values, keyed by path; the key is `'it'` when the whole subject was wrong.
 *
 * @example badpropsOf(err)  // => { 'shipTo.phones': [], 'trackings[0].id': undefined }
 */
export function badpropsOf(err: Z.ZodError): Record<string, unknown> {
  const found: Record<string, unknown> = {}
  for (const issue of err.issues) {
    found[pathOf(issue.path)] = (issue as { input?: unknown }).input
  }
  return found
}

/**
 * Every message in a failed parse, by the path it belongs to.
 *
 * @param err - The error from a failed parse.
 * @returns The messages, keyed by path.
 */
export function messagesOf(err: Z.ZodError): Record<string, string> {
  const found: Record<string, string> = {}
  for (const issue of err.issues) {
    found[pathOf(issue.path)] = issue.message
  }
  return found
}

/**
 * A failed parse as one line: where, what was there, and what was wrong with it.
 *
 * Each issue reads `path «value» advice`. The path is dropped when the subject itself was the
 * problem, and the value is dropped for an unknown-keys complaint, which names its own
 * offenders already.
 *
 * @param err - The error from a failed parse.
 * @returns The joined summary, `';; '` between issues.
 *
 * @example explain(err)  // => "title «''» should not be empty;; lumens «400» should be «200» or less"
 */
export function explain(err: Z.ZodError): string {
  return err.issues.map((issue) => sayIssue(issue)).join(';; ')
}

/** One issue as `path «value» advice`, leaving out whichever parts would be noise */
function sayIssue(issue: Z.core.$ZodIssue): string {
  const where = pathOf(issue.path)
  const shown = issue.code === 'unrecognized_keys' ? '' : display((issue as { input?: unknown }).input)
  return smush(' ', where === 'it' ? '' : where, shown, issue.message)
}

/**
 * A path as you would type it: `cuts[0].year`, and `'it'` for the subject itself.
 *
 * @param path - An issue's path segments.
 * @returns The dotted-and-bracketed path.
 *
 * @example pathOf(['cuts', 0, 'year'])  // => 'cuts[0].year'
 * @example pathOf([])                   // => 'it'
 */
export function pathOf(path: readonly PropertyKey[]): string {
  if (path.length === 0) { return 'it' }
  return path
    .map((seg, idx) => {
      if (typeof seg === 'number') { return `[${String(seg)}]` }
      const dot = idx === 0 ? '' : '.'
      const segname = String(seg)
      return PA.Jsident.re.test(segname) ? `${dot}${segname}` : `${dot}[${display(segname)}]`
    })
    .join('')
}
