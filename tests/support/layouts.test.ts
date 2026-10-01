import { describe, expect, it } from 'vitest'
import { sourceOf as columnSourceOf } from '../../src/models/column'
import { Hunt } from '../../src/models/hunt'
import { Quiz } from '../../src/models/quiz'
import { DefaultWidgetings } from '../../src/models/seeds'
import { classicHunt, classicLayout } from './layouts'
import { SumColkeyLabels } from './sum-colkeys'

// The fixture is what the bots', the sums' and the exports' tests stand on, so it is held to
// being a layout a quiz accepts, and to the shape those tests expect of it.
describe('classicLayout', () => {
  const layout = classicLayout()

  it("works the seeding's default widgetings, the bots first", () => {
    expect(layout.widgetings).to.deep.eq([...DefaultWidgetings])
  })

  it("has twenty-one columns, per the doc example, the sums between Q# and Alt Text", () => {
    expect(classicLayout().columns.length).to.eq(21)
    expect(layout.columns.map((column) => column.title)).to.deep.eq([
      'Title', 'Clueing', 'Hint', 'Chains to', 'BUT NOT', 'Q#',
      'Clueing + Rank', 'Clueing Full Sum', 'Clueing Numeral Sum', 'BUT NOT Full Sum', 'BUT NOT Numeral Sum', 'Hint Full Sum', 'Hint Numeral Sum', 'Clueing+BUT NOT Full',
      'Alt Text', 'Notes', 'Full Answer', 'Clueing ishes', 'BUT NOT ishes', 'Hint Ishes', 'Quick-model guess',
    ])
  })

  it("shows each of its twelve widgetings in a column, the sums as narrow as numbers", () => {
    expect(layout.columns.map((column) => columnSourceOf(column.source)).filter((source) => source.kind === 'widgeting')).to.have.lengthOf(12)
    const sums = layout.columns.filter((column) => (SumColkeyLabels as readonly string[]).includes(column.label))
    expect(new Set(sums.map((column) => column.width_px))).to.deep.eq(new Set([78]))
  })

  it("is a layout a quiz accepts, and a fresh copy each time", () => {
    expect(() => Quiz.fill({ _id: Quiz.blank()._id, ...layout })).to.not.throw()
    expect(classicLayout().columns).not.to.eq(classicLayout().columns)
  })
})

describe('classicHunt', () => {
  it("is a fresh hunt whose quiz works the twelve default widgetings, per the doc example", () => {
    const [quiz] = Hunt.quizzesOf(classicHunt('quiet_otter'))
    expect([quiz?.label, quiz?.widgetings.length, quiz?.columns]).to.deep.eq(['quiet_otter', 12, classicLayout().columns])
  })

  it("is a hunt that fills, which checks every column shows something its quiz has", () => {
    expect(() => Hunt.fill(classicHunt())).to.not.throw()
  })
})
