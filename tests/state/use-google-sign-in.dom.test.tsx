import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ConvexReactClient } from 'convex/react'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { UnsecuredJWT } from 'jose'
import type { AlarmT } from '../../src/lib/alarms'
import { GoogleSignInUnfinished, googleSignInUnfinishedNotice } from '../../src/lib/notices'
import { AlarmsProvider, useAlarm } from '../../src/state/alarms'
import { startGoogleSignIn, useGoogleSignInOutcome } from '../../src/state/use-google-sign-in'

/*
 * What a tab says once it is back from a Google sign-in it started: nothing when the sign-in
 * finished (a new session), and the unfinished notice when it did not (the same session, though
 * its token was refreshed meanwhile, as the Convex client refreshes one as a page loads). Convex
 * Auth's real provider, over a stand-in for the Convex client that answers a code's exchange as
 * the test says; the page's alarm read back from a probe.
 */

/** Where the stand-in client lives, and the namespace Convex Auth keeps its storage under */
const Address = 'https://stand-in.convex.cloud'
const Spaced = Address.replaceAll(/[^a-zA-Z0-9]/g, '')
const JwtKey = `__convexAuthJWT_${Spaced}`
const VerifierKey = `__convexAuthOAuthVerifier_${Spaced}`

/** Who this browser is, as the page has heard from the server */
const Me = { loaded: true, user: { userlabel: 'flip_kromer' } } as const

/** A token shaped as Convex Auth's are, of `subject` (`<user>|<session>`), issued at `issued` (seconds), unsigned: only its subject is read */
function tokenOf(subject: string, issued = 1000): string {
  return new UnsecuredJWT({ sub: subject }).setIssuedAt(issued).encode()
}

/** The tokens the stand-in answers a code's exchange with: a finished sign-in's, or none for one refused */
type ExchangedT = { token: string, refreshToken: string } | null

/** A stand-in for the Convex client, as far as Convex Auth's provider uses one: a code's exchange answered with `exchanged`, any token given to it accepted */
function standInClient(exchanged: ExchangedT): ConvexReactClient {
  const client = {
    address: Address,
    options: {},
    logger:  undefined,
    action:  () => Promise.resolve({ tokens: exchanged }),
    setAuth: (fetchToken: (args: { forceRefreshToken: boolean }) => Promise<string | null>, onChange: (accepted: boolean) => void) => {
      void fetchToken({ forceRefreshToken: false }).then((token) => { onChange(token !== null) })
    },
    clearAuth: () => { /* the stand-in holds no auth to clear */ },
  }
  return client as unknown as ConvexReactClient
}

/** The hook under test, and a probe of the alarm it raises, render by render */
function Outcome({ seen }: { seen: (AlarmT | null)[] }) {
  useGoogleSignInOutcome(Me)
  seen.push(useAlarm().alarm)
  return null
}

/** Let the provider's effects and the stand-in's promises run */
async function settle(): Promise<void> {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 20) }) })
}

/** Note in this tab, as a door does, that it left to sign in with Google as the session `token` is of */
async function leftAs(token: string): Promise<void> {
  await startGoogleSignIn(() => Promise.resolve({ signingIn: true }), { pathname: '/', search: '', hash: '' }, { token, storage: sessionStorage })
}

describe('useGoogleSignInOutcome, back from Google', () => {
  const held: { root: Root | null } = { root: null }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    act(() => { held.root?.unmount() })
    held.root = null
    vi.unstubAllGlobals()
    history.replaceState({}, '', '/')
  })

  /** Render the hook beneath Convex Auth's provider and the page's alarm at `path`, and hand back the alarm the probe saw last */
  async function rendered(path: string, exchanged: ExchangedT = null): Promise<AlarmT | null> {
    history.replaceState({}, '', path)
    const seen: (AlarmT | null)[] = []
    const root = createRoot(document.createElement('div'))
    held.root = root
    await act(async () => {
      root.render(<AlarmsProvider><ConvexAuthProvider client={standInClient(exchanged)}><Outcome seen={seen} /></ConvexAuthProvider></AlarmsProvider>)
      await Promise.resolve()
    })
    await settle()
    return seen.at(-1) ?? null
  }

  const Unfinished: AlarmT = { headline: GoogleSignInUnfinished, notice: googleSignInUnfinishedNotice('flip_kromer'), request_id: null }

  it("says the sign-in did not finish when the tab comes back on the session it left as, though in a token refreshed since, and clears the verifier Convex Auth left", async () => {
    await leftAs(tokenOf('anonymous_user|anonymous_session', 1000))
    localStorage.setItem(JwtKey, tokenOf('anonymous_user|anonymous_session', 2000))
    localStorage.setItem(VerifierKey, 'the-verifier')
    const alarm = await rendered('/~flip_kromer/quiet_otter')
    expect(alarm).to.deep.eq(Unfinished)
    expect([localStorage.getItem(VerifierKey), sessionStorage.length]).to.deep.eq([null, 0])
    expect(localStorage.getItem(JwtKey)).to.eq(tokenOf('anonymous_user|anonymous_session', 2000))
  })

  it("says so when the code's exchange is refused, and the patched client keeps the session it had", async () => {
    const before = tokenOf('anonymous_user|anonymous_session')
    await leftAs(before)
    localStorage.setItem(JwtKey, before)
    localStorage.setItem(VerifierKey, 'the-verifier')
    const alarm = await rendered('/~flip_kromer/quiet_otter?code=12345678', null)
    expect(alarm).to.deep.eq(Unfinished)
    expect([localStorage.getItem(JwtKey), localStorage.getItem(VerifierKey)]).to.deep.eq([before, null])
  })

  it("says nothing when the sign-in finished, the browser signed in to a new session, and takes the tab's note away", async () => {
    const before = tokenOf('anonymous_user|anonymous_session')
    await leftAs(before)
    localStorage.setItem(JwtKey, before)
    localStorage.setItem(VerifierKey, 'the-verifier')
    const google = tokenOf('google_user|google_session')
    const alarm = await rendered('/~flip_kromer/quiet_otter?code=12345678', { token: google, refreshToken: 'google-refresh' })
    expect(alarm).to.be.null
    expect([localStorage.getItem(JwtKey), sessionStorage.length]).to.deep.eq([google, 0])
  })

  it('says nothing, and leaves the verifier be, when no sign-in was started from this tab', async () => {
    localStorage.setItem(JwtKey, tokenOf('anonymous_user|anonymous_session'))
    localStorage.setItem(VerifierKey, 'another-tab-verifier')
    const alarm = await rendered('/~flip_kromer/quiet_otter')
    expect(alarm).to.be.null
    expect(localStorage.getItem(VerifierKey)).to.eq('another-tab-verifier')
  })
})
