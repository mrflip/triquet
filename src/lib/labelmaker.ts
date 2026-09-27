import { adjectives, animals, uniqueNamesGenerator } from 'unique-names-generator'
import _ from 'es-toolkit/compat'
import { mintId } from './ids'
import * as PA from './vv/patterns'
import { Validator } from './validator'

const LabelValidators = Validator(({ label }) => ({ label }))

/** How many adjective-animal pairs to try before giving up on a collision-free one */
const LocalBlankLabelAttemptsMax = 20

/**
 * A fresh `adjective_animal` label absent from `existingLabels`, or `fallback` made into a label
 * once re-rolling stops being worth it.
 *
 * @param existingLabels - Labels already spoken for, checked before each attempt.
 * @param fallback - Normalized and handed back after too many collisions; callers pass a freshly minted id.
 * @returns A label absent from `existingLabels`, or `fallback` normalized.
 *
 * @example localBlankLabel(new Set(), mintId())  // => 'quiet_otter', say
 */
export function localBlankLabel(existingLabels: ReadonlySet<string>, fallback: string): string {
  for (let attempt = 0; attempt < LocalBlankLabelAttemptsMax; attempt += 1) {
    const candidate = uniqueNamesGenerator({ dictionaries: [adjectives, animals], separator: '_', style: 'lowerCase' })
    if (! existingLabels.has(candidate)) { return candidate }
  }
  return normalize(fallback)
}

/** How many characters of a fresh id disambiguate a label: its random tail, and plenty within one realm */
const FallbackSuffixLen = 8

/**
 * `str` disambiguated by appending an underscore and a fallback suffix, cut short where needed
 * so the whole still fits in a label.
 *
 * @param str - The string that collided.
 * @param fallback - What to append; the random tail of a freshly minted id when omitted.
 * @returns `str` with the suffix appended, never longer than a label may be.
 *
 * @example appendFallback('otter', 'abc123')  // => 'otter_abc123'
 */
export function appendFallback(str: string, fallback: string = mintId().slice(-FallbackSuffixLen)): string {
  return `${str.slice(0, PA.Label.max - 1 - fallback.length)}_${fallback}`
}

export type NormalizeOpts = {
  /** Cuts the cleaned body to this many characters before the letter/length repairs run; never past what a label may hold */
  maxlen?: number
}

/**
 * `str` squeezed into a label body: deburred, lowercased, with every run of whitespace,
 * punctuation and underscore collapsed to a single underscore and none left at either end.
 * Repaired afterward so it always starts with a letter and is never shorter than two
 * characters, then validated against the `label` shape on the way out.
 *
 * @param str - Whatever the author typed; a blank string is a legal "no label yet".
 * @param opts - `maxlen` caps the cleaned body before the repairs run.
 * @returns A valid `label`, or `''` when `str` was blank.
 *
 * @example normalize('Hello, World!')  // => 'hello_world'
 * @example normalize('clueing_full')   // => 'clueing_full'
 * @example normalize('  ')            // => ''
 */
export function normalize(str: string, opts: Readonly<NormalizeOpts> = {}): string {
  if (str.trim() === '') { return '' }
  return repaired(_.trim(_.deburr(str).toLowerCase().replaceAll(/[\W_]+/g, '_'), '_'), opts.maxlen)
}

/** `cleaned`, cut to length without a trailing underscore, made to start with a letter and be two characters long, then validated as a label */
function repaired(cleaned: string, maxlen: number = PA.Label.max): string {
  let label = _.trimEnd(cleaned.slice(0, Math.min(maxlen, PA.Label.max)), '_')
  if (! /^[a-z]/.test(label)) { label = `z${label}`.slice(0, PA.Label.max) }
  if (label.length < 2) { label += 'z' }
  return LabelValidators.label(label)
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

/**
 * A fresh label none of `entities` already answers to.
 *
 * What a caller making a new sibling asks for. It is the caller's job rather than the model's
 * because only the caller can see the siblings -- and because the caller needs to know the label
 * before the thing exists, to put it in an address.
 *
 * @param entities - The siblings the new one must not collide with.
 * @returns An `adjective_animal` label absent from them.
 *
 * @example freshLabelFor(realm.quizzes)  // => 'quiet_otter', say
 */
export function freshLabelFor(entities: readonly Labelled[]): string {
  return localBlankLabel(new Set(entities.map((entity) => effectiveLabelOf(entity))), mintId())
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
