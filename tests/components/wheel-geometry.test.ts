import { describe, expect, it } from 'vitest'
import { poolHeightOf, poolSpotOf, spotOf, WheelGeometry } from '../../src/components/wheel-geometry'

describe("spotOf", () => {
  const SpotCases: [[number, number], { xx: number, yy: number }, string][] = [
    [[0, 33],  { xx: 50, yy: 17 }, 'the first slot sits at the top'],
    [[6, 33],  { xx: 83, yy: 50 }, 'a quarter of the way round sits at the right'],
    [[12, 33], { xx: 50, yy: 83 }, 'half way round sits at the bottom'],
    [[18, 33], { xx: 17, yy: 50 }, 'three quarters of the way round sits at the left'],
    [[24, 33], { xx: 50, yy: 17 }, 'a slot past the last comes round to the top'],
    [[0, 0],   { xx: 50, yy: 50 }, 'no distance out is the centre'],
  ]
  for (const [[slotIdx, radius], expected, describes] of SpotCases) {
    it(describes, () => {
      expect(spotOf(slotIdx, radius)).to.deep.eq(expected)
    })
  }

  it("keeps whatever sits outside the ring clear of the tiles, and inside the square", () => {
    const { ringRadius, tileSide, outsideRadius } = WheelGeometry
    expect(outsideRadius - ringRadius).to.be.above(tileSide)
    expect(outsideRadius).to.be.below(50)
  })
})

describe("poolSpotOf", () => {
  it("centres a lone tile beneath the ring", () => {
    expect(poolSpotOf(0, 1)).to.deep.eq({ xx: 50, yy: 110.5 })
  })

  it("centres a row, a pitch apart", () => {
    expect([poolSpotOf(0, 2).xx, poolSpotOf(1, 2).xx]).to.deep.eq([45, 55])
  })

  it("starts a new row, centred on its own, once a row is full", () => {
    const { poolPerRow, poolPitch } = WheelGeometry
    const second = poolSpotOf(poolPerRow, poolPerRow + 1)
    expect(second).to.deep.eq({ xx: 50, yy: poolSpotOf(0, poolPerRow + 1).yy + poolPitch })
  })
})

describe("poolHeightOf", () => {
  it("holds a row even when the pool is empty", () => {
    expect(poolHeightOf(0)).to.eq(poolHeightOf(1))
    expect(poolHeightOf(0)).to.eq(15.5)
  })

  it("grows a row at a time", () => {
    expect(poolHeightOf(10)).to.eq(25.5)
    expect(poolHeightOf(24)).to.eq(35.5)
  })

  it("reaches below the pool's last tile", () => {
    const lowest = poolSpotOf(23, 24).yy + (WheelGeometry.tileSide / 2)
    expect(100 + WheelGeometry.poolGap + poolHeightOf(24)).to.be.above(lowest)
  })
})
