import { describe, expect, it } from 'vitest'
import { DrawnReachMax, drawnOf, isOffScale, radiusScaleOf, SpreadLayout, tileOf } from '../../../src/components/panels/spread-chart'
import * as Spread from '../../../src/lib/spread'
import * as Wheel from '../../../src/lib/wheel'
import { WheelSlotCount, type CategoryLabel } from '../../../src/models/category'

const DefaultOrder = Wheel.orderOf(Wheel.defaultWheel())

/** A spread whose categories' smoothed counts are `smootheds`, the rest of the categories at nothing */
function spreadSmoothedAs(smootheds: readonly number[]): Spread.SpreadT {
  const points = DefaultOrder.map((category: CategoryLabel, idx) => ({ category, count: 0, smoothed: smootheds[idx] ?? 0, chances: null }))
  return { points, placedCount: 0, unplacedCount: 0, chances: null }
}

/** `count` categories alike at `smoothed` */
function evenly(count: number, smoothed: number): number[] {
  return Array.from({ length: count }, () => smoothed)
}

describe("radiusScaleOf", () => {
  it("puts the plot's edge at the 75th percentile of the smoothed counts", () => {
    // Eighteen categories at 1 and six at 4: three in four are at 1 or less, so the edge sits between.
    const scale = radiusScaleOf(spreadSmoothedAs([...evenly(18, 1), ...evenly(6, 4)]))
    expect(scale.top).to.be.closeTo(1.75, 1e-12)
  })
  it("marks round counts within the edge", () => {
    const fewer = spreadSmoothedAs(evenly(24, 2.5))
    const more = spreadSmoothedAs(evenly(24, 10))
    expect(radiusScaleOf(fewer).ticks).to.deep.eq([0, 0.5, 1, 1.5, 2, 2.5])
    expect(radiusScaleOf(more).ticks).to.deep.eq([0, 2, 4, 6, 8, 10])
  })
  it("never puts the edge at fewer than one question, so a handful of questions is not blown up", () => {
    const scale = radiusScaleOf(spreadSmoothedAs([0.5, 0.16, 0.09]))
    expect(scale.top).to.eq(1)
    expect(scale.ticks).to.deep.eq([0, 0.2, 0.4, 0.6, 0.8, 1])
  })
  it("gives an empty spread a scale of one question", () => {
    expect(radiusScaleOf(spreadSmoothedAs([])).top).to.eq(1)
  })
})

describe("drawnOf and isOffScale", () => {
  const Scale = { top: 2, ticks: [0, 1, 2] }
  it("reaches to the outer edge of the tiles' ring, past the plot's edge", () => {
    expect(DrawnReachMax).to.be.closeTo((SpreadLayout.tileRadius + (SpreadLayout.tileSide / 2)) / (SpreadLayout.plotShare / 2), 1e-12)
    expect(DrawnReachMax).to.be.above(1)
  })
  it("draws a value within reach as it is", () => {
    expect(drawnOf(1, Scale)).to.eq(1)
    expect(drawnOf(2.5, Scale)).to.eq(2.5)
    expect(isOffScale(2.5, Scale)).to.be.false
  })
  it("holds a value past the tiles at their edge, and says it is off the scale", () => {
    expect(drawnOf(10, Scale)).to.be.closeTo(2.68, 0.01)
    expect(isOffScale(10, Scale)).to.be.true
  })
})

describe("tileOf", () => {
  const Square = { x: 0, y: 0, width: 400, height: 400 }

  it("puts the top tile straight above the middle", () => {
    expect(tileOf(90, Square)).to.deep.eq({ xx: 200, yy: 32, side: 34, fontSize: 8 })
  })
  it("goes by the plot's shorter side, centred in it, wherever the plot sits", () => {
    const tile = tileOf(0, { x: 10, y: 20, width: 800, height: 400 })
    expect([tile.xx, tile.yy, tile.side]).to.deep.eq([410 + 168, 220, 34])
  })
  it("grows the title with the tile, to no more than 13px", () => {
    expect(tileOf(90, { x: 0, y: 0, width: 600, height: 600 }).fontSize).to.eq(10.2)
    expect(tileOf(90, { x: 0, y: 0, width: 2000, height: 2000 }).fontSize).to.eq(13)
  })
  it("keeps every pair of neighbouring tiles from overlapping, all the way round", () => {
    const angles = Array.from({ length: WheelSlotCount }, (_unused, ii) => 90 - (ii * 360 / WheelSlotCount))
    const tiles = angles.map((angle) => tileOf(angle, Square))
    for (const [ii, tile] of tiles.entries()) {
      const next = tiles[(ii + 1) % tiles.length] ?? tile
      expect(Math.max(Math.abs(next.xx - tile.xx), Math.abs(next.yy - tile.yy))).to.be.at.least(tile.side)
    }
  })
  it("keeps the tiles inside the plot", () => {
    const reach = (SpreadLayout.tileRadius * 400) + (Math.SQRT2 * SpreadLayout.tileSide * 400 / 2)
    expect(reach).to.be.at.most(200)
  })
})
