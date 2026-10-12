import { describe, expect, it, vi } from 'vitest'
import type { ConvexAuthActionsContext } from '@convex-dev/auth/react'
import { fingerprintOf, forgetDeadSignIns, isUnfinished, returnPathOf, startGoogleSignIn, takeStarted } from '../../src/state/use-google-sign-in'

/** A browser's storage, held in a map: what a tab's session storage or local storage answers */
class HeldStorage implements Storage {
  readonly held = new Map<string, string>()
  get length(): number { return this.held.size }
  clear(): void { this.held.clear() }
  getItem(key: string): string | null { return this.held.get(key) ?? null }
  key(idx: number): string | null { return this.held.keys().toArray()[idx] ?? null }
  removeItem(key: string): void { this.held.delete(key) }
  setItem(key: string, val: string): void { this.held.set(key, val) }
}

describe('returnPathOf', () => {
  const Cases: [Pick<Location, 'pathname' | 'search' | 'hash'>, string, string][] = [
    [{ pathname: '/~flip_kromer/quiet_otter', search: '?q=1', hash: '' }, '/~flip_kromer/quiet_otter?q=1', 'a page with a query'],
    [{ pathname: '/', search: '', hash: '' },                             '/',                             'the front door'],
    [{ pathname: '/my/hunts', search: '', hash: '#top' },                 '/my/hunts#top',                 'a page with a fragment'],
    [{ pathname: '/privacy', search: '', hash: '' },                      '/',                             'the front door, for a page that does not open the database'],
  ]
  for (const [here, expected, describes] of Cases) {
    it(`is where to come back to: ${describes}`, () => {
      expect(returnPathOf(here)).to.eq(expected)
    })
  }
})

describe('startGoogleSignIn', () => {
  it('notes the session it leaves as, then signs in with Google, to come back to the page it started on', async () => {
    const signIn = vi.fn<ConvexAuthActionsContext['signIn']>(() => Promise.resolve({ signingIn: false }))
    const storage = new HeldStorage()
    await startGoogleSignIn(signIn, { pathname: '/~flip_kromer/quiet_otter', search: '', hash: '' }, { token: 'the-jwt', storage })
    expect(signIn.mock.calls).to.deep.eq([['google', { redirectTo: '/~flip_kromer/quiet_otter' }]])
    expect(takeStarted(storage)).to.eq(await fingerprintOf('the-jwt'))
  })

  it('takes its note back when the sign-in cannot start, so no later visit says a sign-in did not finish', async () => {
    const storage = new HeldStorage()
    const refused = vi.fn<ConvexAuthActionsContext['signIn']>(() => Promise.reject(new Error('the deployment could not be reached')))
    await expect(startGoogleSignIn(refused, { pathname: '/', search: '', hash: '' }, { token: 'the-jwt', storage })).rejects.toThrow('could not be reached')
    expect(takeStarted(storage)).to.be.null
  })
})

describe('takeStarted', () => {
  it('is the note a tab left as it started, once; then null', async () => {
    const storage = new HeldStorage()
    expect(takeStarted(storage)).to.be.null
    await startGoogleSignIn(() => Promise.resolve({ signingIn: false }), { pathname: '/', search: '', hash: '' }, { token: null, storage })
    expect([takeStarted(storage), takeStarted(storage)]).to.deep.eq(['none', null])
  })
})

describe('fingerprintOf', () => {
  it("is a token's SHA-256 in hex, never the token, and 'none' for no session", async () => {
    expect(await fingerprintOf(null)).to.eq('none')
    expect(await fingerprintOf('abc')).to.eq('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('isUnfinished', () => {
  it('is true while the session is the one the sign-in started from, and false once it is a new one', async () => {
    const started = await fingerprintOf('anonymous-jwt')
    expect([await isUnfinished(started, 'anonymous-jwt'), await isUnfinished(started, 'google-jwt'), await isUnfinished('none', null)]).to.deep.eq([true, false, true])
  })
})

describe('forgetDeadSignIns', () => {
  it("clears Convex Auth's leftover verifier, and nothing else", () => {
    const storage = new HeldStorage()
    storage.setItem('__convexAuthOAuthVerifier_httpsstandinconvexcloud', 'a-verifier')
    storage.setItem('__convexAuthJWT_httpsstandinconvexcloud', 'the-jwt')
    storage.setItem('hunt-history', 'kept')
    forgetDeadSignIns(storage)
    expect(storage.held.keys().toArray()).to.deep.eq(['__convexAuthJWT_httpsstandinconvexcloud', 'hunt-history'])
  })
})
