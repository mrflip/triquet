import { adjectives, animals, uniqueNamesGenerator } from 'unique-names-generator'
import _ from 'es-toolkit/compat'
import { mintId } from './ids'
import * as PA from './vv/patterns'
import * as CK from './vv/checks/strings'

/** The reserved words, to grow past as a sibling's label is grown past */
const Reserved: ReadonlySet<string> = new Set(PA.ReservedLabels)

/** How many adjective-animal pairs to try before giving up on a collision-free one */
const LocalBlankLabelAttemptsMax = 20

/**
 * A fresh `adjective_animal` label absent from `existingLabels`, or `fallback` made into a label
 * once re-rolling stops being worth it. It is never reserved, top-level words and prefixes
 * included (`helpful_otter` begins as `help` does), so it will do for a hunt as for anything else.
 *
 * @param existingLabels - Labels already spoken for, checked before each attempt.
 * @param fallback - Normalized and handed back after too many collisions; callers pass a freshly minted id.
 * @returns A label absent from `existingLabels` and reserved nowhere, or `fallback` normalized.
 *
 * @example localBlankLabel(new Set(), mintId())  // => 'quiet_otter', say
 */
export function localBlankLabel(existingLabels: ReadonlySet<string>, fallback: string): string {
  for (let attempt = 0; attempt < LocalBlankLabelAttemptsMax; attempt += 1) {
    const candidate = uniqueNamesGenerator({ dictionaries: [adjectives, animals], separator: '_', style: 'lowerCase' })
    if (! (existingLabels.has(candidate) || isReserved(candidate, { toplevel: true }))) { return candidate }
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

/**
 * `label` itself when it is free, else the first of `label_2`, `label_3`, ... that is: the stem
 * cut short where needed so the whole still fits in a label. A word no label may be
 * (`PA.ReservedLabels`) is never free, whatever `taken` holds.
 *
 * @param label - The label wanted.
 * @param taken - Labels already spoken for, any reserved only in this namespace among them.
 * @returns A label absent from `taken`, and no reserved word.
 *
 * @example firstFree('dumdum', new Set())                       // => 'dumdum'
 * @example firstFree('dumdum', new Set(['dumdum', 'dumdum_2']))  // => 'dumdum_3'
 * @example firstFree('position', new Set())                     // => 'position_2'
 */
export function firstFree(label: string, taken: ReadonlySet<string>): string {
  const isFree = (candidate: string) => ! (taken.has(candidate) || Reserved.has(candidate))
  if (isFree(label)) { return label }
  for (let nth = 2; ; nth += 1) {
    const suffix = `_${String(nth)}`
    const candidate = `${_.trimEnd(label.slice(0, PA.Label.max - suffix.length), '_')}${suffix}`
    if (isFree(candidate)) { return candidate }
  }
}

/**
 * How `normalize` is bounded: a pattern's bag (`PA.Userlabel`, say), of which it uses `max`. The
 * rest is a validator's business and is dropped. `re` would refuse what normalizing is there to
 * repair; `min` could only be met by padding with characters nobody typed, so a label shorter
 * than the pattern wants is handed back short, for the validator to refuse; `msg` is advice for a
 * failure normalizing never has.
 */
export type NormalizeOpts = Readonly<PA.Patternbag>

/**
 * `str` squeezed into a label body: deburred, lowercased, with every run of whitespace,
 * punctuation and underscore collapsed to a single underscore and none left at either end.
 * Repaired afterward so it always starts with a letter and is never shorter than two
 * characters, cut to `max` with every repair in, then validated against the `label` shape on
 * the way out.
 *
 * A reserved word (`PA.ReservedLabels`) comes back as it is, for the label's validator to refuse
 * in words the author can act on: quietly turning `position` into something else would leave
 * them wondering where their label went.
 *
 * @param str - Whatever the author typed; a blank string is a legal "no label yet".
 * @param opts - A pattern's bag; its `max` caps the label, never past what a label may hold (nor under the two characters it needs). Everything else in it is dropped.
 * @returns A label-shaped string no longer than `max`, or `''` when `str` was blank.
 *
 * @example normalize('Hello, World!')  // => 'hello_world'
 * @example normalize('clueing_full')   // => 'clueing_full'
 * @example normalize('  ')            // => ''
 * @example normalize('2nd Avenue Puzzle Solvers Club', PA.Userlabel)  // => 'z2nd_avenue_puzzle_solve'
 */
export function normalize(str: string, opts: NormalizeOpts = {}): string {
  if (str.trim() === '') { return '' }
  const max = _.clamp(opts.max ?? PA.Label.max, PA.Label.min, PA.Label.max)
  return repaired(_.trim(_.deburr(str).toLowerCase().replaceAll(/[\W_]+/g, '_'), '_'), max)
}

/** `cleaned`, made to start with a letter, cut to `max` without a trailing underscore, made two characters long, then validated as label-shaped */
function repaired(cleaned: string, max: number): string {
  const lettered = /^[a-z]/.test(cleaned) ? cleaned : `z${cleaned}`
  const label = _.trimEnd(lettered.slice(0, max), '_')
  return CK.labelshape.parse(label.padEnd(PA.Label.min, 'z'))
}

export type IsReservedOpts = {
  /** Whether the label is a hunt's or an ident's, kept from the top-level words too (`PA.ReservedToplevel`) */
  toplevel?: boolean
  /** Words let through all the same, whatever the reserved lists say (`PA.isUnreserved`) */
  allowed?:  ReadonlySet<string>
}

/**
 * Whether `label` is a word no label may be (`PA.ReservedLabels`), or ends as a pointer to a row
 * does: what lets a field say why a label of the right shape is still refused.
 *
 * @param label - A label, or anything typed for one.
 * @param opts - `toplevel` for a hunt's or an ident's label, kept from the top-level words as well; `allowed`, words let through.
 * @returns True when the label validator would refuse it for its word rather than its shape.
 *
 * @example isReserved('position')                       // => true
 * @example isReserved('my_position')                    // => false
 * @example isReserved('pricing', { toplevel: true })    // => true
 * @example isReserved('min', { allowed: new Set(['min']) })  // => false
 */
export function isReserved(label: string, opts: Readonly<IsReservedOpts> = {}): boolean {
  return ! PA.isUnreserved(label, opts.allowed) || (opts.toplevel === true && ! PA.UnreservedToplevel.rule(label))
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

/** Anything carrying a label */
export type Labelled = {
  label: string
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
  return localBlankLabel(new Set(entities.map((entity) => entity.label)), mintId())
}

/**
 * Which of `entities` answers to `label`.
 *
 * @param entities - Quizzes, or questions, or anything else `Labelled`.
 * @param label - The label being looked up, exactly as it must match.
 * @returns The matching entity, or undefined when nothing answers to it.
 */
export function entityForLabel<EE extends Labelled>(entities: readonly EE[], label: string): EE | undefined {
  return entities.find((entity) => entity.label === label)
}
