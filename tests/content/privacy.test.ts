import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ContactAddress } from '../../src/components/SiteFooter'
import * as Routes from '../../src/lib/routes'

/*
 * The privacy policy is markdown, which cannot import what it names, so these keep it in step with
 * the app: the address it gives is the footer's, and the pages it links are the app's own.
 */

/** The policy, as written */
const Text = readFileSync(path.join(import.meta.dirname, '../../src/content/privacy.md'), 'utf8')

/** The day the policy says it last changed, as its first line gives it */
const LastChanged = /^\*Last changed: (\d{1,2} [A-Z][a-z]+ \d{4})\.\*$/.exec(Text.split('\n', 1)[0] ?? '')?.[1]

describe('privacy.md', () => {
  it("opens with the day it last changed", () => {
    expect(LastChanged).to.be.a('string')
    const parsed = Date.parse(`${String(LastChanged)} UTC`)
    expect(parsed).not.to.be.NaN
  })

  it("gives the footer's address to write to, as a link", () => {
    expect(Text).to.include(`[${ContactAddress}](mailto:${ContactAddress})`)
  })

  it("links the terms of use", () => {
    expect(Text).to.include(`](${Routes.termsPath()})`)
  })

  it("says what is kept from a Google account, and that nothing more is asked for", () => {
    expect(Text).to.include('the email address, name and picture Google sends us')
    expect(Text).to.include('We ask Google for nothing more')
  })

  it("says that a bot's prompt goes to Anthropic", () => {
    expect(Text).to.match(/goes from our server to \[Anthropic\]/)
  })
})
