import { describe, expect, it } from 'vitest'
import { TemplateSourceWords, templateRefsOf, templateSourceOf } from '../../src/components/LiquidizeParamsFields'
import { Widgeting } from '../../src/models/widgeting'

describe('templateSourceOf', () => {
  it("is where params say a template comes from", () => {
    expect(templateSourceOf({ template: '{{ question.hint }}' })).to.eq('own')
    expect(templateSourceOf({ template_from: { ref: 'dumdum' } })).to.eq('bag')
    expect(templateSourceOf({})).to.eq('widget')
  })

  it("is said for each place", () => {
    expect(Object.keys(TemplateSourceWords)).to.have.members(['widget', 'own', 'bag'])
  })
})

describe('templateRefsOf', () => {
  const dumdum = Widgeting.fill({ label: 'dumdum', widget_label: 'dumdum' })
  const playtesters = Widgeting.fill({ label: 'playtesters', widget_label: 'memo', tier: 'quiz' })
  const blurb = Widgeting.fill({ label: 'blurb', widget_label: 'blurb' })

  it("offers the question's fields, view and keys, the quiz's other widgetings, and the bag's words", () => {
    const refs = templateRefsOf([dumdum, playtesters, blurb], 'blurb')
    expect(refs.slice(0, 2)).to.deep.eq(['title', 'clueing'])
    expect(refs).to.include.members(['butnot', 'rank', 'dumdum', 'quiz.playtesters', 'quiz', 'questions'])
    expect(refs).not.to.include('blurb')
  })

  it("offers every widgeting to a new one, which has no label yet", () => {
    expect(templateRefsOf([dumdum, blurb], '')).to.include.members(['dumdum', 'blurb'])
  })
})
