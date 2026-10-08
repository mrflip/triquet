import type { StatusCounts } from '../lib/formulary/runner'
import type { WidgetUsageT } from '../lib/rows'
import type { EntryKind, Formularykind } from '../models/widget'
import { WidgetedStatusVals, type WidgetedStatus } from '../models/widgeted'

/** How each formulary is spoken of on screen: one of its widgets, several, and what one does */
export const FormularyWords: Readonly<Record<Formularykind, { noun: string, group: string, gist: string }>> = {
  jsonata: { noun: 'formula', group: 'Formulas', gist: 'A formula: a JSONata expression, worked out for every question as it changes' },
  aibot:   { noun: 'prompt',  group: 'Prompts',  gist: 'A prompt: put to a model for one question when you ask from its cell' },
  entry:   { noun: 'entry',   group: 'Entries',  gist: 'An entry: typed into its cells by hand, one value per question' },
}

/** How each kind of entry is spoken of on screen: what its cells take */
export const EntryKindWords: Readonly<Record<EntryKind, string>> = {
  text:      'Text: a note, markdown welcome, or one line held to a pattern',
  number:    'A number, between bounds if you like',
  boolean:   'Yes or no: a checkbox',
  enum:      'A choice: one of a list of options',
  labelish:  'A label: lowercase letters, digits and single underscores',
  titleish:  'A title: one line',
  estimates: "Category estimates: the subject categories a question draws on, each at a difficulty, and Masie, Artie and Poppy's chances at it",
}

/**
 * What a widgeting's cells are called on screen, by their widgeted's status: an `ok` cell is
 * *current*, a `missing` one *blank*. (A *stale* cell, once staleness returns, is an `ok` cell
 * that is not current, and is said between the two.)
 */
export const StatusWords: Readonly<Record<WidgetedStatus, string>> = {
  ok:      'current',
  errored: 'errored',
  missing: 'blank',
}

/** What `statusLine` says when a quiz has no questions, so no cells to count */
export const NoCellsLine = 'no questions yet'

/** What `statusLine` puts between its counts */
export const StatusJoint = ' • '

/**
 * Each status some of a widgeting's cells have, counted and said, current first and blank last:
 * the phrases of `statusLine`, for a view that marks one of them out.
 *
 * @example statusPhrases({ ok: 3, errored: 1, missing: 0 })  // => [{ status: 'ok', said: '3 current' }, { status: 'errored', said: '1 errored' }]
 */
export function statusPhrases(counts: StatusCounts): { status: WidgetedStatus, said: string }[] {
  return WidgetedStatusVals.filter((status) => counts[status] > 0).map((status) => ({ status, said: `${String(counts[status])} ${StatusWords[status]}` }))
}

/**
 * How a widgeting's cells stand, in a sentence: each status counted, current first and blank
 * last, a status no cell has left out.
 *
 * @example statusLine({ ok: 3, errored: 1, missing: 6 })   // => '3 current • 1 errored • 6 blank'
 * @example statusLine({ ok: 0, errored: 0, missing: 12 })  // => '12 blank'
 * @example statusLine({ ok: 0, errored: 0, missing: 0 })   // => 'no questions yet'
 */
export function statusLine(counts: StatusCounts): string {
  const phrases = statusPhrases(counts)
  return phrases.length === 0 ? NoCellsLine : phrases.map((phrase) => phrase.said).join(StatusJoint)
}

/**
 * How far a widget is put to work, in a sentence: by how many widgetings, across how many
 * quizzes, in how many hunts; each count "at least" when the count stopped short.
 *
 * @example usageLine({ widgetings: 3, quizzes: 2, hunts: 1, at_least: false })  // => 'Worked by 3 widgetings across 2 quizzes, in 1 hunt.'
 * @example usageLine({ widgetings: 0, quizzes: 0, hunts: 0, at_least: false })  // => 'No widgeting works it, in any hunt.'
 */
export function usageLine({ widgetings, quizzes, hunts, at_least }: WidgetUsageT): string {
  if (widgetings === 0) { return 'No widgeting works it, in any hunt.' }
  const floor = at_least ? 'at least ' : ''
  return `Worked by ${floor}${countOf(widgetings, 'widgeting', 'widgetings')} across ${floor}${countOf(quizzes, 'quiz', 'quizzes')}, in ${floor}${countOf(hunts, 'hunt', 'hunts')}.`
}

/** `count` and the noun it counts, singular for one */
function countOf(count: number, singular: string, plural: string): string {
  return `${String(count)} ${count === 1 ? singular : plural}`
}
