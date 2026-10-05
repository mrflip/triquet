import { describe, expect, it } from 'vitest'
import * as Personas from '../../src/lib/personas'
import * as Wheel from '../../src/lib/wheel'
import type { CategoryLabel } from '../../src/models/category'
import { DifficultyVals, type Difficulty, type EstimateT } from '../../src/models/estimate'
import { PersonaLabelVals, type PersonaLabel } from '../../src/models/persona'

const defaultOrder = Wheel.orderOf(Wheel.defaultWheel())

/** Close enough for chances worked out in floating point */
const Near = 1e-9

/** An estimate of `category` at `difficulty` */
function est(category: CategoryLabel | null, difficulty: Difficulty = 'medium'): EstimateT {
  return { category, difficulty }
}

describe("Personas.chanceOf", () => {
  // Masie sits at slot 0, so on the default wheel a category's default index is its slot.
  const MasieCases: [CategoryLabel | null, Difficulty, number, string][] = [
    // best: their own slot and either side
    ['math_econ',    'easy',   0.9,   'their own slot, easy: their best'],
    ['math_econ',    'medium', 0.75,  'their own slot, medium: their best'],
    ['math_econ',    'hard',   0.6,   'their own slot, hard: their best'],
    ['gen_sci',      'hard',   0.6,   'the slot clockwise of theirs: still their best'],
    ['physics_eng',  'hard',   0.6,   'the slot counter-clockwise, round past the top: still their best'],
    // worst: the opposite slot and either side
    ['theater',      'easy',   0.6,   'the opposite slot, easy: their worst'],
    ['theater',      'medium', 0.3,   'the opposite slot, medium: their worst'],
    ['theater',      'hard',   0,     'the opposite slot, hard: their worst, never got'],
    ['classic_film', 'hard',   0,     'beside the opposite slot: still their worst'],
    ['recent_lit',   'medium', 0.3,   'beside the opposite slot, the other side: still their worst'],
    // between: evenly by ring distance
    ['chem_bio',     'hard',   0.54,  'two slots away: a tenth of the way to their worst'],
    ['world_hist',   'easy',   0.75,  'a quarter turn clockwise: halfway'],
    ['games',        'medium', 0.525, 'a quarter turn counter-clockwise: halfway'],
    ['language',     'hard',   0.24,  'seven slots away: six tenths of the way to their worst'],
    // no category in particular: halfway
    [null,           'easy',   0.75,  'no category, easy: halfway'],
    [null,           'medium', 0.525, 'no category, medium: halfway'],
    [null,           'hard',   0.3,   'no category, hard: halfway'],
  ]
  for (const [category, difficulty, chance, describes] of MasieCases) {
    it(`gives Masie ${String(chance)} for ${describes}`, () => {
      expect(Personas.chanceOf('masie', defaultOrder, est(category, difficulty))).to.be.closeTo(chance, Near)
    })
  }

  it("finds each persona's best beside their own slot", () => {
    expect(Personas.chanceOf('artie', defaultOrder, est('art', 'hard'))).to.be.closeTo(0.6, Near)
    expect(Personas.chanceOf('poppy', defaultOrder, est('pop_music', 'hard'))).to.be.closeTo(0.6, Near)
    expect(Personas.chanceOf('poppy', defaultOrder, est('euro_hist', 'hard'))).to.be.closeTo(0, Near)
  })

  it("answers a question of no category the same, whoever answers and however the wheel is arranged", () => {
    const rearranged = Wheel.orderOf(Wheel.placed(Wheel.defaultWheel(), 'theater', 0))
    for (const personalabel of PersonaLabelVals) {
      for (const order of [defaultOrder, rearranged]) {
        expect(Personas.chanceOf(personalabel, order, est(null, 'hard'))).to.be.closeTo(0.3, Near)
      }
    }
  })

  it("follows a category round the wheel: what sits in a persona's slot is what they know", () => {
    // Theater swapped into slot 0, Math & Econ out to slot 12.
    const swapped = Wheel.orderOf(Wheel.placed(Wheel.defaultWheel(), 'theater', 0))
    expect(Personas.chanceOf('masie', swapped, est('theater', 'hard'))).to.be.closeTo(0.6, Near)
    expect(Personas.chanceOf('masie', swapped, est('math_econ', 'hard'))).to.be.closeTo(0, Near)
  })

  it("reads an empty slot as the category the total order puts there", () => {
    // Slot 0 emptied: Math & Econ is the pool's lowest, so the total order puts it straight back.
    const holed = Wheel.placed(Wheel.defaultWheel(), 'math_econ', 'pool')
    expect(Personas.chanceOf('masie', Wheel.orderOf(holed), est('math_econ', 'hard'))).to.be.closeTo(0.6, Near)
  })

  it("never falls outside 0 to 1, nor below the worst or above the best", () => {
    for (const personalabel of PersonaLabelVals) {
      for (const difficulty of DifficultyVals) {
        for (const category of defaultOrder) {
          const chance = Personas.chanceOf(personalabel, defaultOrder, est(category, difficulty))
          expect(chance).to.be.within(0, 1)
        }
      }
    }
  })
})

describe("Personas.chanceOfAll", () => {
  it("is the one estimate's chance, for a list of one", () => {
    expect(Personas.chanceOfAll('masie', defaultOrder, [est('math_econ', 'hard')])).to.be.closeTo(0.6, Near)
  })

  it("is got if any estimate gets it, each independently", () => {
    // Missing both: 0.4 * 0.4
    expect(Personas.chanceOfAll('masie', defaultOrder, [est('math_econ', 'hard'), est('gen_sci', 'hard')])).to.be.closeTo(0.84, Near)
    // Missing all three: 0.1 * 0.25 * 1
    expect(Personas.chanceOfAll('masie', defaultOrder, [est('math_econ', 'easy'), est('physics_eng', 'medium'), est('theater', 'hard')])).to.be.closeTo(0.975, Near)
  })

  it("gains nothing from an estimate never got", () => {
    expect(Personas.chanceOfAll('masie', defaultOrder, [est('chem_bio', 'hard'), est('theater', 'hard')])).to.be.closeTo(0.54, Near)
  })

  it("is the null estimate's halfway, for a lone estimate of no category", () => {
    expect(Personas.chanceOfAll('poppy', defaultOrder, [est(null, 'medium')])).to.be.closeTo(0.525, Near)
  })

  it("is 0 for no estimate at all", () => {
    expect(Personas.chanceOfAll('masie', defaultOrder, [])).to.eq(0)
  })
})

describe("Personas.chancesOf", () => {
  it("gives each persona's chance and their average", () => {
    const chances = Personas.chancesOf(defaultOrder, [est('math_econ', 'easy')])
    // Artie and Poppy are each eight slots from Math & Econ: seven tenths of the way to their worst.
    expect(chances.masie).to.be.closeTo(0.9, Near)
    expect(chances.artie).to.be.closeTo(0.69, Near)
    expect(chances.poppy).to.be.closeTo(0.69, Near)
    expect(chances.average).to.be.closeTo((0.9 + 0.69 + 0.69) / 3, Near)
  })

  it("is halfway for all three, for a lone estimate of no category", () => {
    const chances = Personas.chancesOf(defaultOrder, [est(null)])
    for (const personalabel of [...PersonaLabelVals, 'average'] as const) {
      expect(chances[personalabel]).to.be.closeTo(0.525, Near)
    }
  })

  it("agrees with chanceOfAll for each persona", () => {
    const estimates = [est('tv', 'hard'), est('us_hist', 'easy')]
    const chances = Personas.chancesOf(defaultOrder, estimates)
    for (const personalabel of PersonaLabelVals) {
      expect(chances[personalabel]).to.eq(Personas.chanceOfAll(personalabel, defaultOrder, estimates))
    }
  })
})

describe("Personas.averageChanceOf", () => {
  it("is the three personas' average", () => {
    expect(Personas.averageChanceOf(defaultOrder, [est('math_econ', 'easy')])).to.be.closeTo((0.9 + 0.69 + 0.69) / 3, Near)
  })

  it("favours nobody on the triangle: one category from each corner is the same to all three", () => {
    const estimates = [est('math_econ', 'hard'), est('art', 'hard'), est('pop_music', 'hard')]
    const chances = Personas.chancesOf(defaultOrder, estimates)
    expect(chances.masie).to.be.closeTo(chances.artie, Near)
    expect(chances.artie).to.be.closeTo(chances.poppy, Near)
    expect(Personas.averageChanceOf(defaultOrder, estimates)).to.be.closeTo(chances.masie, Near)
  })
})

describe("Personas.strongestOf and weakestOf", () => {
  const Cases: [PersonaLabel, CategoryLabel[], CategoryLabel[]][] = [
    ['masie', ['physics_eng', 'math_econ', 'gen_sci'],  ['classic_film', 'theater', 'recent_lit']],
    ['artie', ['language', 'art', 'classical_music'],   ['food_drink', 'lifestyle', 'current_events']],
    ['poppy', ['tv', 'pop_music', 'sports'],             ['geography', 'euro_hist', 'us_hist']],
  ]
  for (const [personalabel, strongest, weakest] of Cases) {
    it(`finds what ${personalabel} knows best and least on the default wheel`, () => {
      expect(Personas.strongestOf(personalabel, defaultOrder)).to.deep.eq(strongest)
      expect(Personas.weakestOf(personalabel, defaultOrder)).to.deep.eq(weakest)
    })
  }

  it("follows the wheel's arrangement", () => {
    const swapped = Wheel.orderOf(Wheel.placed(Wheel.defaultWheel(), 'theater', 0))
    expect(Personas.strongestOf('masie', swapped)).to.deep.eq(['physics_eng', 'theater', 'gen_sci'])
    expect(Personas.weakestOf('masie', swapped)).to.deep.eq(['classic_film', 'math_econ', 'recent_lit'])
  })
})
