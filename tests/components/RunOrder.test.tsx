import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RunOrderLine, RunOrderList } from '../../src/components/RunOrder'
import { Quiz } from '../../src/models/quiz'
import { Widget } from '../../src/models/widget'
import { Widgeting, type WidgetingT } from '../../src/models/widgeting'
import { renderedText } from '../support/rendering'

const shout = Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(question.title)', description: 'The title, shouted.' })
const remark = Widget.fill({ label: 'remark', formulary: 'entry', config: { entry_kind: 'text' } })

/** The run-order list's markup, for a quiz working `widgetings` */
function runOrderMarkup(widgetings: WidgetingT[]): string {
  const quiz = { ...Quiz.blank(), widgetings }
  return renderToStaticMarkup(<RunOrderList quiz={quiz} library={[shout, remark]} revisable dispatch={vi.fn()} rowOf={(widgeting) => widgeting.label} />)
}

describe('RunOrderList', () => {
  const loud = Widgeting.fill({ widget_label: 'shout', label: 'loud' })
  const aside = Widgeting.fill({ widget_label: 'remark', label: 'aside' })

  it("rules the entries off from the rest when it has both", () => {
    expect(runOrderMarkup([loud, aside]).match(/<hr/g)).to.have.length(1)
  })

  it("draws no rule when it has only entries, or none", () => {
    expect(runOrderMarkup([aside])).not.to.contain('<hr')
    expect(runOrderMarkup([loud])).not.to.contain('<hr')
  })

  it("says nothing of its own about the entries", () => {
    expect(runOrderMarkup([loud, aside])).not.to.contain('run first')
  })
})

describe('RunOrderLine', () => {
  it("says the mark of what it works, the widgeting's label, the widget, its tier and its own description", () => {
    const widgeting = Widgeting.fill({ widget_label: 'shout', label: 'loud', description: 'For the finale.' })
    // The mark is an icon, named by its title: what a screen reader says of it.
    expect(renderedText(<RunOrderLine widgeting={widgeting} widget={shout} handle={null} />)).to.eq('formulaloudshouteach questionFor the finale.')
  })

  it("marks each formulary with its own icon, named by its noun", () => {
    const widgeting = Widgeting.fill({ widget_label: 'remark', label: 'aside' })
    expect(renderToStaticMarkup(<RunOrderLine widgeting={widgeting} widget={remark} handle={null} />)).to.match(/<svg[^>]*role="img"[^>]*>.*<title>entry<\/title>/)
  })

  it("falls back to its widget's description when it has none of its own", () => {
    const widgeting = Widgeting.fill({ widget_label: 'shout', label: 'loud' })
    expect(renderedText(<RunOrderLine widgeting={widgeting} widget={shout} handle={null} />)).to.contain('The title, shouted.')
  })

  it("marks a widgeting for the whole quiz as such", () => {
    const widgeting = Widgeting.fill({ widget_label: 'shout', label: 'loud', tier: 'quiz' })
    expect(renderedText(<RunOrderLine widgeting={widgeting} widget={shout} handle={null} />)).to.contain('whole quiz')
  })

  it("says so when the library no longer holds its widget", () => {
    const widgeting = Widgeting.fill({ widget_label: 'gone', label: 'gone' })
    expect(renderedText(<RunOrderLine widgeting={widgeting} widget={null} handle={null} />)).to.contain('works gone, which the library no longer holds')
  })
})
