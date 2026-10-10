import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Panel } from '../../../src/components/panels/Panel'
import { TabbedPanel } from '../../../src/components/panels/TabbedPanel'

describe('Panel', () => {
  it("puts what it is behind an (i) beside its heading, not in a paragraph", () => {
    const markup = renderToStaticMarkup(<Panel title="Members" about="Who is on this hunt.">body</Panel>)
    expect(markup).to.contain('aria-label="About Members"')
    expect(markup).not.to.contain('Who is on this hunt.')
  })

  it("says its message up front, where it has news rather than an explanation", () => {
    const markup = renderToStaticMarkup(<Panel title="No such quiz" blurb="The hunt has no quiz there.">body</Panel>)
    expect(markup).to.contain('The hunt has no quiz there.')
    expect(markup).not.to.contain('About No such quiz')
  })
})

describe('TabbedPanel', () => {
  const tabs = [
    { label: 'First', about: 'The first, explained.', content: 'one' },
    { label: 'Second', content: 'two' },
  ]

  it("explains the tab showing behind an (i) at the end of its tabs, and none of the tabs in a paragraph", () => {
    const markup = renderToStaticMarkup(<TabbedPanel title="Both" about="Two tabs." tabs={tabs} />)
    expect(markup).to.contain('aria-label="About the First tab"')
    expect(markup).not.to.contain('The first, explained.')
  })

  it("has no (i) for a tab with nothing to explain", () => {
    expect(renderToStaticMarkup(<TabbedPanel title="Both" about="Two tabs." tabs={tabs} shownFirst="Second" />)).not.to.contain('About the Second tab')
  })
})
