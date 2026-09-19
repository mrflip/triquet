import _ from 'es-toolkit/compat'
import * as Labelmaker from './labelmaker'
import type { QuizT } from '../models/quiz'

/** What happened to one field, or to one whole entity, between two readings of a quiz */
export const ChangekindVals = ['set', 'revised', 'cleared', 'added', 'dropped', 'reordered'] as const
export type Changekind = typeof ChangekindVals[number]

/** The mark each kind of change wears in the shorthand */
export const ChangeSigils: Readonly<Record<Changekind, string>> = {
  set:       '+',
  revised:   '~',
  cleared:   '-',
  added:     '+',
  dropped:   '-',
  reordered: '@',
}

/** What the quiz's own fields are filed under, where a question would carry its label */
export const QuizScope = 'quiz'

/** Where the question order is filed, so a pure reordering still says something */
export const OrderFieldkey = 'order'

/** How long a commit subject may run before it is cut down to a count */
export const SubjectMax = 72

/** Fields whose movement is never worth recording: identity, and the questions handled apart */
const UninterestingFieldkeys = new Set(['id', 'questions'])

export type Change = {
  /** `quiz` for the quiz's own fields, otherwise the question's label as it now stands */
  scope:      string
  /** Which field moved, or null when the whole entity arrived or left */
  fieldkey:   string | null
  changekind: Changekind
}

/**
 * How `after` differs from `before`, field by field, naming nothing it holds.
 *
 * The shorthand is deliberately data-free: it records that a clueing was revised, never what it
 * was revised to. That keeps a commit subject readable, keeps an author's text out of somewhere
 * they did not put it, and leaves the tree itself as the only place the words live.
 *
 * A quiz arriving or leaving reports only itself -- an initial commit that also listed its five
 * blank questions as additions would bury the one fact that matters.
 *
 * @param before - The quiz as it stood, or null when it is only now coming into being.
 * @param after - The quiz as it now stands, or null when it has just been deleted.
 * @returns Every change worth recording; empty when the two readings agree.
 *
 * @example quizChanges(null, Quiz.blank())  // => [{ scope: 'quiz', fieldkey: null, changekind: 'added' }]
 */
export function quizChanges(before: QuizT | null, after: QuizT | null): Change[] {
  if (! before && ! after) { return [] }
  if (! before) { return [{ scope: QuizScope, fieldkey: null, changekind: 'added' }] }
  if (! after) { return [{ scope: QuizScope, fieldkey: null, changekind: 'dropped' }] }

  return [
    ...fieldChanges(QuizScope, before, after),
    ...questionChanges(before, after),
    ...orderChanges(before, after),
  ]
}

/**
 * One line per entity that moved: `quiz ~title`, `quiet_otter +clueing ~hint`, `+brave_ox`.
 *
 * Entities keep the order they were first seen in, and an entity that arrived or left is
 * rendered as itself alone, since its every field would trivially have moved with it.
 *
 * @param changes - Changes as `quizChanges` reported them.
 * @returns One line per entity; empty when nothing changed.
 *
 * @example shorthandLines([{ scope: 'quiz', fieldkey: 'title', changekind: 'revised' }])  // => ['quiz ~title']
 */
export function shorthandLines(changes: readonly Change[]): string[] {
  const byScope = _.groupBy(changes, (change) => change.scope)
  return Object.entries(byScope).map(([scope, mine]) => {
    const whole = mine.find((change) => change.fieldkey === null)
    if (whole) { return `${ChangeSigils[whole.changekind]}${scope}` }
    const marks = mine.map((change) => `${ChangeSigils[change.changekind]}${String(change.fieldkey)}`)
    return `${scope} ${marks.join(' ')}`
  })
}

/**
 * Every entity that moved, on one line -- the whole of a commit message -- cut down to a count
 * once it outruns `SubjectMax`.
 *
 * @param changes - Changes as `quizChanges` reported them.
 * @returns The shorthand, or null when nothing changed and nothing should be committed.
 *
 * @example shorthandFor([{ scope: 'quiz', fieldkey: null, changekind: 'added' }])  // => '+quiz'
 */
export function shorthandFor(changes: readonly Change[]): string | null {
  const lines = shorthandLines(changes)
  if (lines.length === 0) { return null }
  const oneline = lines.join('; ')
  if (oneline.length <= SubjectMax) { return oneline }
  return `${String(lines[0])}; +${String(lines.length - 1)} more`
}

/** Every field of `before` and `after` that moved, filed under `scope` */
function fieldChanges(scope: string, before: object, after: object): Change[] {
  const was = before as Record<string, unknown>
  const now = after as Record<string, unknown>
  const fieldkeys = _.union(Object.keys(was), Object.keys(now)).filter((fieldkey) => ! UninterestingFieldkeys.has(fieldkey))
  return fieldkeys.flatMap((fieldkey) => {
    const changekind = changekindFor(was[fieldkey], now[fieldkey])
    return changekind === null ? [] : [{ scope, fieldkey, changekind }]
  })
}

/** Which questions arrived, left, or had a field moved, each filed under its current label */
function questionChanges(before: QuizT, after: QuizT): Change[] {
  const wasById = new Map(before.questions.map((question) => [question.id, question]))
  const nowById = new Map(after.questions.map((question) => [question.id, question]))

  const gone = before.questions
    .filter((question) => ! nowById.has(question.id))
    .map((question): Change => ({ scope: Labelmaker.effectiveLabelOf(question), fieldkey: null, changekind: 'dropped' }))

  const here = after.questions.flatMap((question): Change[] => {
    const scope = Labelmaker.effectiveLabelOf(question)
    const was = wasById.get(question.id)
    if (! was) { return [{ scope, fieldkey: null, changekind: 'added' }] }
    return fieldChanges(scope, was, question)
  })

  return [...gone, ...here]
}

/** Whether the questions the two readings share are in a different sequence */
function orderChanges(before: QuizT, after: QuizT): Change[] {
  const nowIds = new Set(after.questions.map((question) => question.id))
  const wasIds = new Set(before.questions.map((question) => question.id))
  const wasOrder = before.questions.map((question) => question.id).filter((id) => nowIds.has(id))
  const nowOrder = after.questions.map((question) => question.id).filter((id) => wasIds.has(id))
  return _.isEqual(wasOrder, nowOrder) ? [] : [{ scope: QuizScope, fieldkey: OrderFieldkey, changekind: 'reordered' }]
}

/** How `now` differs from `was`, or null when it does not */
function changekindFor(was: unknown, now: unknown): Changekind | null {
  if (_.isEqual(was, now)) { return null }
  if (isBlank(was)) { return 'set' }
  if (isBlank(now)) { return 'cleared' }
  return 'revised'
}

/** Whether a value counts as nothing-there, for telling a field being set apart from revised */
function isBlank(val: unknown): boolean {
  return val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0)
}
