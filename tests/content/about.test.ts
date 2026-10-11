import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ContactAddress } from '../../src/components/SiteFooter'
import * as Routes from '../../src/lib/routes'

/*
 * About is the homepage Google's sign-in links: it must link the privacy policy and the terms, and
 * give the address to write to, as the footer does.
 */

/** About's text, as written */
const Text = readFileSync(path.join(import.meta.dirname, '../../src/content/about.md'), 'utf8')

describe('about.md', () => {
  it("links the privacy policy and the terms of use", () => {
    expect(Text).to.include(`](${Routes.privacyPath()})`)
    expect(Text).to.include(`](${Routes.termsPath()})`)
  })

  it("gives the footer's address to write to, as a link", () => {
    expect(Text).to.include(`[${ContactAddress}](mailto:${ContactAddress})`)
  })

  it("says, in its first paragraph, what Triquet is", () => {
    expect(Text.split('\n\n', 1)[0]).to.match(/^Triquet is a workbench for writing trivia quizzes/)
  })
})
