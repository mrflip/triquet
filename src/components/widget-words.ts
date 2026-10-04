import type { WidgetUsageT } from '../lib/rows'
import type { EntryKind, Formularykind } from '../models/widget'

/** How each formulary is spoken of on screen: one of its widgets, several, and what one does */
export const FormularyWords: Readonly<Record<Formularykind, { noun: string, group: string, gist: string }>> = {
  jsonata: { noun: 'formula', group: 'Formulas', gist: 'A formula: a JSONata expression, worked out for every question as it changes' },
  aibot:   { noun: 'prompt',  group: 'Prompts',  gist: 'A prompt: put to a model for one question when you ask from its cell' },
  entry:   { noun: 'entry',   group: 'Entries',  gist: 'An entry: typed into its cells by hand, one value per question' },
}

/** How each kind of entry is spoken of on screen: what its cells take */
export const EntryKindWords: Readonly<Record<EntryKind, string>> = {
  text:      'Text: a note, markdown welcome',
  number:    'A number',
  labelish:  'A label: lowercase letters, digits and single underscores',
  titleish:  'A title: one line',
  estimates: "Category estimates: the subject categories a question draws on, each at a difficulty, and Masie, Artie and Poppy's chances at it",
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
