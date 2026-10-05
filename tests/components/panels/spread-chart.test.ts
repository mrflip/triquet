import { describe, expect, it } from 'vitest'
import { radiusTicksOf, SpreadLayout, tileOf } from '../../../src/components/panels/spread-chart'
import * as Spread from '../../../src/lib/spread'
import * as Wheel from '../../../src/lib/wheel'
import { WheelSlotCount, type CategoryLabel } from '../../../src/models/category'

const DefaultOrder = Wheel.orderOf(Wheel.defaultWheel())

/** A spread whose largest count is `largest`, in Art */
function spreadPeakingAt(largest: number): Spread.SpreadT {
  const points = DefaultOrder.map((category: CategoryLabel) => ({ category, count: category === 'art' ? largest : 0, smoothed: 0 }))
  return { points, placedCount: Math.ceil(largest), unplacedCount: 0 }
}

describe("radiusTicksOf", () => {
  const RadiusTicksCases: [number, number[], string][] = [
    // regular usage:
    [1.5,  [0, 1, 2],          'a fractional peak rounds up to the next whole question'],
    [4,    [0, 1, 2, 3, 4],    'up to four questions, a ring for each'],
    [10.5, [0, 3, 6, 9, 12],   'past four, the rings step by whole questions so there are four at most'],
    [8,    [0, 2, 4, 6, 8],    'a peak that falls on a ring ends there'],
    // trivial cases:
    [0,    [0, 1],             'an empty spread still marks one ring, so the chart has a scale'],
    [0.25, [0, 1],             'a peak under one question marks one ring'],
  ]
  for (const [largest, expected, describes] of RadiusTicksCases) {
    it(describes, () => {
      expect(radiusTicksOf(spreadPeakingAt(largest))).to.deep.eq(expected)
    })
  }
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
