import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ConvexReactClient } from 'convex/react'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { useSession } from '../../src/state/use-session'

/*
 * How Convex Auth's provider and `useSession` meet when a browser comes back from Google with
 * `?code=` in its address: the provider exchanges the code for the session Google's sign-in made,
 * holding `isLoading` until it has, and `useSession` waits on `isLoading`, so it never signs the
 * browser in anonymously over the top. The real provider, over a stand-in for the Convex client
 * that answers `auth:signIn` as the test says.
 */

/** A call to Convex Auth's `auth:signIn`, as the stand-in client was asked it */
type SignInCallT = { provider?: string, params?: { code?: string }, verifier?: string }

/** The stand-in client's answer to the code's exchange, which the test gives when it chooses */
type PendingT = {
  answer: (tokens: { token: string, refreshToken: string } | null) => void
  /** The exchange failing outright, as a network or server failure would */
  fail:   (err: Error) => void
}

/** Where the stand-in client lives, and the namespace Convex Auth keeps its storage under */
const Address = 'https://stand-in.convex.cloud'
const Spaced = Address.replaceAll(/[^a-zA-Z0-9]/g, '')

/**
 * A stand-in for the Convex client, as far as Convex Auth's provider uses one: `auth:signIn`
 * answered at once for an anonymous sign-in, and held for a code's exchange until the test answers
 * it; a token given to it reported as accepted.
 */
function standInClient(calls: SignInCallT[], pending: PendingT): ConvexReactClient {
  const client = {
    address: Address,
    options: {},
    logger:  undefined,
    action:  async (_fnname: string, args: SignInCallT) => {
      calls.push(args)
      if (args.provider === 'anonymous') { return { tokens: { token: 'anonymous-jwt', refreshToken: 'anonymous-refresh' } } }
      return await new Promise((resolve, reject) => {
        pending.answer = (tokens) => { resolve({ tokens }) }
        pending.fail = (err) => { reject(err) }
      })
    },
    setAuth: (fetchToken: (args: { forceRefreshToken: boolean }) => Promise<string | null>, onChange: (accepted: boolean) => void) => {
      void fetchToken({ forceRefreshToken: false }).then((token) => { onChange(token !== null) })
    },
    clearAuth: () => { /* the stand-in holds no auth to clear */ },
  }
  return client as unknown as ConvexReactClient
}

/** A call as the test reads it: the provider, or the code exchanged, and the verifier sent with it */
function told(call: SignInCallT): [string, string | null] {
  return [call.provider ?? `code ${String(call.params?.code)}`, call.verifier ?? null]
}

/** What a screen sees of the session, render by render */
function Probe({ seen }: { seen: boolean[] }) {
  seen.push(useSession().ready)
  return null
}

/** Let the provider's effects and the stand-in's promises run */
async function settle(): Promise<void> {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 20) }) })
}

describe('useSession, beside Convex Auth', () => {
  const held: { root: Root | null } = { root: null }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    localStorage.clear()
  })

  afterEach(() => {
    act(() => { held.root?.unmount() })
    held.root = null
    vi.unstubAllGlobals()
    history.replaceState({}, '', '/')
  })

  /** Render the provider over `Probe` at `path`, and hand back what it saw and asked */
  async function rendered(path: string) {
    history.replaceState({}, '', path)
    const calls: SignInCallT[] = []
    const pending: PendingT = { answer: () => { /* until the client is asked to exchange a code */ }, fail: () => { /* likewise */ } }
    const seen: boolean[] = []
    const root = createRoot(document.createElement('div'))
    held.root = root
    await act(async () => {
      root.render(<ConvexAuthProvider client={standInClient(calls, pending)}><Probe seen={seen} /></ConvexAuthProvider>)
      await Promise.resolve()
    })
    await settle()
    return { calls, pending, seen }
  }

  it('signs a browser with no session in anonymously, as every browser is at first', async () => {
    const { calls, seen } = await rendered('/')
    expect(calls.map((call) => told(call))).to.deep.eq([['anonymous', null]])
    expect(seen.at(-1)).to.be.true
  })

  it('never signs in anonymously while the code from Google is being exchanged, and is ready once it has been', async () => {
    localStorage.setItem(`__convexAuthJWT_${Spaced}`, 'the-anonymous-jwt-before')
    localStorage.setItem(`__convexAuthOAuthVerifier_${Spaced}`, 'the-verifier')
    const { calls, pending, seen } = await rendered('/~flip_kromer/quiet_otter?code=12345678')
    expect(calls.map((call) => told(call))).to.deep.eq([['code 12345678', 'the-verifier']])
    expect([location.search, seen.includes(true)]).to.deep.eq(['', false])
    await act(async () => {
      pending.answer({ token: 'google-jwt', refreshToken: 'google-refresh' })
      await Promise.resolve()
    })
    await settle()
    expect(calls).to.have.lengthOf(1)
    expect([seen.at(-1), localStorage.getItem(`__convexAuthJWT_${Spaced}`)]).to.deep.eq([true, 'google-jwt'])
  })

  it('keeps the session it had when the exchange is refused (our patch): no anonymous sign-in, the same stored session, the code and verifier gone', async () => {
    localStorage.setItem(`__convexAuthJWT_${Spaced}`, 'the-anonymous-jwt-before')
    localStorage.setItem(`__convexAuthRefreshToken_${Spaced}`, 'the-anonymous-refresh-before')
    localStorage.setItem(`__convexAuthOAuthVerifier_${Spaced}`, 'the-verifier')
    const { calls, pending, seen } = await rendered('/~flip_kromer/quiet_otter?code=12345678')
    await act(async () => {
      pending.answer(null)
      await Promise.resolve()
    })
    await settle()
    expect(calls.map((call) => told(call))).to.deep.eq([['code 12345678', 'the-verifier']])
    expect([seen.at(-1), location.search]).to.deep.eq([true, ''])
    expect([`__convexAuthJWT_${Spaced}`, `__convexAuthRefreshToken_${Spaced}`, `__convexAuthOAuthVerifier_${Spaced}`].map((key) => localStorage.getItem(key)))
      .to.deep.eq(['the-anonymous-jwt-before', 'the-anonymous-refresh-before', null])
  })

  it('keeps the session it had when the exchange fails outright (our patch), rather than loading for ever', async () => {
    localStorage.setItem(`__convexAuthJWT_${Spaced}`, 'the-anonymous-jwt-before')
    const { calls, pending, seen } = await rendered('/?code=12345678')
    await act(async () => {
      pending.fail(new Error('Server Error'))
      await Promise.resolve()
    })
    await settle()
    expect(calls.map((call) => told(call))).to.deep.eq([['code 12345678', null]])
    expect([seen.at(-1), localStorage.getItem(`__convexAuthJWT_${Spaced}`)]).to.deep.eq([true, 'the-anonymous-jwt-before'])
  })
})
