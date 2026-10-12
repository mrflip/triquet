import { describe, expect, it, vi } from 'vitest'
import type { ConvexAuthActionsContext } from '@convex-dev/auth/react'
import { UnsecuredJWT } from 'jose'
import { forgetDeadSignIns, isUnfinished, returnPathOf, sessionOf, startGoogleSignIn, takeStarted } from '../../src/state/use-google-sign-in'

/** A token shaped as Convex Auth's are, of `subject` (`<user>|<session>`), issued at `issued` (seconds), unsigned: only its subject is read */
function tokenOf(subject: string, issued = 1000): string {
  return new UnsecuredJWT({ sub: subject }).setIssuedAt(issued).encode()
}

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
    await startGoogleSignIn(signIn, { pathname: '/~flip_kromer/quiet_otter', search: '', hash: '' }, { token: tokenOf('user_a|session_a'), storage })
    expect(signIn.mock.calls).to.deep.eq([['google', { redirectTo: '/~flip_kromer/quiet_otter' }]])
    expect(takeStarted(storage)).to.eq('session_a')
  })

  it('takes its note back when the sign-in cannot start, so no later visit says a sign-in did not finish', async () => {
    const storage = new HeldStorage()
    const refused = vi.fn<ConvexAuthActionsContext['signIn']>(() => Promise.reject(new Error('the deployment could not be reached')))
    await expect(startGoogleSignIn(refused, { pathname: '/', search: '', hash: '' }, { token: tokenOf('user_a|session_a'), storage })).rejects.toThrow('could not be reached')
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

describe('sessionOf', () => {
  const Cases: [string | null, string, string][] = [
    [tokenOf("j97b|k57a"),        "k57a", "the session's id, after the user's in the subject"],
    [tokenOf("j97b|k57a", 2000), "k57a", 'the same, from the token refreshed'],
    [tokenOf("j97b|m12c"),        "m12c", "another session's, for the same user"],
    [null,                        "none", 'none, for no session'],
    [tokenOf("j97b"),             "none", 'none, for a subject naming no session'],
    ["garbage",                   "none", 'none, for a token that is no JWT'],
    ["",                          "none", 'none, for an empty token'],
    [new UnsecuredJWT({ sub: 5 } as unknown as { sub: string }).encode(), "none", 'none, for a subject that is no string'],
  ]
  for (const [token, expected, describes] of Cases) {
    it(`is ${describes}`, () => {
      expect(sessionOf(token)).to.eq(expected)
    })
  }
})

describe('isUnfinished', () => {
  it('is true while the session is the one the sign-in started from, refreshed or not, and false once it is a new one', () => {
    const started = sessionOf(tokenOf('anonymous_user|anonymous_session'))
    expect([
      isUnfinished(started, tokenOf('anonymous_user|anonymous_session')),
      isUnfinished(started, tokenOf('anonymous_user|anonymous_session', 2000)),
      isUnfinished(started, tokenOf('google_user|google_session')),
      isUnfinished('none', null),
    ]).to.deep.eq([true, true, false, true])
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
