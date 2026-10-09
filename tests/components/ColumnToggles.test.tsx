import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ColumnToggles } from '../../src/components/ColumnToggles'
import type { ColumnStagesT } from '../../src/components/ColumnFields'
import type { ColumnT } from '../../src/models/column'

const notes: ColumnT = { label: 'notes', title: 'Notes', source: 'notes', width_px: 220 }
const readout: ColumnStagesT = { presets: [], drawnByEditor: false, liquidized: false }

/** The toggles' markup for `column`, templated or not, or not templatable at all */
function togglesMarkup(column: ColumnT, templated: boolean | null, stages = readout): string {
  const templating = templated === null ? null : { templated, onTemplated: vi.fn() }
  return renderToStaticMarkup(<ColumnToggles column={column} columnName="Notes" stages={stages} templating={templating} locked={false} onCommit={vi.fn()} />)
}

describe('ColumnToggles', () => {
  it("names its readout by what it draws, and what it draws unset", () => {
    expect(togglesMarkup(notes, false)).to.contain('aria-label="Readout of Notes: as the cells choose"')
    expect(togglesMarkup({ ...notes, readout: 'markdown' }, false)).to.contain('aria-label="Readout of Notes: markdown"')
  })

  it("says in its tooltip what its readout is drawn as, and what a click makes it", () => {
    expect(togglesMarkup(notes, false)).to.contain('title="Drawn as the cells choose. Click to draw it as plain text."')
    expect(togglesMarkup({ ...notes, readout: 'label' }, false)).to.contain('title="Drawn as a label. Click to draw it as the cells choose."')
  })

  it("says whether it is templated and collapsed by aria-pressed, under names that stay the same", () => {
    const markup = togglesMarkup({ ...notes, collapsed: true }, false)
    expect(markup).to.match(/aria-label="Templated: Notes" aria-pressed="false"/)
    expect(markup).to.match(/aria-label="Collapsed: Notes" aria-pressed="true"/)
  })

  it("leaves a blank where Templated would be, for what cannot be templated", () => {
    expect(togglesMarkup(notes, null)).not.to.contain('Templated')
  })

  it("stills the readout while its editor draws its cells", () => {
    expect(togglesMarkup(notes, false, { ...readout, drawnByEditor: true })).to.match(/disabled=""[^>]*aria-label="Readout of Notes/)
  })
})
