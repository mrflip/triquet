import { describe, expect, it } from 'vitest'
import { RunOrderLine } from '../../src/components/RunOrder'
import { Widget } from '../../src/models/widget'
import { Widgeting } from '../../src/models/widgeting'
import { renderedText } from '../support/rendering'

const shout = Widget.fill({ label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)', description: 'The title, shouted.' })

describe('RunOrderLine', () => {
  it("says the widgeting's label, what it works, its tier and its own description", () => {
    const widgeting = Widgeting.fill({ widget_label: 'shout', label: 'loud', description: 'For the finale.' })
    expect(renderedText(<RunOrderLine widgeting={widgeting} widget={shout} handle={null} />)).to.eq('loud formula shouteach questionFor the finale.')
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
