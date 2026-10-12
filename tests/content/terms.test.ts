import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ContactAddress } from '../../src/components/SiteFooter'
import * as Routes from '../../src/lib/routes'

/*
 * The terms are markdown, which cannot import what they name, so these keep them in step with the
 * app: the address they give is the footer's, and the page they link is the app's own.
 */

/** The terms, as written */
const Text = readFileSync(path.join(import.meta.dirname, '../../src/content/terms.md'), 'utf8')

/** The day the terms say they last changed, as their first line gives it */
const LastChanged = /^\*Last changed: (\d{1,2} [A-Z][a-z]+ \d{4})\.\*$/.exec(Text.split('\n', 1)[0] ?? '')?.[1]

describe('terms.md', () => {
  it("opens with the day they last changed", () => {
    expect(LastChanged).to.be.a('string')
    const parsed = Date.parse(`${String(LastChanged)} UTC`)
    expect(parsed).not.to.be.NaN
  })

  it("gives the footer's address to write to, as a link", () => {
    expect(Text).to.include(`[${ContactAddress}](mailto:${ContactAddress})`)
  })

  it("links the privacy policy", () => {
    expect(Text).to.include(`](${Routes.privacyPath()})`)
  })
})
