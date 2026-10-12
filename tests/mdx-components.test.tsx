import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useMDXComponents } from '../src/mdx-components'

/** The link `src/content` markdown writes as `[text](href)`, drawn as a page draws it */
function Linked({ href }: Readonly<{ href: string }>) {
  const Anchor = useMDXComponents().a
  if (Anchor === undefined) { throw new Error('The markdown components dress no link') }
  return <Anchor href={href}>the words</Anchor>
}

describe("the markdown components' link", () => {
  for (const [href, describes] of [
    ['/privacy',                   "one of the app's own pages, which the app's own links open"],
    ['https://example.com/policy', 'a page elsewhere'],
    ['mailto:info@example.com',    'an address to write to'],
  ] as const) {
    it(`goes to ${describes}, at the address written`, () => {
      const markup = renderToStaticMarkup(<Linked href={href} />)
      expect(markup).to.contain(`href="${href}"`)
      expect(markup).to.contain('>the words<')
    })
  }
})
