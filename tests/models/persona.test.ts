import { describe, expect, it } from 'vitest'
import { CategoryLabelVals } from '../../src/models/category'
import { DifficultyVals } from '../../src/models/estimate'
import { Persona, PersonaChanceBounds, PersonaLabelVals, PersonaSlots, PersonaTitles } from '../../src/models/persona'

describe("the personas", () => {
  it("are three, each titled and each at a slot", () => {
    expect(PersonaLabelVals).to.deep.eq(['masie', 'artie', 'poppy'])
    expect(Object.keys(PersonaTitles)).to.deep.eq([...PersonaLabelVals])
    expect(Object.keys(PersonaSlots)).to.deep.eq([...PersonaLabelVals])
  })

  it("sit at the triangle's corners: beside Math & Econ, Art and Pop Music on the default wheel", () => {
    expect(PersonaLabelVals.map((label) => CategoryLabelVals[Persona.slotIdxOf(label)])).to.deep.eq(['math_econ', 'art', 'pop_music'])
  })

  it("do better than their worst at every difficulty, and better on easier questions", () => {
    for (const difficulty of DifficultyVals) {
      const { best, worst } = PersonaChanceBounds[difficulty]
      expect(best).to.be.greaterThan(worst)
    }
    expect(PersonaChanceBounds.easy.best).to.be.greaterThan(PersonaChanceBounds.medium.best)
    expect(PersonaChanceBounds.medium.worst).to.be.greaterThan(PersonaChanceBounds.hard.worst)
  })
})

describe("Persona", () => {
  it("names a persona", () => {
    expect(Persona.titleOf('masie')).to.eq('Masie')
    expect(Persona.titleOf('poppy')).to.eq('Poppy')
  })

  it("places a persona at their slot", () => {
    expect(Persona.slotIdxOf('masie')).to.eq(0)
    expect(Persona.slotIdxOf('artie')).to.eq(8)
    expect(Persona.slotIdxOf('poppy')).to.eq(16)
  })
})
