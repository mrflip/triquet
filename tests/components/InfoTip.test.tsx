import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Explained, InfoTip } from '../../src/components/InfoTip'
import { renderedText } from '../support/rendering'

describe('InfoTip', () => {
  it("is a button named for what it explains", () => {
    expect(renderToStaticMarkup(<InfoTip topic="the run order">Each reads what those above it came to.</InfoTip>)).to.contain('aria-label="About the run order"')
  })

  it("keeps its explanation off the page until it is asked for", () => {
    expect(renderedText(<InfoTip topic="the run order">Each reads what those above it came to.</InfoTip>)).not.to.contain('Each reads')
  })
})

describe('Explained', () => {
  it("draws the field it explains, with its tip beside it", () => {
    const markup = renderToStaticMarkup(<Explained topic="the formula" about="JSONata over what it shows."><input aria-label="Formula" /></Explained>)
    expect(markup).to.contain('aria-label="Formula"')
    expect(markup).to.contain('aria-label="About the formula"')
    expect(markup).not.to.contain('JSONata over')
  })
})
