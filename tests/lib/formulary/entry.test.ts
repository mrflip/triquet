import { describe, expect, it } from 'vitest'
import { EntryFormulary } from '../../../src/lib/formulary/entry'
import { Widget, WidgetValidators } from '../../../src/models/widget'

const entryOf = (entry_kind: 'text' | 'number' | 'labelish' | 'titleish') => Widget.fill({ label: 'remark', formulary: 'entry', config: { entry_kind } })

describe('EntryFormulary', () => {
  it('reads nothing, is never worked out or asked, and upserts what is typed', () => {
    expect([EntryFormulary.kind, EntryFormulary.defaultInput, EntryFormulary.refresh, EntryFormulary.store]).to.deep.eq(['entry', null, null, 'upsert'])
  })

  it("reports the entry config's validator", () => {
    expect(EntryFormulary.config).to.eq(WidgetValidators.entryConfig)
  })

  it('finds nothing wrong with a widget that has no formula to get wrong', () => {
    expect(EntryFormulary.check()).to.be.null
  })

  it('reads nothing, so there is never anything to run', () => {
    expect(EntryFormulary.input()).to.deep.eq({ status: 'missing' })
  })

  describe('valueOf', () => {
    it("holds a cell to its widget's kind, per the doc example", () => {
      expect(EntryFormulary.valueOf(entryOf('labelish')).parse('quiet_otter')).to.eq('quiet_otter')
    })

    it('takes text for text, a number for a number, and a title for a title', () => {
      expect(EntryFormulary.valueOf(entryOf('text')).parse(' Ask Flip. ')).to.eq('Ask Flip.')
      expect(EntryFormulary.valueOf(entryOf('number')).parse(-1.5)).to.eq(-1.5)
      expect(EntryFormulary.valueOf(entryOf('titleish')).parse('The Otter')).to.eq('The Otter')
    })

    it("refuses what its widget's kind does not take", () => {
      expect(EntryFormulary.valueOf(entryOf('number')).safeParse('3').success).to.be.false
      expect(EntryFormulary.valueOf(entryOf('labelish')).safeParse('Quiet Otter').success).to.be.false
      expect(EntryFormulary.valueOf(entryOf('text')).safeParse(3).success).to.be.false
    })
  })
})
