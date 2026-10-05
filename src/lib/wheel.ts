/**
 * The wheel of subject categories: how a hunt arranges them round a ring, and what follows.
 *
 * A wheel is stored with its holes: each slot holds a category or is empty, and the categories
 * no slot holds are the pool. Everything downstream reads the **total order** instead, in which
 * each empty slot, walked from the first, takes the lowest-numbered category (by default order)
 * still in the pool. A slot is a place on the ring, so distances and neighbours wrap round it.
 */
import { CategoryLabelVals, WheelSlotCount, type CategoryLabel, type WheelT } from '../models/category'

/** Where a category can be put: a slot of the wheel, by index, or the pool */
export type WheelPlace = number | 'pool'

/**
 * The wheel nobody has rearranged: every category in its default slot, and the pool empty.
 *
 * @example defaultWheel()[0]  // => 'math_econ'
 */
export function defaultWheel(): WheelT {
  return [...CategoryLabelVals]
}

/**
 * The categories no slot of `wheel` holds, in default order.
 *
 * @example poolOf(['art', null, ...]).includes('math_econ')  // => true
 */
export function poolOf(wheel: WheelT): CategoryLabel[] {
  const placed = new Set(wheel)
  return CategoryLabelVals.filter((label) => ! placed.has(label))
}

/**
 * The total order `wheel` comes to: every slot's category, each empty slot taking the
 * lowest-numbered category left in the pool. Always every category, once each.
 *
 * @example orderOf(defaultWheel())  // => the categories in default order
 * @example orderOf([null, 'math_econ', ...])[0]  // => 'gen_sci', when the pool's lowest is gen_sci
 */
export function orderOf(wheel: WheelT): CategoryLabel[] {
  const fills = poolOf(wheel).values()
  return wheel.map((label) => label ?? fills.next().value).filter((label) => label !== undefined)
}

/**
 * `wheel` with `label` put in `onto`. Dropped on a slot another category holds, the two swap
 * places, so a category from the pool sends that occupant to the pool; dropped on an empty slot,
 * it leaves its own slot empty. Put in the pool, its slot is emptied. Putting a category where it
 * already is changes nothing.
 *
 * @param wheel - The wheel as it stands.
 * @param label - The category being moved, from its slot or from the pool.
 * @param onto - Where it goes.
 * @returns The wheel after the move; `wheel` itself when nothing moved.
 *
 * @example placed(defaultWheel(), 'math_econ', 'pool')[0]  // => null
 * @example placed(defaultWheel(), 'math_econ', 1).slice(0, 2)  // => ['gen_sci', 'math_econ']
 */
export function placed(wheel: WheelT, label: CategoryLabel, onto: WheelPlace): WheelT {
  const fromIdx = wheel.indexOf(label)
  if (onto === 'pool') {
    return fromIdx === -1 ? wheel : wheel.map((held, idx) => (idx === fromIdx ? null : held))
  }
  if (fromIdx === onto) { return wheel }
  const occupant = wheel[onto] ?? null
  return wheel.map((held, idx) => {
    if (idx === onto) { return label }
    if (idx === fromIdx) { return occupant }
    return held
  })
}

/**
 * `wheel` with `label` moved `step` slots round the ring (clockwise when positive), swapping with
 * whatever sits there. A category in the pool stays where it is.
 *
 * @example stepped(defaultWheel(), 'physics_eng', 1)[0]  // => 'physics_eng', having wrapped past the top
 */
export function stepped(wheel: WheelT, label: CategoryLabel, step: number): WheelT {
  const fromIdx = wheel.indexOf(label)
  if (fromIdx === -1) { return wheel }
  return placed(wheel, label, wrapped(fromIdx + step))
}

/**
 * The first empty slot of `wheel`, or null when every slot is filled (and so the pool is empty).
 *
 * @example firstEmptyIdxOf(defaultWheel())  // => null
 */
export function firstEmptyIdxOf(wheel: WheelT): number | null {
  const idx = wheel.indexOf(null)
  return idx === -1 ? null : idx
}

/**
 * How many slots apart two slots are, the short way round the ring: 0 for the same slot, 12 for
 * opposite ones.
 *
 * @example ringDistance(0, 23)  // => 1
 * @example ringDistance(0, 12)  // => 12
 * @example ringDistance(8, 16)  // => 8
 */
export function ringDistance(fromIdx: number, ontoIdx: number): number {
  const apart = Math.abs(wrapped(fromIdx) - wrapped(ontoIdx))
  return Math.min(apart, WheelSlotCount - apart)
}

/**
 * The slots within `reach` of the slot `idx` round the ring, counter-clockwise first: `idx`
 * itself in the middle.
 *
 * @example around(0, 2)  // => [22, 23, 0, 1, 2]
 */
export function around(idx: number, reach: number): number[] {
  return Array.from({ length: (2 * reach) + 1 }, (_unused, offset) => wrapped(idx + offset - reach))
}

/**
 * The categories within `reach` of `label` round the ring of the total order `order`,
 * counter-clockwise first: `label` itself in the middle.
 *
 * @example neighboursOf(orderOf(defaultWheel()), 'math_econ', 1)  // => ['physics_eng', 'math_econ', 'gen_sci']
 */
export function neighboursOf(order: readonly CategoryLabel[], label: CategoryLabel, reach: number): CategoryLabel[] {
  return around(order.indexOf(label), reach).map((idx) => order[idx]).filter((each) => each !== undefined)
}

/** `idx` brought round the ring into the slots there are */
function wrapped(idx: number): number {
  return ((idx % WheelSlotCount) + WheelSlotCount) % WheelSlotCount
}
