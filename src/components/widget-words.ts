import _ from 'es-toolkit/compat'
import type { EntryInForceT } from '../lib/formulary/entry'
import * as Regexes from '../lib/regexes'
import type { StatusCounts } from '../lib/formulary/runner'
import type { WidgetUsageT } from '../lib/rows'
import type { EntryKind, EnumParamsT, Formularykind, LiquidizeParamsT, NumberParamsT, TextLines, TextParamsT, TextPattern } from '../models/widget'
import { WidgetedStatusVals, type WidgetedStatus } from '../models/widgeted'

/** How each formulary is spoken of on screen: one of its widgets, several, and what one does */
export const FormularyWords: Readonly<Record<Formularykind, { noun: string, group: string, gist: string }>> = {
  jsonata: { noun: 'formula', group: 'Formulas', gist: 'A formula: a JSONata expression, worked out for every question as it changes' },
  aibot:   { noun: 'prompt',  group: 'Prompts',  gist: 'A prompt: put to a model for one question when you ask from its cell' },
  entry:   { noun: 'entry',   group: 'Entries',  gist: 'An entry: typed into its cells by hand, one value per question' },
  liquidize: { noun: 'template', group: 'Templates', gist: 'A template: Liquid filled in for every question as it changes, coming to markdown' },
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

/** How each of an entry's params is named beside its field */
export const ParamWords: Readonly<Record<string, string>> = {
  min:        'Least',
  max:        'Most',
  integer:    'Whole numbers only',
  max_length: 'Most characters',
  pattern:    'Pattern',
  regex:      'Regular expression',
  lines:      'Lines',
  options:    'Options, one per line',
}

/** How each named pattern of a text entry reads in its select */
export const TextPatternWords: Readonly<Record<TextPattern, string>> = {
  label:   'A label: lowercase letters, digits and single underscores',
  oneline: 'One line of anything',
  url:     'A web address',
}

/** How each number of lines a text entry takes reads in its select */
export const TextLinesWords: Readonly<Record<TextLines, string>> = {
  one:  'One line',
  many: 'Many lines, markdown welcome',
}

/**
 * What an entry's cells may hold by the params in force, in a sentence; empty when they say
 * nothing beyond the family.
 *
 * @example paramsGist({ family: 'number', params: { min: 1, max: 10, integer: true } })  // => 'Whole numbers from 1 to 10.'
 * @example paramsGist({ family: 'text', params: { pattern: 'url', max_length: 200 } })   // => 'A web address, at most 200 characters.'
 * @example paramsGist({ family: 'text', params: { regex: { source: '^[A-Z]{3}$', flags: '' } } })  // => 'Matching /^[A-Z]{3}$/.'
 * @example paramsGist({ family: 'enum', params: { options: ['easy', 'hard'] } })          // => 'One of: easy, hard.'
 * @example paramsGist({ family: 'text', params: {} })                                      // => ''
 */
export function paramsGist(cell: EntryInForceT): string {
  switch (cell.family) {
  case 'number': { return numberGist(cell.params) }
  case 'text':   { return textGist(cell.params) }
  case 'enum':   { return enumGist(cell.params) }
  default:       { return '' }
  }
}

/** A number entry's params in a sentence: whole or not, and its bounds */
function numberGist({ min, max, integer }: NumberParamsT): string {
  const noun = integer === true ? 'Whole numbers' : 'Numbers'
  if (min !== undefined && max !== undefined) { return `${noun} from ${String(min)} to ${String(max)}.` }
  if (min !== undefined) { return `${noun} from ${String(min)} up.` }
  if (max !== undefined) { return `${noun} up to ${String(max)}.` }
  return integer === true ? `${noun}.` : ''
}

/** A text entry's params in a sentence: its pattern or its lines, its regular expression, and its length */
function textGist({ pattern, regex, lines, max_length }: TextParamsT): string {
  const linesSaid = lines === undefined ? null : TextLinesWords[lines]
  const shape = pattern === undefined ? linesSaid : TextPatternWords[pattern]
  const matching = regex === undefined ? null : `matching ${Regexes.shown(regex)}`
  const most = max_length === undefined ? null : `at most ${String(max_length)} characters`
  const said = [shape, matching, most].filter((part) => part !== null)
  return said.length === 0 ? '' : `${_.upperFirst(said.join(', '))}.`
}

/** A choice entry's params in a sentence: its options */
function enumGist({ options = [] }: EnumParamsT): string {
  return options.length === 0 ? 'No options yet: give its widgeting some.' : `One of: ${options.join(', ')}.`
}

/**
 * Where a `liquidize` widgeting's template is read from, in a sentence.
 *
 * @example templateFromGist({ ref: 'notes' })                                // => 'Read from notes, for each question.'
 * @example templateFromGist({ ref: 'dumdum', formula: '$.value.template' })  // => 'Read from dumdum by $.value.template, for each question.'
 */
export function templateFromGist({ ref, formula }: NonNullable<LiquidizeParamsT['template_from']>): string {
  return formula === undefined ? `Read from ${ref}, for each question.` : `Read from ${ref} by ${formula}, for each question.`
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
