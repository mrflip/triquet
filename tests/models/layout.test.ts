import { describe, expect, it } from 'vitest'
import { defaultLayoutFor } from '../../src/models/layout'
import { SeedExpressions } from '../../src/models/expression'
import { Quiz } from '../../src/models/quiz'

describe('defaultLayoutFor', () => {
  const layout = defaultLayoutFor(SeedExpressions)

  it('starts a quiz with the bots, then the eight sums, as widgets', () => {
    expect(layout.widgets.map((widget) => `${widget.kind}:${widget.label}`)).to.deep.eq([
      'botting:dumdum', 'botting:numnum_clueing', 'botting:numnum_hint',
      'expressing:clueing_plus_rank', 'expressing:clueing_full', 'expressing:clueing_numeral', 'expressing:butnot_full',
      'expressing:butnot_numeral', 'expressing:hint_full', 'expressing:hint_numeral', 'expressing:clueing_plus_butnot_full',
    ])
  })

  it('lays the grid out as it has always been: the questions\' fields, the sums between Q# and Alt Text, then the bots\' answers', () => {
    expect(layout.columns.map((column) => column.title)).to.deep.eq([
      'Title', 'Clueing', 'Hint', 'Chains to', 'BUT NOT', 'Q#',
      'Clueing + Rank', 'Clueing Full Sum', 'Clueing Numeral Sum', 'BUT NOT Full Sum', 'BUT NOT Numeral Sum', 'Hint Full Sum', 'Hint Numeral Sum', 'Clueing+BUT NOT Full',
      'Alt Text', 'Notes', 'Full Answer', 'Clueing ishes', 'BUT NOT ishes', 'Hint Ishes', 'Quick-model guess',
    ])
  })

  it('makes every sum column as narrow as the number columns always were', () => {
    expect(new Set(layout.columns.filter((column) => column.label.startsWith('clueing_') || column.label.startsWith('hint_') || column.label.startsWith('butnot_')).filter((column) => column.source === column.label).map((column) => column.width_px))).to.deep.eq(new Set([78]))
  })

  it('is a quiz\'s widgets and columns that the quiz accepts, every column showing something the quiz has', () => {
    expect(() => Quiz.fill({ _id: Quiz.blank()._id, ...layout })).to.not.throw()
  })

  it('leaves out a sum whose expression the workspace no longer has, widget and column together', () => {
    const without = defaultLayoutFor(SeedExpressions.filter((expression) => expression.label !== 'hint_full'))
    expect(without.widgets.map((widget) => widget.label)).to.not.include('hint_full')
    expect(without.columns.map((column) => column.label)).to.not.include('hint_full')
    expect(without.widgets).to.have.length(10)
  })

  it('is just the bots and the fixed columns for a workspace with no expressions', () => {
    const bare = defaultLayoutFor([])
    expect(bare.widgets).to.have.length(3)
    expect(bare.columns).to.have.length(13)
  })
})
