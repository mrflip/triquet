import { describe, expect, it } from 'vitest'
import { LayoutFoldkeys, madeFoldkeys } from '../../src/components/layout-folds'
import { newColumnShowing } from '../../src/lib/widgeting-edit'

describe("LayoutFoldkeys", () => {
  it("keys each place a panel is drawn apart", () => {
    const keys = [LayoutFoldkeys.column('memo'), LayoutFoldkeys.beneath('memo'), LayoutFoldkeys.widgeting('memo'), LayoutFoldkeys.listed('memo', 'memo')]
    expect(new Set(keys).size).to.eq(4)
  })
})

describe("madeFoldkeys", () => {
  it("opens a new column's panel and the panel beneath it", () => {
    expect(madeFoldkeys([newColumnShowing({ columns: [] }, 'memo')])).to.deep.eq(['column:memo', 'column:memo:widgeting'])
  })

  it("opens a new widgeting's own panel, beside its column's", () => {
    const actions = [{ kind: 'add_widgeting', widgeting: { widget_label: 'memo', label: 'memo' } } as const, newColumnShowing({ columns: [] }, 'memo')]
    expect(madeFoldkeys(actions)).to.deep.eq(['widgeting:memo', 'column:memo', 'column:memo:widgeting'])
  })

  it("opens nothing for an edit", () => {
    expect(madeFoldkeys([{ kind: 'edit_column', label: 'memo', patch: { title: 'Memo' } }])).to.deep.eq([])
  })
})
