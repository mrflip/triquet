import { adjectives, animals, uniqueNamesGenerator } from 'unique-names-generator'
import _ from 'es-toolkit/compat'
import { mintId } from './ids'
import { Validator } from './validator'

const LabelValidators = Validator(({ label }) => ({ label }))

/** How many adjective-animal pairs to try before giving up on a collision-free one */
const LocalBlankLabelAttemptsMax = 20

/**
 * A fresh `adjective_animal` label absent from `existingLabels`, or `fallback` once re-rolling
 * stops being worth it.
 *
 * @param existingLabels - Labels already spoken for, checked before each attempt.
 * @param fallback - Handed back after too many collisions; callers pass a freshly minted id.
 * @returns A label absent from `existingLabels`, or `fallback`.
 *
 * @example localBlankLabel(new Set(), '01k5f9n3ktq7wzc8x2r4m0vaeh')  // => 'quiet_otter', say
 */
export function localBlankLabel(existingLabels: ReadonlySet<string>, fallback: string): string {
  for (let attempt = 0; attempt < LocalBlankLabelAttemptsMax; attempt += 1) {
    const candidate = uniqueNamesGenerator({ dictionaries: [adjectives, animals], separator: '_', style: 'lowerCase' })
    if (! existingLabels.has(candidate)) { return candidate }
  }
  return fallback
}

/**
 * `str` disambiguated by appending an underscore and a fallback suffix.
 *
 * @param str - The string that collided.
 * @param fallback - What to append; a freshly minted id when omitted.
 * @returns `str` with the suffix appended.
 *
 * @example appendFallback('otter', '01k5f9n3ktq7wzc8x2r4m0vaeh')  // => 'otter_01k5f9n3ktq7wzc8x2r4m0vaeh'
 */
export function appendFallback(str: string, fallback?: string): string {
  return `${str}_${fallback ?? mintId()}`
}

export type NormalizeOpts = {
  /** Cuts the cleaned body to this many characters before the letter/length repairs run */
  maxlen?: number
}

/**
 * `str` squeezed into a bare label body: deburred, lowercased, with every run of whitespace,
 * punctuation and underscore stripped out entirely rather than kept as a separator -- a label
 * mashes its words together rather than joining them. Repaired afterward so it always starts
 * with a letter and is never shorter than two characters, then validated against the `label`
 * shape on the way out.
 *
 * @param str - Whatever the author typed; a blank string is a legal "no label yet".
 * @param opts - `maxlen` caps the cleaned body before the repairs run.
 * @returns A valid `label`, or `''` when `str` was blank.
 *
 * @example normalize('Hello, World!')  // => 'helloworld'
 * @example normalize('  ')            // => ''
 */
export function normalize(str: string, opts: Readonly<NormalizeOpts> = {}): string {
  if (str.trim() === '') { return '' }
  let cleaned = _.deburr(str).toLowerCase().replaceAll(/[_\W]+/g, '')
  if (opts.maxlen !== undefined) { cleaned = cleaned.slice(0, opts.maxlen) }
  if (! /^[a-z]/.test(cleaned)) { cleaned = `z${cleaned}` }
  if (cleaned.length < 2) { cleaned += 'z' }
  return LabelValidators.label(cleaned)
}

/** `label` in Title Case, for display where a heading wants words rather than an identifier */
export function titleize(label: string): string {
  return _.startCase(label)
}

/** `label` in under_score_case, for a context that wants a portable, URL-safe token */
export function urlize(label: string): string {
  return _.snakeCase(label)
}

/** `label` in kebab-case, for quiet on-screen display */
export function display(label: string): string {
  return _.kebabCase(label)
}

/** Anything carrying a generated label and an optional author override */
export type Labelled = {
  label:        string
  forced_label: string | null
}

/** The label actually in force: the author's override when there is one, else the generated one */
export function effectiveLabelOf(entity: Readonly<Labelled>): string {
  return entity.forced_label ?? entity.label
}

/**
 * Which of `entities` currently answers to `label`, by whichever label is in force for each.
 *
 * @param entities - Quizzes, or questions, or anything else `Labelled`.
 * @param label - The label being looked up, exactly as it must match.
 * @returns The matching entity, or undefined when nothing answers to it.
 */
export function entityForLabel<EE extends Labelled>(entities: readonly EE[], label: string): EE | undefined {
  return entities.find((entity) => effectiveLabelOf(entity) === label)
}
