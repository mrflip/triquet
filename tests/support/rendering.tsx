import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * The text a view draws, as a reader would see it: the element rendered once on the server, as
 * Next first renders a page, with no DOM, no effects and no browser, then the styles MUI writes
 * into the markup and every tag taken away. For a test of what a view chooses to say; anything
 * about behaviour in a browser is the e2e suite's.
 *
 * @example renderedText(<SyncUnconfigured />)  // => 'This build has no database: set NEXT_PUBLIC_CONVEX_URL.'
 */
export function renderedText(element: ReactElement): string {
  return renderToStaticMarkup(element)
    .replaceAll(/<style[^<>]*>[^<]*<\/style>/g, '')
    .replaceAll(/<[^<>]*>/g, '')
}
