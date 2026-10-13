import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as EST from 'es-toolkit'
import { UserlabelGate } from '../../src/components/UserlabelGate'
import { AppNotices, googleGateNotice } from '../../src/lib/notices'
import type { OwnUserT } from '../../src/models/user'
import type { ShownT } from '../../src/state/shown'
import { renderedText } from '../support/rendering'

// What the front door chooses to say, by what the browser's user is told of itself: the page's
// hooks stood in for, as a visitor holding no handle yet meets it.

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: EST.noop, replace: EST.noop }), useSearchParams: () => new URLSearchParams() }))
vi.mock('../../src/state/use-me', () => ({ useMe: () => ({ user: null, loaded: true }) }))
vi.mock('../../src/state/use-user-actions', () => ({ useUserActions: () => ({ act: EST.noop, busy: false, notice: null }) }))
vi.mock('../../src/state/shown', () => ({ useShown: vi.fn() }))

const { useShown } = await import('../../src/state/shown')

/** The page told that its visitor's user is `own`, with Google offered or not */
function shownWith(own: OwnUserT | null, offered: boolean): void {
  const user = { user: null, onRetitle: EST.noop, own, google: { offered, start: EST.asyncNoop }, onSignOut: EST.asyncNoop }
  vi.mocked(useShown).mockReturnValue({ hunt: null, quiz: null, quizActs: null, user } satisfies ShownT)
}

/** An anonymous visitor's user, as `users.own` tells it */
const Anonymous: OwnUserT = { google: false, email: null, suggested: null, nameChoice: null }

/** A user back from Google holding no handle, as `users.own` tells it */
const BackFromGoogle: OwnUserT = { google: true, email: 'flip@example.com', suggested: { userlabel: 'flip_kromer_2', title: 'Flip Kromer' }, nameChoice: null }

describe('UserlabelGate', () => {
  afterEach(() => { vi.mocked(useShown).mockReset() })

  it('offers an anonymous visitor signing in with Google beneath the fields, where the deployment offers it', () => {
    shownWith(Anonymous, true)
    const text = renderedText(<UserlabelGate />)
    expect(text).to.include(AppNotices.orSignInWithGoogle)
    expect(text).to.include('Sign in with Google')
  })

  it('offers nothing of Google where the deployment does not', () => {
    shownWith(Anonymous, false)
    expect(renderedText(<UserlabelGate />)).to.not.include('Google')
  })

  it("tells a visitor back from Google whom Google signed them in as, and offers the name and handle made from what Google sent", () => {
    shownWith(BackFromGoogle, true)
    const markup = renderToStaticMarkup(<UserlabelGate />)
    const text = renderedText(<UserlabelGate />)
    expect(text).to.include(googleGateNotice('flip@example.com').replaceAll("'", '&#x27;'))
    expect(text).to.include('Log in as flip_kromer_2')
    expect(text).to.not.include(AppNotices.orSignInWithGoogle)
    expect(markup).to.include('value="Flip Kromer"')
    expect(markup).to.include('value="flip_kromer_2"')
  })

  it("makes the handle from the Google name where no offered handle is free", () => {
    shownWith({ ...BackFromGoogle, suggested: { userlabel: null, title: 'Flip Kromer' } }, true)
    expect(renderedText(<UserlabelGate />)).to.include('Log in as flip_kromer')
  })
})
