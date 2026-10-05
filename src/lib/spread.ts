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
 */
import * as Wheel from './wheel'
import type { CategoryLabel } from '../models/category'
import type { EstimatesT } from '../models/estimate'

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
}

/** A quiz's spread: one point per category in the total order, and how many questions came into it */
export type SpreadT = {
  /** Every category, in the total order: clockwise round the wheel from the top */
  points:        SpreadPointT[]
  /** The questions that name a category, and so count in the points */
  placedCount:   number
  /** The questions whose only estimate is of no category in particular, which count in neither */
  unplacedCount: number
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
 * @example spreadOf(defaultOrder, [[{ category: 'art', difficulty: 'easy' }]]).points[8]  // => { category: 'art', count: 1, smoothed: 0.5 }
 * @example spreadOf(defaultOrder, [[{ category: null, difficulty: 'medium' }]]).unplacedCount  // => 1
 */
export function spreadOf(order: readonly CategoryLabel[], questionEstimates: Iterable<EstimatesT>): SpreadT {
  const shareLists = [...questionEstimates].map((estimates) => sharesOf(estimates))
  const shares = shareLists.flat()
  const counts = tallied(shares)
  const smootheds = tallied(shares.flatMap((share) => smoothedOf(order, share)))
  return {
    points:        order.map((category) => ({ category, count: counts.get(category) ?? 0, smoothed: smootheds.get(category) ?? 0 })),
    placedCount:   shareLists.filter((list) => list.length > 0).length,
    unplacedCount: shareLists.filter((list) => list.length === 0).length,
  }
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
