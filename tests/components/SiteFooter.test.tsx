import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ContactAddress, SiteFooter } from '../../src/components/SiteFooter'
import { renderedText } from '../support/rendering'

describe('SiteFooter', () => {
  it("names About, Privacy and Terms, and the address to write to", () => {
    expect(renderedText(<SiteFooter />)).to.eq(`AboutPrivacyTerms${ContactAddress}`)
  })

  it("links each page at its own address, and the address as mail", () => {
    const markup = renderToStaticMarkup(<SiteFooter />)
    for (const href of ['/about', '/privacy', '/terms', `mailto:${ContactAddress}`]) {
      expect(markup).to.contain(`href="${href}"`)
    }
  })
})
