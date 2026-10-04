/**
 * Where things sit on the drawing of a category wheel. Every length is in hundredths of the
 * wheel's width, measured from its top left corner, so the drawing scales with the box it is in:
 * the ring of slots in a square, and the pool beneath it.
 */
import { WheelSlotCount } from '../models/category'

/**
 * The wheel's proportions. The ring of tiles sits well inside its square, leaving room round it
 * for what sits outside a slot.
 */
export const WheelGeometry = {
  /** From the centre to each tile's centre */
  ringRadius:    33,
  /** From the centre to the edge of the ground the tiles sit on */
  groundRadius:  39,
  /** From the centre to the centre of whatever sits outside the ring at a slot */
  outsideRadius: 45.5,
  /** A tile's side */
  tileSide:      8.2,
  /** How many pool tiles fit in a row */
  poolPerRow:    9,
  /** From one pool tile's centre to the next */
  poolPitch:     10,
  /** Above the pool's first row, where its name goes */
  poolHead:      4.5,
  /** Below the pool's last row */
  poolFoot:      1,
  /** Between the ring's square and the pool */
  poolGap:       1,
} as const

/** A point on the wheel, in hundredths of its width from its top left corner */
export type Spot = { xx: number, yy: number }

/**
 * The spot `radius` out from the centre in the direction of the slot `slotIdx`: clockwise from
 * the top, a slot every fifteen degrees.
 *
 * @example spotOf(0, 33)  // => { xx: 50, yy: 17 }
 * @example spotOf(6, 33)  // => { xx: 83, yy: 50 }
 */
export function spotOf(slotIdx: number, radius: number): Spot {
  const angle = (2 * Math.PI * slotIdx) / WheelSlotCount
  return { xx: round(50 + (radius * Math.sin(angle))), yy: round(50 - (radius * Math.cos(angle))) }
}

/**
 * Where the pool's tile `rank` sits, of `count` in the pool: in rows beneath the ring's square,
 * each row centred.
 *
 * @example poolSpotOf(0, 1)  // => { xx: 50, yy: 110.5 }
 * @example poolSpotOf(1, 2).xx  // => 55
 */
export function poolSpotOf(rank: number, count: number): Spot {
  const { poolPerRow, poolPitch, poolHead, poolGap } = WheelGeometry
  const row = Math.floor(rank / poolPerRow)
  const inRow = Math.min(poolPerRow, count - (row * poolPerRow))
  const col = rank % poolPerRow
  return { xx: round(50 + ((col - ((inRow - 1) / 2)) * poolPitch)), yy: round(100 + poolGap + poolHead + ((row + 0.5) * poolPitch)) }
}

/**
 * How tall the pool is for `count` tiles: room for its name, and a row at least.
 *
 * @example poolHeightOf(0)  // => 15.5
 * @example poolHeightOf(10)  // => 25.5
 */
export function poolHeightOf(count: number): number {
  const { poolPerRow, poolPitch, poolHead, poolFoot } = WheelGeometry
  return poolHead + (Math.max(1, Math.ceil(count / poolPerRow)) * poolPitch) + poolFoot
}

/** `num` to two places, so a spot prints tidily */
function round(num: number): number {
  return Math.round(num * 100) / 100
}
