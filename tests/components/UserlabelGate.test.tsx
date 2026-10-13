import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as EST from 'es-toolkit'
import { UserlabelGate } from '../../src/components/UserlabelGate'
import { AppNotices, googleGateNotice } from '../../src/lib/notices'
import type { OwnUserT } from '../../src/models/user'
import type { ShownT } from '../../src/state/shown'
import { renderedText } from '../support/rendering'

// What the front door chooses to say, by what the browser's user is told of itself and who holds
// the handle in its field: the page's hooks stood in for, as a visitor holding no handle yet meets it.

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: EST.noop, replace: EST.noop }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/' }))
vi.mock('../../src/state/use-me', () => ({ useMe: () => ({ user: null, loaded: true }) }))
vi.mock('../../src/state/use-user-actions', () => ({ useUserActions: () => ({ act: EST.noop, busy: false, notice: null }) }))
vi.mock('../../src/state/use-userlabel-holder', () => ({ useUserlabelHolder: vi.fn() }))
vi.mock('../../src/state/shown', () => ({ useShown: vi.fn() }))

const { useShown } = await import('../../src/state/shown')
const { useUserlabelHolder } = await import('../../src/state/use-userlabel-holder')

/** The page told that its visitor's user is `own`, with Google offered or not */
function shownWith(own: OwnUserT | null, offered: boolean): void {
  const user = { user: null, onRetitle: EST.noop, own, google: { offered, start: EST.asyncNoop }, onSignOut: EST.asyncNoop }
  vi.mocked(useShown).mockReturnValue({ hunt: null, quiz: null, quizActs: null, user } satisfies ShownT)
}

/** A standalone visitor's user, holding no handle yet, as `users.own` tells it */
const Anonymous: OwnUserT = { google: false, email: null, suggested: null, nameChoice: null }

/** A user back from Google holding no handle, as `users.own` tells it */
const BackFromGoogle: OwnUserT = { google: true, email: 'flip@example.com', suggested: { userlabel: 'flip_kromer_2', title: 'Flip Kromer' }, nameChoice: null }

/** Text as rendered, with the entities React writes for the apostrophes and quotes the notices hold undone */
function unentitied(text: string): string {
  return text.replaceAll('&#x27;', "'").replaceAll('&quot;', '"')
}

/** The front door's text, as rendered */
function gateText(): string {
  return unentitied(renderedText(<UserlabelGate />))
}

/** Whether the front door shows a button saying `words` */
function hasButton(words: string): boolean {
  return renderToStaticMarkup(<UserlabelGate />).includes(`>${words}</button>`)
}

describe('UserlabelGate', () => {
  beforeEach(() => { vi.mocked(useUserlabelHolder).mockReturnValue(undefined) })
  afterEach(() => { vi.mocked(useShown).mockReset(); vi.mocked(useUserlabelHolder).mockReset() })

  it("offers signing in with Google to an existing account first, then, after an or, signing up as a standalone account, its limits said beneath", () => {
    shownWith(Anonymous, true)
    const text = gateText()
    expect(text).to.include(AppNotices.userlabelGateTitle)
    expect(text).to.include(`Sign in with Google${AppNotices.ifExistingAccount}or`)
    expect(text).to.include(`${AppNotices.standaloneHave} ${AppNotices.standaloneLimits}. ${AppNotices.verifyAccountBrings}`)
    expect(hasButton(AppNotices.signUp)).to.be.true
    expect(text.indexOf(AppNotices.ifExistingAccount)).to.be.below(text.indexOf(AppNotices.standaloneHave))
  })

  it("offers nothing of Google, nor a word of a standalone account's limits, where the deployment does not offer Google", () => {
    shownWith(Anonymous, false)
    const text = gateText()
    expect(text).to.not.include('Google')
    expect(text).to.not.include(AppNotices.standaloneHave)
    expect(text).to.include(AppNotices.nameAndHandleAbout)
    expect(hasButton(AppNotices.signUp)).to.be.true
  })

  it("asks a visitor back from Google to add their name, saying whom Google signed them in as, and offers the name and handle made from what Google sent", () => {
    shownWith(BackFromGoogle, true)
    const markup = renderToStaticMarkup(<UserlabelGate />)
    const text = gateText()
    expect(text).to.include(AppNotices.googleGateTitle)
    expect(text).to.include(`${googleGateNotice('flip@example.com')}${AppNotices.nameAndHandleAbout}`)
    expect(text).to.not.include('Sign in with Google')
    expect(text).to.not.include(AppNotices.standaloneHave)
    expect(hasButton(AppNotices.saveName)).to.be.true
    expect(markup).to.include('value="Flip Kromer"')
    expect(markup).to.include('value="flip_kromer_2"')
    expect(vi.mocked(useUserlabelHolder)).toHaveBeenLastCalledWith('flip_kromer_2')
  })

  it("makes the handle from the Google name where no offered handle is free", () => {
    shownWith({ ...BackFromGoogle, suggested: { userlabel: null, title: 'Flip Kromer' } }, true)
    expect(renderToStaticMarkup(<UserlabelGate />)).to.include('value="flip_kromer"')
  })

  it("asks who holds the handle only once it is a userlabel", () => {
    shownWith(Anonymous, true)
    renderedText(<UserlabelGate />)
    expect(vi.mocked(useUserlabelHolder)).toHaveBeenLastCalledWith(null)
  })

  it("says, in place of the button, to sign in with Google for a handle a verified account holds", () => {
    shownWith(Anonymous, true)
    vi.mocked(useUserlabelHolder).mockReturnValue('verified')
    expect(gateText()).to.include(AppNotices.heldByVerifiedAccount)
    expect(hasButton(AppNotices.signUp)).to.be.false
  })

  it("says a handle held any other way is taken, as it says one a verified account holds where Google is not offered", () => {
    shownWith(Anonymous, true)
    for (const holder of ['standalone', 'kept'] as const) {
      vi.mocked(useUserlabelHolder).mockReturnValue(holder)
      expect(gateText()).to.include(AppNotices.heldOtherwise)
      expect(hasButton(AppNotices.signUp)).to.be.false
    }
    shownWith(Anonymous, false)
    vi.mocked(useUserlabelHolder).mockReturnValue('verified')
    expect(gateText()).to.include(AppNotices.heldOtherwise)
    expect(gateText()).to.not.include(AppNotices.heldByVerifiedAccount)
  })

  it("keeps the button for a handle nobody holds, or one not yet asked of", () => {
    shownWith(Anonymous, true)
    vi.mocked(useUserlabelHolder).mockReturnValue(null)
    expect(hasButton(AppNotices.signUp)).to.be.true
  })
})
