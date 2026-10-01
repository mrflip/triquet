import { describe, expect, it } from 'vitest'
import { sourceOf as columnSourceOf } from '../../src/models/column'
import { defaultLayout } from '../../src/models/layout'
import { Quiz } from '../../src/models/quiz'
import { DefaultWidgetings } from '../../src/models/seeds'
import { SumColkeyLabels } from '../support/sum-colkeys'

describe('defaultLayout', () => {
  const layout = defaultLayout()

  it("starts a quiz with the bots, the BUT NOT ishes, then the eight sums, as widgetings", () => {
    expect(layout.widgetings.map((widgeting) => `${widgeting.widget_label}:${widgeting.label}`)).to.deep.eq([
      'dumdum:dumdum', 'numnum_clueing:numnum_clueing', 'numnum_hint:numnum_hint', 'butnot_ishes:butnot_ishes',
      'clueing_plus_rank:clueing_plus_rank', 'clueing_full:clueing_full', 'clueing_numeral:clueing_numeral', 'butnot_full:butnot_full',
      'butnot_numeral:butnot_numeral', 'hint_full:hint_full', 'hint_numeral:hint_numeral', 'clueing_plus_butnot_full:clueing_plus_butnot_full',
    ])
    expect(layout.widgetings).to.deep.eq([...DefaultWidgetings])
  })

  it("lays the grid out as it has always been: the questions' fields, the sums between Q# and Alt Text, then the bots' answers", () => {
    expect(layout.columns.map((column) => column.title)).to.deep.eq([
      'Title', 'Clueing', 'Hint', 'Chains to', 'BUT NOT', 'Q#',
      'Clueing + Rank', 'Clueing Full Sum', 'Clueing Numeral Sum', 'BUT NOT Full Sum', 'BUT NOT Numeral Sum', 'Hint Full Sum', 'Hint Numeral Sum', 'Clueing+BUT NOT Full',
      'Alt Text', 'Notes', 'Full Answer', 'Clueing ishes', 'BUT NOT ishes', 'Hint Ishes', 'Quick-model guess',
    ])
  })

  it("has twenty-one columns, per the doc example", () => {
    expect(defaultLayout().columns.length).to.eq(21)
  })

  it("shows the bots' answers and the BUT NOT ishes from their widgetings, under the column labels they always had", () => {
    const sourceFor = Object.fromEntries(layout.columns.map((column) => [column.label, column.source]))
    expect([sourceFor.clueing_ishes, sourceFor.butnot_ishes, sourceFor.hint_ishes, sourceFor.guess]).to.deep.eq(['numnum_clueing', 'butnot_ishes', 'numnum_hint', 'dumdum'])
  })

  it("makes every sum column as narrow as the number columns always were", () => {
    const sums = layout.columns.filter((column) => (SumColkeyLabels as readonly string[]).includes(column.label))
    expect(sums).to.have.lengthOf(8)
    expect(new Set(sums.map((column) => column.width_px))).to.deep.eq(new Set([78]))
  })

  it("shows each of its twelve widgetings in a column", () => {
    const widgetingSources = layout.columns.map((column) => columnSourceOf(column.source)).filter((source) => source.kind === 'widgeting')
    expect(widgetingSources).to.have.lengthOf(12)
  })

  it("is a quiz's widgetings and columns that the quiz accepts, every column showing something the quiz has", () => {
    expect(() => Quiz.fill({ _id: Quiz.blank()._id, ...layout })).to.not.throw()
  })

  it("is a fresh copy each time, so one quiz's edits never reach another's", () => {
    expect(defaultLayout().widgetings).not.to.eq(defaultLayout().widgetings)
    expect(defaultLayout().columns).not.to.eq(defaultLayout().columns)
  })
})
