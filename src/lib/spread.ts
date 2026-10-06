/**
 * A quiz's spread round the wheel: how many of its questions draw on each category, counted
 * straight and smoothed over each category's neighbours, so the gaps a player might fall into
 * show beside the subjects already crowded.
 *
 * A question counts once in all, split evenly across the categories its estimates name: one
 * that names Art and TV is half a question of each. Smoothed, each of those shares is spread
 * round the ring by `SmoothingWeights`, half to the category itself and the rest to its two
 * neighbours either side, so the smoothed spread adds up to the same number of questions. A
 * question whose only estimate is of no category in particular counts in neither, and is
 * counted apart.
 *
 * Beside the counts go how many questions draw on each category at each difficulty, and the
 * personas' chances: for each category, how Masie, Artie and Poppy do at its questions, each read
 * from that category's own estimate alone, so a question's other categories lend it nothing here;
 * and, over the whole quiz, their chance at each question as the grid has it, every category of
 * the question counted.
 */
import * as Personas from './personas'
import * as Wheel from './wheel'
import type { CategoryLabel } from '../models/category'
import type { Difficulty, EstimatesT } from '../models/estimate'

/**
 * How a question's share of a category is smoothed round the ring, counter-clockwise first: to
 * the two neighbours before it, the category itself, and the two after.
 */
export const SmoothingWeights = [0.09, 0.16, 0.5, 0.16, 0.09] as const

/** How far either side of a category its smoothed share reaches */
const SmoothingReach = (SmoothingWeights.length - 1) / 2

/** One category's place in the spread: how many questions draw on it, and how many once smoothed over its neighbours */
export type SpreadPointT = {
  category: CategoryLabel
  /** Questions drawing on the category, each split evenly across the categories it names */
  count:    number
  /** The same shares, each spread over the category and its neighbours by `SmoothingWeights` */
  smoothed: number
  /** How many questions draw on the category at each difficulty: each question once, whatever else it draws on */
  tally:    Record<Difficulty, number>
  /** Each persona's chance at the category's questions, read from their estimates of this category alone, and the three's average; null where none draws on it */
  chances:  Personas.PersonaChancesT | null
}

/** A quiz's spread: one point per category in the total order, and how many questions came into it */
export type SpreadT = {
  /** Every category, in the total order: clockwise round the wheel from the top */
  points:        SpreadPointT[]
  /** The questions that name a category, and so count in the points */
  placedCount:   number
  /** The questions whose only estimate is of no category in particular, which count in neither */
  unplacedCount: number
  /** Each persona's chance over every question of the quiz, placed or not, and the three's average; null for a quiz of no questions */
  chances:       Personas.PersonaChancesT | null
}

/** A part of a question given to one category */
export type ShareT = { category: CategoryLabel, share: number }

/**
 * The spread of a quiz's questions round the wheel of `order`.
 *
 * @param order - The hunt's total order (`Wheel.orderOf`).
 * @param questionEstimates - Each question's estimates, as stored: an estimate of no category in particular included.
 * @returns A point for every category in `order`, and how many questions counted and did not.
 *
 * @example spreadOf(defaultOrder, [[{ category: 'art', difficulty: 'easy' }]]).points[8]  // => { category: 'art', count: 1, smoothed: 0.5, tally: { easy: 1, medium: 0, hard: 0 }, chances: { ... } }
 * @example spreadOf(defaultOrder, [[{ category: 'art', difficulty: 'easy' }]]).points[8].chances?.artie  // => 0.9, Art beside Artie
 * @example spreadOf(defaultOrder, [[{ category: 'art', difficulty: 'easy' }]]).points[15].chances  // => null, no question drawing on TV
 * @example spreadOf(defaultOrder, [[{ category: null, difficulty: 'medium' }]]).unplacedCount  // => 1
 */
export function spreadOf(order: readonly CategoryLabel[], questionEstimates: Iterable<EstimatesT>): SpreadT {
  const questions = [...questionEstimates].map((estimates) => ({ estimates, shares: sharesOf(estimates), chances: Personas.chancesOf(order, estimates) }))
  const shares = questions.flatMap((question) => question.shares)
  const counts = tallied(shares)
  const smootheds = tallied(shares.flatMap((share) => smoothedOf(order, share)))
  const estimatesOf = (category: CategoryLabel) => questions.flatMap(({ estimates }) => estimates.filter((estimate) => estimate.category === category))
  const pointOf = (category: CategoryLabel): SpreadPointT => {
    const held = estimatesOf(category)
    const tallyOf = (difficulty: Difficulty) => held.filter((estimate) => estimate.difficulty === difficulty).length
    return {
      category,
      count:    counts.get(category) ?? 0,
      smoothed: smootheds.get(category) ?? 0,
      tally:    { easy: tallyOf('easy'), medium: tallyOf('medium'), hard: tallyOf('hard') },
      chances:  meanChancesOf(held.map((estimate) => ({ weight: 1, chances: Personas.chancesOf(order, [estimate]) }))),
    }
  }
  return {
    points:        order.map((category) => pointOf(category)),
    placedCount:   questions.filter((question) => question.shares.length > 0).length,
    unplacedCount: questions.filter((question) => question.shares.length === 0).length,
    chances:       meanChancesOf(questions.map(({ chances }) => ({ weight: 1, chances }))),
  }
}

/**
 * The weighted mean of several questions' chances, persona by persona; null when there are none
 * to take the mean of.
 *
 * @example meanChancesOf([{ weight: 1, chances: { masie: 0.4, artie: 0.6, poppy: 0.5, average: 0.5 } }, { weight: 3, chances: { masie: 0.8, artie: 0.6, poppy: 0.5, average: 0.63 } }]).masie  // => 0.7
 * @example meanChancesOf([])  // => null
 */
export function meanChancesOf(weighted: readonly { weight: number, chances: Personas.PersonaChancesT }[]): Personas.PersonaChancesT | null {
  const total = weighted.reduce((sum, { weight }) => sum + weight, 0)
  if (total === 0) { return null }
  const meanOf = (key: keyof Personas.PersonaChancesT) => weighted.reduce((sum, { weight, chances }) => sum + (weight * chances[key]), 0) / total
  return { masie: meanOf('masie'), artie: meanOf('artie'), poppy: meanOf('poppy'), average: meanOf('average') }
}

/**
 * A question's one count, split evenly across the categories its estimates name; none at all
 * for a question of no category in particular.
 *
 * @example sharesOf([{ category: 'art', difficulty: 'easy' }, { category: 'tv', difficulty: 'hard' }])  // => [{ category: 'art', share: 0.5 }, { category: 'tv', share: 0.5 }]
 * @example sharesOf([{ category: null, difficulty: 'medium' }])  // => []
 */
export function sharesOf(estimates: EstimatesT): ShareT[] {
  const named = estimates.flatMap(({ category }) => (category === null ? [] : [category]))
  return named.map((category) => ({ category, share: 1 / named.length }))
}

/**
 * One share spread round the ring of `order` by `SmoothingWeights`: to its category and the
 * neighbours either side, counter-clockwise first.
 *
 * @example smoothedOf(defaultOrder, { category: 'math_econ', share: 1 }).map(({ category }) => category)  // => ['biz_tech', 'physics_eng', 'math_econ', 'gen_sci', 'chem_bio']
 */
export function smoothedOf(order: readonly CategoryLabel[], { category, share }: ShareT): ShareT[] {
  return Wheel.neighboursOf(order, category, SmoothingReach).map((neighbour, ii) => ({ category: neighbour, share: share * (SmoothingWeights[ii] ?? 0) }))
}

/** Each category's shares, summed */
function tallied(shares: readonly ShareT[]): Map<CategoryLabel, number> {
  const sums = new Map<CategoryLabel, number>()
  for (const { category, share } of shares) { sums.set(category, (sums.get(category) ?? 0) + share) }
  return sums
}
