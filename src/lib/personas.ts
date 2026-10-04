/**
 * The category personas' chances: how likely Masie, Artie and Poppy are to get a question, from
 * what it draws on and how the hunt has arranged its wheel.
 *
 * A persona does best on a category in their slot or either side of it, worst on one in the
 * opposite slot or either side of that, and in between falls off evenly with ring distance. A
 * category is found by where the **total order** puts it, so rearranging the wheel changes what
 * each persona knows. A question of several categories is got if any of them gets it, each
 * independently of the rest. Pure, and cheap enough to run for every cell on every render.
 */
import _ from 'es-toolkit/compat'
import type { CategoryLabel } from '../models/category'
import type { EstimateT } from '../models/estimate'
import { Persona, PersonaChanceBounds, type PersonaLabel } from '../models/persona'
import * as Wheel from './wheel'

/** Each persona's chance at one question, and the three's average */
export type PersonaChancesT = Record<PersonaLabel, number> & { average: number }

/** Where a question of no category in particular sits between a persona's best and worst: halfway, as if a quarter turn away */
const NeutralRemoteness = 0.5

/** The ring distance within which a persona does their best: their own slot and either side */
const BestWithin = 1
/** The ring distance from which on a persona does their worst: the opposite slot and either side */
const WorstFrom = 11

/**
 * How likely `personalabel` is to get a question of one estimate, 0 to 1.
 *
 * @param personalabel - Who is answering.
 * @param order - The hunt's total order (`Wheel.orderOf`), never the holed wheel.
 * @param estimate - The category the question draws on, or null for none in particular, and how hard it is there.
 * @returns The chance: the persona's best for the difficulty within a slot of their own, their worst within a slot of the opposite one, evenly between; halfway for a null category.
 *
 * @example chanceOf('masie', defaultOrder, { category: 'math_econ', difficulty: 'hard' })  // => 0.6
 * @example chanceOf('masie', defaultOrder, { category: 'theater', difficulty: 'easy' })    // => 0.6, opposite
 * @example chanceOf('artie', defaultOrder, { category: null, difficulty: 'hard' })        // => 0.3, halfway
 */
export function chanceOf(personalabel: PersonaLabel, order: readonly CategoryLabel[], estimate: EstimateT): number {
  const { best, worst } = PersonaChanceBounds[estimate.difficulty]
  return best + (remotenessOf(personalabel, order, estimate.category) * (worst - best))
}

/**
 * How likely `personalabel` is to get a question that draws on every one of `estimates`: got if
 * any one of them gets it, each independently of the rest, so the chance of missing is the
 * product of missing each.
 *
 * @param personalabel - Who is answering.
 * @param order - The hunt's total order (`Wheel.orderOf`).
 * @param estimates - What the question draws on; none at all is a question nobody can get.
 * @returns The chance, 0 to 1.
 *
 * @example chanceOfAll('masie', defaultOrder, [{ category: 'math_econ', difficulty: 'hard' }])  // => 0.6
 * @example
 *   chanceOfAll('masie', defaultOrder, [{ category: 'math_econ', difficulty: 'hard' }, { category: 'gen_sci', difficulty: 'hard' }])
 *   // => 0.84, as 1 - (0.4 * 0.4)
 * @example chanceOfAll('masie', defaultOrder, [])                                               // => 0
 */
export function chanceOfAll(personalabel: PersonaLabel, order: readonly CategoryLabel[], estimates: readonly EstimateT[]): number {
  const missing = estimates.reduce((acc, estimate) => acc * (1 - chanceOf(personalabel, order, estimate)), 1)
  return 1 - missing
}

/**
 * The three personas' chances at a question of `estimates`, each as `chanceOfAll` has it, and
 * their average: everything a question's estimates come to, in one go.
 *
 * @example chancesOf(defaultOrder, [{ category: null, difficulty: 'medium' }])  // => { masie: 0.525, artie: 0.525, poppy: 0.525, average: 0.525 }
 */
export function chancesOf(order: readonly CategoryLabel[], estimates: readonly EstimateT[]): PersonaChancesT {
  const masie = chanceOfAll('masie', order, estimates)
  const artie = chanceOfAll('artie', order, estimates)
  const poppy = chanceOfAll('poppy', order, estimates)
  return { masie, artie, poppy, average: (masie + artie + poppy) / 3 }
}

/**
 * The three personas' average chance at a question of `estimates`.
 *
 * @example averageChanceOf(defaultOrder, [{ category: 'math_econ', difficulty: 'easy' }])  // => (0.9 + 0.69 + 0.69) / 3: Artie and Poppy are each eight slots away
 */
export function averageChanceOf(order: readonly CategoryLabel[], estimates: readonly EstimateT[]): number {
  return chancesOf(order, estimates).average
}

/**
 * The categories `personalabel` knows best: those the total order puts in their slot and either
 * side of it, counter-clockwise first.
 *
 * @example strongestOf('masie', defaultOrder)  // => ['physics_eng', 'math_econ', 'gen_sci']
 */
export function strongestOf(personalabel: PersonaLabel, order: readonly CategoryLabel[]): CategoryLabel[] {
  return categoriesAround(order, Persona.slotIdxOf(personalabel))
}

/**
 * The categories `personalabel` knows least: those the total order puts in the slot opposite
 * theirs and either side of it, counter-clockwise first.
 *
 * @example weakestOf('masie', defaultOrder)  // => ['classic_film', 'theater', 'recent_lit']
 */
export function weakestOf(personalabel: PersonaLabel, order: readonly CategoryLabel[]): CategoryLabel[] {
  return categoriesAround(order, Persona.slotIdxOf(personalabel) + (order.length / 2))
}

/** How far `category` sits from `personalabel`'s best towards their worst, 0 to 1; halfway for no category in particular */
function remotenessOf(personalabel: PersonaLabel, order: readonly CategoryLabel[], category: CategoryLabel | null): number {
  if (category === null) { return NeutralRemoteness }
  const distance = Wheel.ringDistance(Persona.slotIdxOf(personalabel), order.indexOf(category))
  return _.clamp((distance - BestWithin) / (WorstFrom - BestWithin), 0, 1)
}

/** The categories `order` puts in the slot `slotIdx` and either side of it */
function categoriesAround(order: readonly CategoryLabel[], slotIdx: number): CategoryLabel[] {
  return Wheel.around(slotIdx, 1).flatMap((idx) => order[idx] ?? [])
}
