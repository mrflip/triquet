import { afterAll, describe, expect, it, vi } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { GoogleScope, googleKeyed, returnUrlFor } from '../../convex/auth'
import { GoogleProfile as Profile, anonymousSession, googleCallback, googleUser, openTester, signInWithGoogle, type Tester } from '../support/convex'
import { present } from '../support/present'

// Google's keys, on this test's deployment, before `convex/auth.ts` is first loaded (hoisted above
// the imports): its provider list is made as it loads, as on a real deployment. Never real keys:
// nothing here reaches Google.
vi.hoisted(() => {
  vi.stubEnv('AUTH_GOOGLE_ID', 'test-google-client-id')
  vi.stubEnv('AUTH_GOOGLE_SECRET', 'test-google-client-secret')
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3599')
  vi.stubEnv('SITE_URL', 'http://localhost:3099')
})
afterAll(() => { vi.unstubAllEnvs() })

/** The user Google's account `sub` belongs to, and every user there is */
async function accountUser(tt: Tester, sub: string): Promise<{ user_id: Id<'users'> | undefined, users: number }> {
  return await tt.run(async (ctx) => {
    const account = await ctx.db.query('authAccounts').withIndex('providerAndAccountId', (cvx) => cvx.eq('provider', 'google').eq('providerAccountId', sub)).unique()
    const users = await ctx.db.query('users').collect()
    return { user_id: account?.userId, users: users.length }
  })
}

describe('a Google sign-in, through Convex Auth', () => {
  it("hands our createOrUpdateUser the starting browser's user at the code's exchange (the patch), so an anonymous browser is upgraded in place", async () => {
    const tt = openTester()
    const anon = await anonymousSession(tt)
    expect(await signInWithGoogle(tt, anon, 'google-sub-flip')).to.eq(anon.user_id)
    expect(await accountUser(tt, 'google-sub-flip')).to.deep.eq({ user_id: anon.user_id, users: 1 })
    const user = present(await tt.run(async (ctx) => await ctx.db.get('users', anon.user_id)))
    expect([user.isAnonymous, user.email]).to.deep.eq([false, Profile.email])
  })

  it("hands it no browser's user at Google's callback (the patch), where nothing proves which browser came back: a new account gets a provisional user", async () => {
    const tt = openTester()
    const anon = await anonymousSession(tt)
    await googleCallback(tt, anon, 'google-sub-flip')
    const { user_id, users } = await accountUser(tt, 'google-sub-flip')
    expect([user_id === anon.user_id, users]).to.deep.eq([false, 2])
    const provisional = present(await tt.run(async (ctx) => await ctx.db.get('users', present(user_id))))
    expect(provisional.provisional).to.be.true
  })

  it('makes a new user for a browser with no session', async () => {
    const tt = openTester()
    await signInWithGoogle(tt, tt, 'google-sub-flip')
    const { user_id, users } = await accountUser(tt, 'google-sub-flip')
    expect([user_id === undefined, users]).to.deep.eq([false, 1])
  })

  it("returns a known account's user to a browser signed in with Google as another, merging nobody", async () => {
    const tt = openTester()
    const [alice, bob] = [await googleUser(tt, 'alice_google'), await googleUser(tt, 'bob_google')]
    await signInWithGoogle(tt, bob, 'google-sub-alice_google')
    expect(await accountUser(tt, 'google-sub-alice_google')).to.deep.eq({ user_id: alice.user_id, users: 2 })
  })

  it('starts at Google, asking only for openid, email and profile', async () => {
    const tt = openTester()
    const started = await tt.action(api.auth.signIn, { provider: 'google', params: { redirectTo: '/' } })
    expect(present(started.redirect)).to.match(/^http:\/\/127\.0\.0\.1:3599\/api\/auth\/signin\/google\?code=/)
    expect(GoogleScope).to.eq('openid email profile')
  })
})

describe('auth.offered', () => {
  it('offers Google where both of its keys are set, and not where either is missing', async () => {
    const tt = openTester()
    expect(await tt.query(api.auth.offered, {})).to.deep.eq({ google: true })
    vi.stubEnv('AUTH_GOOGLE_SECRET', '')
    expect([await tt.query(api.auth.offered, {}), googleKeyed()]).to.deep.eq([{ google: false }, false])
    vi.stubEnv('AUTH_GOOGLE_SECRET', 'test-google-client-secret')
    vi.stubEnv('AUTH_GOOGLE_ID', '')
    expect(await tt.query(api.auth.offered, {})).to.deep.eq({ google: false })
    vi.stubEnv('AUTH_GOOGLE_ID', 'test-google-client-id')
  })
})

describe('the providers, on a deployment without Google', () => {
  it('lists only Anonymous, so a sign-in with Google is refused there', async () => {
    vi.stubEnv('AUTH_GOOGLE_ID', '')
    vi.resetModules()
    try {
      const tt = openTester()
      await expect(tt.action(api.auth.signIn, { provider: 'google', params: {} })).rejects.toThrow(/Provider `google` is not configured/)
    } finally {
      vi.stubEnv('AUTH_GOOGLE_ID', 'test-google-client-id')
      vi.resetModules()
    }
  })
})

describe('returnUrlFor, the redirect callback', () => {
  const Sent: [string, string, string][] = [
    ['/~pat_smith/quiet_otter?x=1',   'http://localhost:3099/~pat_smith/quiet_otter?x=1', 'a hunt, on the app'],
    ['/',                             'http://localhost:3099/',                           'the front door'],
  ]
  for (const [redirectTo, expected, describes] of Sent) {
    it(`sends back to ${describes}`, () => {
      expect(returnUrlFor(redirectTo)).to.eq(expected)
    })
  }

  const Refused: [string, string][] = [
    ['/privacy',                       'a page that opens no database, where a code would lie unspent'],
    ['/about',                         'About, likewise'],
    ['https://example.com/my/hunts',   'another site'],
    ['//example.com/my/hunts',         'another site, without its scheme'],
    ['http://localhost:3099/my/hunts', 'even the app, written absolute: only a path is taken'],
  ]
  for (const [redirectTo, describes] of Refused) {
    it(`refuses ${describes}`, () => {
      expect(() => returnUrlFor(redirectTo)).to.throw(/comes back only to a page that opens the database/)
    })
  }

  it("governs Google's callback route: a page that opens the database is where it sends the browser, any other it refuses", async () => {
    // Nothing reaches Google: its discovery document is refused, so the callback fails its sign-in and sends the browser back
    vi.stubGlobal('fetch', () => Promise.reject(new Error('No network in a unit test')))
    try {
      const tt = openTester()
      const callback = async (redirectTo: string) => await tt.fetch('/api/auth/callback/google', { headers: { Cookie: `googleRedirectTo=${encodeURIComponent(redirectTo)}` }, redirect: 'manual' })
      const sent = await callback('/my/hunts')
      expect([sent.status, sent.headers.get('Location')]).to.deep.eq([302, 'http://localhost:3099/my/hunts'])
      await expect(callback('/privacy')).rejects.toThrow(/comes back only to a page that opens the database/)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

