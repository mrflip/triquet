import { describe, expect, it } from 'vitest'
import * as Wheel from '../../src/lib/wheel'
import { CategoryLabelVals, type CategoryLabel, type WheelT } from '../../src/models/category'

/** Every slot's index */
const EverySlot = CategoryLabelVals.keys().toArray()

/** For sorting labels into a stable order to compare */
const alphabetically = (aa: string, bb: string) => aa.localeCompare(bb)

/** The default wheel with the slots `idxs` emptied */
function holed(...idxs: number[]): WheelT {
  return Wheel.defaultWheel().map((label, idx) => (idxs.includes(idx) ? null : label))
}

/** The categories by their default indexes, as the spike's addresses wrote an order */
function byIdx(...idxs: number[]): CategoryLabel[] {
  return idxs.flatMap((idx) => CategoryLabelVals[idx] ?? [])
}

// The spike's example: 0,18,4,5,…,1,20,21,19,22,3,23,2, with the slots holding 11 and 13 emptied.
const SpikeOrder = byIdx(0, 18, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 1, 20, 21, 19, 22, 3, 23, 2)
const SpikeWheel: WheelT = SpikeOrder.map((label, idx) => (idx === 9 || idx === 11 ? null : label))

describe("Wheel.defaultWheel", () => {
  it("holds every category in its default slot", () => {
    expect(Wheel.defaultWheel()).to.deep.eq([...CategoryLabelVals])
    expect(Wheel.defaultWheel()[0]).to.eq('math_econ')
  })

  it("is a fresh list each time, safe to change", () => {
    expect(Wheel.defaultWheel()).not.to.equal(Wheel.defaultWheel())
  })
})

describe("Wheel.poolOf", () => {
  it("is empty for a full wheel", () => {
    expect(Wheel.poolOf(Wheel.defaultWheel())).to.deep.eq([])
  })

  it("holds what no slot holds, in default order however it was emptied", () => {
    expect(Wheel.poolOf(SpikeWheel)).to.deep.eq(['classic_film', 'recent_lit'])
    expect(Wheel.poolOf(holed(23, 0))).to.deep.eq(['math_econ', 'physics_eng'])
  })

  it("holds every category for an empty wheel", () => {
    expect(Wheel.poolOf(holed(...EverySlot))).to.deep.eq([...CategoryLabelVals])
  })
})

describe("Wheel.orderOf", () => {
  it("is the wheel itself when no slot is empty", () => {
    expect(Wheel.orderOf(Wheel.defaultWheel())).to.deep.eq([...CategoryLabelVals])
  })

  it("fills the spike's two holes from the pool, lowest first", () => {
    expect(Wheel.orderOf(SpikeWheel)).to.deep.eq(SpikeOrder)
  })

  it("gives each empty slot the lowest-numbered category left, wherever that came from", () => {
    // chem_bio and tv in the pool; art moved into chem_bio's slot, leaving its own empty.
    const pooled = Wheel.placed(Wheel.placed(Wheel.defaultWheel(), 'tv', 'pool'), 'chem_bio', 'pool')
    const order = Wheel.orderOf(Wheel.placed(pooled, 'art', 2))
    expect(order[2]).to.eq('art')
    expect(order[8]).to.eq('chem_bio')
    expect(order[15]).to.eq('tv')
  })

  it("comes to the default order for an empty wheel", () => {
    expect(Wheel.orderOf(holed(...EverySlot))).to.deep.eq([...CategoryLabelVals])
  })

  it("always holds every category once", () => {
    for (const wheel of [SpikeWheel, holed(0, 5, 23), holed(12)]) {
      const order = Wheel.orderOf(wheel)
      expect(order.toSorted(alphabetically)).to.deep.eq([...CategoryLabelVals].toSorted(alphabetically))
    }
  })
})

describe("Wheel.placed", () => {
  const PlacedCases: [CategoryLabel, Wheel.WheelPlace, WheelT, WheelT, string][] = [
    // slot to slot:
    ['math_econ', 1,      Wheel.defaultWheel(), ['gen_sci', 'math_econ', ...CategoryLabelVals.slice(2)], 'onto a held slot: the two swap'],
    ['math_econ', 1,      holed(1),            [null, 'math_econ', ...CategoryLabelVals.slice(2)],      'onto an empty slot: its own slot is left empty'],
    ['math_econ', 23,     Wheel.defaultWheel(), ['physics_eng', ...CategoryLabelVals.slice(1, 23), 'math_econ'], 'round the ring: slots are slots, wherever they sit'],
    // to and from the pool:
    ['math_econ', 'pool', Wheel.defaultWheel(), holed(0),                                                 'into the pool: its slot is emptied'],
    ['math_econ', 3,      holed(0),            [null, 'gen_sci', 'chem_bio', 'math_econ', ...CategoryLabelVals.slice(4)], 'from the pool onto a held slot: the occupant goes to the pool'],
    ['math_econ', 3,      holed(0, 3),         [null, 'gen_sci', 'chem_bio', 'math_econ', ...CategoryLabelVals.slice(4)], 'from the pool onto an empty slot'],
  ]
  for (const [label, onto, wheel, expected, describes] of PlacedCases) {
    it(`moves a category ${describes}`, () => {
      expect(Wheel.placed(wheel, label, onto)).to.deep.eq(expected)
    })
  }

  it("sends a pool category's displaced occupant to the pool", () => {
    const wheel = Wheel.placed(holed(0), 'math_econ', 3)
    expect(Wheel.poolOf(wheel)).to.deep.eq(['geography'])
  })

  it("changes nothing, and hands back the same wheel, for a category put where it already is", () => {
    const wheel = holed(4)
    expect(Wheel.placed(wheel, 'math_econ', 0)).to.equal(wheel)
    expect(Wheel.placed(wheel, 'euro_hist', 'pool')).to.equal(wheel)
  })

  it("leaves the wheel it was handed as it was", () => {
    const wheel = Wheel.defaultWheel()
    Wheel.placed(wheel, 'art', 'pool')
    expect(wheel).to.deep.eq([...CategoryLabelVals])
  })
})

describe("Wheel.stepped", () => {
  it("moves a category one slot clockwise, swapping with its neighbour", () => {
    expect(Wheel.stepped(Wheel.defaultWheel(), 'math_econ', 1).slice(0, 2)).to.deep.eq(['gen_sci', 'math_econ'])
  })

  it("moves counter-clockwise for a negative step", () => {
    expect(Wheel.stepped(Wheel.defaultWheel(), 'gen_sci', -1).slice(0, 2)).to.deep.eq(['gen_sci', 'math_econ'])
  })

  it("wraps past the top in either direction", () => {
    expect(Wheel.stepped(Wheel.defaultWheel(), 'physics_eng', 1)[0]).to.eq('physics_eng')
    expect(Wheel.stepped(Wheel.defaultWheel(), 'math_econ', -1)[23]).to.eq('math_econ')
  })

  it("steps into an empty slot, leaving its own empty", () => {
    expect(Wheel.stepped(holed(1), 'math_econ', 1).slice(0, 2)).to.deep.eq([null, 'math_econ'])
  })

  it("leaves a category in the pool where it is", () => {
    const wheel = holed(0)
    expect(Wheel.stepped(wheel, 'math_econ', 1)).to.equal(wheel)
  })
})

describe("Wheel.firstEmptyIdxOf", () => {
  it("finds the first empty slot from the top", () => {
    expect(Wheel.firstEmptyIdxOf(holed(20, 7))).to.eq(7)
    expect(Wheel.firstEmptyIdxOf(SpikeWheel)).to.eq(9)
  })

  it("is null when every slot is held", () => {
    expect(Wheel.firstEmptyIdxOf(Wheel.defaultWheel())).to.be.null
  })
})

describe("Wheel.ringDistance", () => {
  const DistanceCases: [[number, number], number, string][] = [
    [[0, 0],   0,  'the same slot'],
    [[0, 1],   1,  'neighbours'],
    [[0, 23],  1,  'neighbours across the top'],
    [[23, 0],  1,  'either way round'],
    [[0, 12],  12, 'opposite slots: as far as two can be'],
    [[6, 18],  12, 'the spike\'s diameter'],
    [[0, 8],   8,  'two corners of a triangle'],
    [[8, 16],  8,  'two corners of a triangle, neither at the top'],
    [[3, 20],  7,  'the short way round, not the long'],
    [[-1, 25], 2,  'slots past either end, brought round the ring'],
  ]
  for (const [[fromIdx, ontoIdx], expected, describes] of DistanceCases) {
    it(`is ${String(expected)} for ${describes}`, () => {
      expect(Wheel.ringDistance(fromIdx, ontoIdx)).to.eq(expected)
    })
  }
})

describe("Wheel.around", () => {
  it("lists the slots within reach, counter-clockwise first, wrapping at the top", () => {
    expect(Wheel.around(0, 2)).to.deep.eq([22, 23, 0, 1, 2])
    expect(Wheel.around(23, 1)).to.deep.eq([22, 23, 0])
  })

  it("is the slot alone with no reach", () => {
    expect(Wheel.around(5, 0)).to.deep.eq([5])
  })
})

describe("Wheel.neighboursOf", () => {
  it("names the categories round a category in the total order", () => {
    const order = Wheel.orderOf(Wheel.defaultWheel())
    expect(Wheel.neighboursOf(order, 'math_econ', 1)).to.deep.eq(['physics_eng', 'math_econ', 'gen_sci'])
  })

  it("follows the total order, so a hole's filling is a neighbour like any other", () => {
    expect(Wheel.neighboursOf(Wheel.orderOf(SpikeWheel), 'classic_lit', 2)).to.deep.eq(['art', 'classical_music', 'classic_lit', 'classic_film', 'theater'])
  })
})
