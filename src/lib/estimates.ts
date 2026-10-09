/**
 * A question's category estimates as a quiz works them: read off the cell of a category-estimate
 * entry, and what they come to for Masie, Artie and Poppy against the hunt's total order.
 *
 * A cell nobody has filled in is taken to draw on no category in particular, at medium, as a
 * question whose every estimate is blank is: so every question of the quiz has estimates, and the
 * personas a chance at it. The parts of such a widgeted (`PartVals`) are the estimates themselves
 * and those chances; a formula reads them on the widgeted, as `qn.<label>.masie`, and a column
 * shows one by the formula naming it, `$.masie`.
 */
import { Estimate, EstimateValidators, type EstimatesT } from '../models/estimate'
import { Category, type CategoryLabel } from '../models/category'
import type { WidgetT } from '../models/widget'
import { Widgeted, type WidgetedT } from '../models/widgeted'
import type { WidgetingT } from '../models/widgeting'
import { PersonaLabelVals, PersonaTitles } from '../models/persona'
import type { QuizRun } from './formulary/runner'
import * as Personas from './personas'

/** Everything a question's estimates come to: the estimates, each persona's chance at the question, and the three's average */
export type EstimatePartsT = { estimates: EstimatesT } & Personas.PersonaChancesT

/**
 * The parts of a category-estimate entry's widgeted (`EstimatePartsT`), each a key a formula
 * reads on it: its list of estimates, each persona's chance at the question, and the three's
 * average. No widgeting may take one as its label.
 */
export const PartVals = ['estimates', ...PersonaLabelVals, 'average'] as const satisfies readonly (keyof EstimatePartsT)[]
export type Part = typeof PartVals[number]

/** The header a column showing one part goes by unless retitled */
export const PartTitles: Readonly<Record<Part, string>> = {
  estimates: 'Estimates',
  ...PersonaTitles,
  average:   'Average',
}

/**
 * The formula that picks one part out of a category-estimate entry's widgeted: what a column
 * showing that part says.
 *
 * @example partFormulaOf('masie')  // => '$.masie'
 */
export function partFormulaOf(part: Part): string {
  return `$.${part}`
}

/**
 * The part of a category-estimate entry's widgeted `formula` picks, when it does nothing else;
 * null for any other formula, or none.
 *
 * @example partOf('$.average')        // => 'average'
 * @example partOf('$.average * 100')  // => null
 */
export function partOf(formula: string | null | undefined): Part | null {
  return PartVals.find((part) => formula === partFormulaOf(part)) ?? null
}

/** Every question's estimates under a quiz's category-estimate widgeting */
export type QuizEstimatesT = {
  /** The widgeting they are typed into: the quiz's first category-estimate entry, in run order */
  widgeting: WidgetingT
  /** Each question's estimates, by the question's id, in the quiz's order */
  estimates: ReadonlyMap<string, EstimatesT>
}

/**
 * Whether `widget` is a category-estimate entry: one whose cells take a question's estimates, and
 * whose widgetings offer the parts a column can show.
 *
 * @example isEstimating({ formulary: 'entry', config: { entry_kind: 'estimates' }, ... })  // => true
 * @example isEstimating({ formulary: 'entry', config: { entry_kind: 'number' }, ... })     // => false
 * @example isEstimating(null)                                                              // => false, a widget gone from the library
 */
export function isEstimating(widget: Pick<WidgetT, 'formulary' | 'config'> | null): boolean {
  return widget !== null && 'entry_kind' in widget.config && widget.config.entry_kind === 'estimates'
}

/**
 * The estimates one cell of a category-estimate entry holds, as stored, an estimate of no
 * category in particular included; for a cell that holds none, the lone neutral estimate at
 * medium, which is what a question nobody has placed is taken to draw on.
 *
 * @param widgeted - What the cell came to.
 * @returns At least one estimate.
 *
 * @example estimatesOf(Widgeted.ok([{ category: 'tv', difficulty: 'hard' }]))  // => [{ category: 'tv', difficulty: 'hard' }]
 * @example estimatesOf(Widgeted.missing)                                        // => [{ category: null, difficulty: 'medium' }]
 */
export function estimatesOf(widgeted: WidgetedT): EstimatesT {
  if (widgeted.status !== 'ok') { return [Estimate.neutral()] }
  const read = EstimateValidators.estimates.safeParse(widgeted.value)
  return read.success ? read.data : [Estimate.neutral()]
}

/**
 * What one cell of a category-estimate entry comes to: its estimates, and each persona's chance
 * at the question and their average, read against the hunt's total order. Null for a cell that
 * failed, which has nothing to come to.
 *
 * @param order - The hunt's total order (`Wheel.orderOf`).
 * @param widgeted - What the cell came to.
 * @returns The parts, or null.
 *
 * @example partsOf(defaultOrder, Widgeted.missing)  // => { estimates: [{ category: null, difficulty: 'medium' }], masie: 0.525, artie: 0.525, poppy: 0.525, average: 0.525 }
 */
export function partsOf(order: readonly CategoryLabel[], widgeted: WidgetedT): EstimatePartsT | null {
  if (widgeted.status === 'errored') { return null }
  const estimates = estimatesOf(widgeted)
  return { estimates, ...Personas.chancesOf(order, estimates) }
}

/**
 * Every question's estimates under the quiz's first category-estimate widgeting in run order,
 * read straight off the run rather than through any column: what a view of the quiz's spread of
 * categories reads. Null when the quiz works no such widgeting.
 *
 * @param run - The quiz, run.
 * @returns The widgeting, and each question's estimates by its id.
 *
 * @example quizEstimatesOf(run)?.estimates.get(question._id)  // => [{ category: 'art', difficulty: 'easy' }]
 */
export function quizEstimatesOf(run: QuizRun): QuizEstimatesT | null {
  const step = run.steps.find((each) => isEstimating(each.widget))
  if (! step) { return null }
  const cells = run.widgeteds.get(step.widgeting.label)
  const estimates = new Map(run.frame.question_ids.map((question_id) => [question_id, estimatesOf(cells?.get(question_id) ?? Widgeted.missing)]))
  return { widgeting: step.widgeting, estimates }
}

/**
 * A question's estimates in words, as a cell shows them: each category's title and how hard the
 * question is there, in the order they were typed.
 *
 * @example textOf([{ category: 'tv', difficulty: 'hard' }, { category: 'art', difficulty: 'medium' }])  // => 'TV (hard), Art (medium)'
 * @example textOf([{ category: null, difficulty: 'easy' }])                                             // => 'No category in particular (easy)'
 */
export function textOf(estimates: EstimatesT): string {
  return estimates.map(({ category, difficulty }) => `${category === null ? NeutralWords : Category.titleOf(category)} (${difficulty})`).join(', ')
}

/**
 * A chance, 0 to 1, as a whole percentage.
 *
 * @example chanceTextOf(0.525)  // => '53%'
 * @example chanceTextOf(1)      // => '100%'
 */
export function chanceTextOf(chance: number): string {
  return `${String(Math.round(chance * 100))}%`
}

/** How an estimate of no category in particular is put in words */
const NeutralWords = 'No category in particular'
