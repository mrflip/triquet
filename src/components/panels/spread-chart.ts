/**
 * Where things sit on the category spread's radar: the scale its rings mark, and the wheel's
 * tiles round its rim. Lengths are in pixels of the chart as drawn; proportions are fractions of
 * its shorter side, so the drawing keeps its shape at any size.
 */
import { quantile, ticks } from 'd3-array'
import type * as Spread from '../../lib/spread'

/**
 * The radar's proportions, in fractions of the chart's shorter side: the tiles round the
 * outside, centred `tileRadius` out and `tileSide` across, small enough that no two neighbours
 * overlap even at the diagonals, and the plot inside them.
 */
export const SpreadLayout = {
  tileRadius: 0.42,
  tileSide:   0.085,
  /** The plot's radius, as a share of half the shorter side: its edge just inside the tiles' ring */
  plotShare:  0.69,
  /** The same, as Recharts takes it */
  plotRadius: '69%',
} as const

/**
 * How far past the plot's edge a value is drawn before it is held there, as a multiple of the
 * edge's count: out to the outer edge of the tiles' ring, and no further, so nothing runs off
 * the chart.
 */
export const DrawnReachMax = (SpreadLayout.tileRadius + (SpreadLayout.tileSide / 2)) / (SpreadLayout.plotShare / 2)

/** Which share of the categories' smoothed counts falls within the plot's edge: the rest reach out among the tiles */
const ScaledQuantile = 0.75

/** The plot's edge never stands for fewer questions than this, so a quiz of a handful is not blown up past its tiles */
const ScaleTopMin = 1

/** About how many rings the scale marks out from the middle */
const RingCountAbout = 4

/** The radar's scale: the count its plot's edge stands for, just inside the ring of tiles, and the counts its rings mark */
export type RadiusScaleT = { top: number, ticks: number[] }

/**
 * The radar's scale for `spread`: its edge at the 75th percentile of the categories' smoothed
 * counts, so the bulk of the smoothed line fills the plot and the busiest categories reach out
 * among the tiles, but never at fewer than one question; its rings at round counts within it.
 *
 * @example radiusScaleOf(spread)  // => { top: 2.5, ticks: [0, 0.5, 1, 1.5, 2, 2.5] }, when the smoothed counts' 75th percentile is 2.5
 * @example radiusScaleOf(spread)  // => { top: 1, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] }, for a quiz of a few questions
 */
export function radiusScaleOf(spread: Spread.SpreadT): RadiusScaleT {
  const typical = quantile(spread.points, ScaledQuantile, ({ smoothed }) => smoothed) ?? 0
  const top = Math.max(typical, ScaleTopMin)
  return { top, ticks: ticks(0, top, RingCountAbout) }
}

/**
 * `value` as the radar draws it on `scale`: as it is, out to the outer edge of the tiles' ring,
 * and held there past it.
 *
 * @example drawnOf(1, { top: 2, ticks }) // => 1
 * @example drawnOf(10, { top: 2, ticks })  // => 2.68, the outer edge of the tiles
 */
export function drawnOf(value: number, scale: RadiusScaleT): number {
  return Math.min(value, scale.top * DrawnReachMax)
}

/**
 * Whether `value` is past where the radar can draw it on `scale`, and is held at the edge of the tiles.
 *
 * @example isOffScale(10, { top: 2, ticks })  // => true
 */
export function isOffScale(value: number, scale: RadiusScaleT): boolean {
  return value > scale.top * DrawnReachMax
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
