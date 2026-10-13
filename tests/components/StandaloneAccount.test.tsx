import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as EST from 'es-toolkit'
import { SealedNotice, StandaloneAccountPanel, StandaloneDisclaimer } from '../../src/components/StandaloneAccount'
import { AppNotices, keepHandleNotice, RefusalNotices } from '../../src/lib/notices'
import type { ShownT } from '../../src/state/shown'
import { renderedText } from '../support/rendering'

// What a standalone account is told of itself, and of what it may not do: the page's hooks stood
// in for, on a quiz's page.

vi.mock('next/navigation', () => ({ usePathname: () => '/~mrflip/mrflip/quizzes/home/mrflip/!edit' }))
vi.mock('../../src/state/shown', () => ({ useShown: vi.fn() }))

const { useShown } = await import('../../src/state/shown')

/** The page told that the deployment offers Google, or does not */
function shownWith(offered: boolean): void {
  const own = { google: false, email: null, suggested: null, nameChoice: null }
  const user = { user: null, onRetitle: EST.noop, own, google: { offered, start: EST.asyncNoop }, onSignOut: EST.asyncNoop }
  vi.mocked(useShown).mockReturnValue({ hunt: null, quiz: null, quizActs: null, user } satisfies ShownT)
}

/** Text as rendered, with the entities React writes for the apostrophes the notices hold undone */
function unentitied(text: string): string {
  return text.replaceAll('&#x27;', "'")
}

/** What a standalone account is told of its limits, in a line: the limits, and what a verified account brings */
const Disclaimer = `${AppNotices.standaloneHave} ${AppNotices.standaloneLimits}. ${AppNotices.verifyAccountBrings}`

describe("StandaloneDisclaimer", () => {
  it("says a standalone account has limits, linked to the help page's list of them, and what a verified account brings", () => {
    const markup = renderToStaticMarkup(<StandaloneDisclaimer />)
    expect(markup).to.match(/<a [^>]*href="\/help#account-benefits"[^>]*>some limitations<\/a>/)
    expect(renderedText(<StandaloneDisclaimer />)).to.eq(Disclaimer)
  })

  it("says only that there are limits, when brief", () => {
    expect(renderedText(<StandaloneDisclaimer brief />)).to.eq(`${AppNotices.standaloneHave} ${AppNotices.standaloneLimits}.`)
  })
})

describe("StandaloneAccountPanel", () => {
  afterEach(() => { vi.mocked(useShown).mockReset() })

  it("says a standalone account has limits, and offers a verified account under its handle", () => {
    shownWith(true)
    const text = unentitied(renderedText(<StandaloneAccountPanel userlabel="mrflip" />))
    expect(text).to.include(AppNotices.standaloneTitle)
    expect(text).to.include(`${AppNotices.standaloneHave} ${AppNotices.standaloneLimits}.`)
    expect(text).to.include(keepHandleNotice('mrflip'))
    expect(text).to.include('Continue with Google')
  })

  it("says it has limits, and offers nothing of Google, where the deployment does not offer it", () => {
    shownWith(false)
    const text = unentitied(renderedText(<StandaloneAccountPanel userlabel="mrflip" />))
    expect(text).to.include(`${AppNotices.standaloneHave} ${AppNotices.standaloneLimits}.`)
    expect(text).to.not.include('Google')
  })
})

describe("SealedNotice", () => {
  it("links a refusal's opening words to verifying the account, coming back to this page", () => {
    const markup = renderToStaticMarkup(<SealedNotice notice={RefusalNotices.sealedRelabel} />)
    expect(markup).to.match(/<a [^>]*href="\/signin\?then=%2F%7Emrflip%2Fmrflip%2Fquizzes%2Fhome%2Fmrflip%2F%21edit"[^>]*>Verify your account<\/a> to unlock multiple hunts/)
    expect(renderedText(<SealedNotice notice={RefusalNotices.sealedRelabel} />)).to.eq(RefusalNotices.sealedRelabel)
  })

  it("says any other refusal as it is, linking nothing", () => {
    const markup = renderToStaticMarkup(<SealedNotice notice={RefusalNotices.sealedJoin} />)
    expect(markup).to.not.include('<a ')
    expect(unentitied(renderedText(<SealedNotice notice={RefusalNotices.sealedJoin} />))).to.eq(RefusalNotices.sealedJoin)
  })
})
