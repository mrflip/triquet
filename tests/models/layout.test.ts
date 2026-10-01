import { describe, expect, it } from 'vitest'
import { defaultLayout } from '../../src/models/layout'
import { Quiz } from '../../src/models/quiz'

describe('defaultLayout', () => {
  const layout = defaultLayout()

  it("starts a quiz with no widgetings, per the doc example: the library's widgets are opt-in", () => {
    expect(layout.widgetings).to.deep.eq([])
  })

  it("starts a quiz with a column for each field every quiz writes, per the doc example", () => {
    expect(layout.columns.map((column) => column.label)).to.deep.eq(['title', 'qnum', 'clueing', 'full_answer', 'notes'])
    expect(layout.columns.map((column) => column.title)).to.deep.eq(['Title', 'Q#', 'Clueing', 'Full Answer', 'Notes'])
  })

  it("shows each column's question field under that field's own label", () => {
    expect(layout.columns.map((column) => column.source)).to.deep.eq(layout.columns.map((column) => `question.${column.label}`))
  })

  it("leaves the hint, the chain, the BUT NOT and the alt text, which every question still holds, to be opted into", () => {
    const sources = new Set(layout.columns.map((column) => column.source))
    for (const field of ['hint', 'chains_to', 'butnot', 'alt_text']) { expect(sources.has(`question.${field}`)).to.be.false }
  })

  it("is a quiz's widgetings and columns that the quiz accepts", () => {
    expect(() => Quiz.fill({ _id: Quiz.blank()._id, ...layout })).to.not.throw()
  })

  it("is a fresh copy each time, so one quiz's edits never reach another's", () => {
    expect(defaultLayout().widgetings).not.to.eq(defaultLayout().widgetings)
    expect(defaultLayout().columns).not.to.eq(defaultLayout().columns)
  })
})
