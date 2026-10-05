import { describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { Category, CategoryLabelsByTitle, CategoryLabelVals, CategoryTitles, CategoryValidators, WheelSlotCount } from '../../src/models/category'

const DefaultWheel = [...CategoryLabelVals]

describe("the category catalogue", () => {
  it("holds 24 categories, each titled", () => {
    expect(WheelSlotCount).to.eq(24)
    expect(Object.keys(CategoryTitles)).to.deep.eq([...CategoryLabelVals])
  })

  it("names each category by a label of its own", () => {
    expect(new Set(CategoryLabelVals).size).to.eq(CategoryLabelVals.length)
  })
})

describe("CategoryLabelsByTitle", () => {
  it("holds every category once, alphabetically by title", () => {
    expect(new Set(CategoryLabelsByTitle)).to.deep.eq(new Set(CategoryLabelVals))
    expect(CategoryLabelsByTitle).to.have.lengthOf(CategoryLabelVals.length)
    expect(CategoryLabelsByTitle.slice(0, 4)).to.deep.eq(['art', 'biz_tech', 'chem_bio', 'classic_film'])
    expect(CategoryLabelsByTitle.at(-1)).to.eq('world_hist')
  })
})

describe("CategoryValidators.wheel", () => {
  it("takes the default wheel", () => {
    expect(CategoryValidators.wheel(DefaultWheel)).to.deep.eq(DefaultWheel)
  })

  it("takes empty slots, even every one", () => {
    const holed = DefaultWheel.map((label, idx) => (idx % 2 === 0 ? null : label))
    expect(CategoryValidators.wheel(holed)).to.deep.eq(holed)
    expect(CategoryValidators.wheel(DefaultWheel.map(() => null))).to.have.lengthOf(24)
  })

  const Refused: [unknown, string][] = [
    [DefaultWheel.slice(1),                                    'a slot short'],
    [[...DefaultWheel, null],                                   'a slot over'],
    [DefaultWheel.map((label, idx) => (idx === 1 ? 'math_econ' : label)), 'one category in two slots'],
    [DefaultWheel.map((label, idx) => (idx === 1 ? 'knitting' : label)),  'a category there is not'],
    [DefaultWheel.map((label, idx) => (idx === 1 ? '' : label)),          'a blank in place of an empty slot'],
    [undefined,                                                 'no wheel at all'],
  ]
  for (const [wheel, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => CategoryValidators.wheel(wheel as never)).to.throw(Z.ZodError)
    })
  }

  it("says which slot repeats a category", () => {
    const repeated = DefaultWheel.map((label, idx) => (idx === 5 ? 'math_econ' : label))
    const outcome = CategoryValidators.wheel.safeParse(repeated)
    expect(outcome.error?.issues.map((issue) => issue.path)).to.deep.eq([[5]])
  })
})

describe("Category", () => {
  it("titles a category as its tile shows it", () => {
    expect(Category.titleOf('tv')).to.eq('TV')
    expect(Category.titleOf('math_econ')).to.eq('Math & Econ')
  })

  it("places a category in the default order", () => {
    expect(Category.defaultIdxOf('math_econ')).to.eq(0)
    expect(Category.defaultIdxOf('art')).to.eq(8)
    expect(Category.defaultIdxOf('pop_music')).to.eq(16)
    expect(Category.defaultIdxOf('physics_eng')).to.eq(23)
  })
})
