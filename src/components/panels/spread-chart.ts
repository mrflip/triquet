/**
 * Where things sit on the category spread's radar: the scale its rings mark, and the wheel's
 * tiles round its rim. Lengths are in pixels of the chart as drawn; proportions are fractions of
 * its shorter side, so the drawing keeps its shape at any size.
 */
import type * as Spread from '../../lib/spread'

/**
 * The radar's proportions, in fractions of the chart's shorter side: the tiles round the
 * outside, centred `tileRadius` out and `tileSide` across, small enough that no two neighbours
 * overlap even at the diagonals, and the plot inside them.
 */
export const SpreadLayout = {
  tileRadius: 0.42,
  tileSide:   0.085,
  /** The plot's radius, as Recharts takes it: a share of half the shorter side, leaving the tiles their ring */
  plotRadius: '69%',
} as const

/** How many rings the scale marks out from the middle, at most */
const RingCountMax = 4

/**
 * The counts the radar's rings mark, from the middle out: whole questions, at least one, and no
 * more than four rings, the last at or past the largest count.
 *
 * @example radiusTicksOf(spread)  // => [0, 1, 2], when no category counts more than 2 questions
 * @example radiusTicksOf(spread)  // => [0, 3, 6, 9, 12], when the largest count is 10.5
 */
export function radiusTicksOf(spread: Spread.SpreadT): number[] {
  const largest = Math.max(1, ...spread.points.map(({ count }) => count))
  const step = Math.ceil(largest / RingCountMax)
  const ringCount = Math.ceil(largest / step)
  return Array.from({ length: ringCount + 1 }, (_unused, ii) => ii * step)
}

/** A category's tile on the rim: its centre, its side, and the size of its title */
export type SpreadTileT = { xx: number, yy: number, side: number, fontSize: number }

/** The box the radar is drawn about the middle of, in pixels from the chart's top left: the chart less its margins and legend */
export type PlotBoxT = { x: number, y: number, width: number, height: number }

/**
 * The tile for the category at `angle` round a radar drawn in `plot`.
 *
 * @param angle - Degrees anticlockwise from three o'clock, as Recharts gives a tick's angle: 90 is the top.
 * @param plot - Where the radar is drawn (Recharts' `usePlotArea`).
 *
 * @example tileOf(90, { x: 0, y: 0, width: 400, height: 400 })  // => { xx: 200, yy: 32, side: 34, fontSize: 8 }, the top tile
 */
export function tileOf(angle: number, plot: PlotBoxT): SpreadTileT {
  const shorter = Math.min(plot.width, plot.height)
  const side = shorter * SpreadLayout.tileSide
  const radians = (angle * Math.PI) / 180
  return {
    xx:       round(plot.x + (plot.width / 2) + (Math.cos(radians) * shorter * SpreadLayout.tileRadius)),
    yy:       round(plot.y + (plot.height / 2) - (Math.sin(radians) * shorter * SpreadLayout.tileRadius)),
    side:     round(side),
    fontSize: round(Math.min(13, Math.max(8, side * 0.2))),
  }
}

/** `num` to two places, so a position prints tidily */
function round(num: number): number {
  return Math.round(num * 100) / 100
}
