import { afterAll, describe, expect, it, vi } from 'vitest'
import * as EST from 'es-toolkit'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { GoogleScope, googleKeyed, googleProfileOf, returnUrlFor } from '../../convex/auth'
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

  it('answers every caller alike: no session, an anonymous one, or one signed in with Google', async () => {
    const tt = openTester()
    const [anon, flip] = [await anonymousSession(tt), await googleUser(tt, 'flip_kromer')]
    const answers = [await tt.query(api.auth.offered, {}), await anon.as.query(api.auth.offered, {}), await flip.as.query(api.auth.offered, {})]
    expect(answers).to.deep.eq([{ google: true }, { google: true }, { google: true }])
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
  const Cases: [string, string, string][] = [
    // pages that open the database, sent back to:
    ["/~pat_smith/quiet_otter?x=1",    "http://localhost:3099/~pat_smith/quiet_otter?x=1", 'a hunt, on the app'],
    ["/",                              "http://localhost:3099/",                           'the front door'],
    // anywhere else, never followed: the front door instead
    ["/privacy",                       "http://localhost:3099/",                           'a page that opens no database, where a code would lie unspent'],
    ["/about",                         "http://localhost:3099/",                           'About, likewise'],
    ["/h/x/y",                         "http://localhost:3099/",                           'a path beneath the synced pages that reaches none, where a code would lie unspent in a page not found'],
    ["https://example.com/my/hunts",   "http://localhost:3099/",                           'another site'],
    ["//example.com/my/hunts",         "http://localhost:3099/",                           'another site, without its scheme'],
    ["http://localhost:3099/my/hunts", "http://localhost:3099/",                           'even the app, written absolute: only a path is taken'],
  ]
  for (const [redirectTo, expected, describes] of Cases) {
    it(`sends ${redirectTo} back to ${expected}: ${describes}`, () => {
      expect(returnUrlFor(redirectTo)).to.eq(expected)
    })
  }

  it('refuses to send a sign-in anywhere from a deployment with no SITE_URL', () => {
    vi.stubEnv('SITE_URL', '')
    try {
      expect(() => returnUrlFor('/')).to.throw(/no SITE_URL/)
    } finally {
      vi.stubEnv('SITE_URL', 'http://localhost:3099')
    }
  })

  it("governs Google's callback route: a page that opens the database is where it sends the browser, and the front door in place of any other", async () => {
    // Nothing reaches Google: its discovery document is refused, so the callback fails its sign-in and sends the browser back
    vi.stubGlobal('fetch', () => Promise.reject(new Error('No network in a unit test')))
    try {
      const tt = openTester()
      const callback = async (redirectTo: string) => await tt.fetch('/api/auth/callback/google', { headers: { Cookie: `googleRedirectTo=${encodeURIComponent(redirectTo)}` }, redirect: 'manual' })
      const sent = await Promise.all(['/my/hunts', '/privacy', 'https://example.com/'].map(async (redirectTo) => await callback(redirectTo)))
      expect(sent.map((response) => [response.status, response.headers.get('Location')])).to.deep.eq([
        [302, "http://localhost:3099/my/hunts"],
        [302, "http://localhost:3099/"],
        [302, "http://localhost:3099/"],
      ])
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('googleProfileOf', () => {
  /** The claims of a Google ID token, as Google sends them for a Workspace account */
  const Claims = {
    sub: '109800000000000000001', aud: 'test-google-client-id', azp: 'test-google-client-id', iss: 'https://accounts.google.com', iat: 1_760_300_000, exp: 1_760_303_600,
    email: 'flip@example.com', email_verified: true, name: 'Flip Kromer', given_name: 'Flip', family_name: 'Kromer', picture: 'https://lh3.googleusercontent.com/a/flip', locale: 'en-GB', hd: 'example.com',
  }

  it("keeps the account's id, the email and when Google said it was verified, the name, picture, locale and Workspace domain, and nothing else", () => {
    expect(googleProfileOf(Claims)).to.deep.eq({
      id: Claims.sub, email: 'flip@example.com', emailVerificationTime: 1_760_300_000_000, name: 'Flip Kromer', image: Claims.picture, locale: 'en-GB', hosted_domain: 'example.com',
    })
  })

  it('keeps no verification for an email Google has not verified, and no locale or domain Google did not send', () => {
    const personal = EST.omit(Claims, ['locale', 'hd'])
    expect(googleProfileOf({ ...personal, email_verified: false })).to.deep.eq({ id: Claims.sub, email: 'flip@example.com', name: 'Flip Kromer', image: Claims.picture })
  })
})

describe("what a Google sign-in keeps of what Google said", () => {
  it('is brought up to date at every sign-in, and what Google no longer says is taken away', async () => {
    const tt = openTester()
    const said = { ...Profile, emailVerificationTime: 1_760_300_000_000, locale: 'en-GB', hosted_domain: 'example.com' }
    const user_id = present(await signInWithGoogle(tt, tt, 'google-sub-kept', said))
    const fieldsOf = async () => await tt.run(async (ctx) => {
      const user = present(await ctx.db.get('users', user_id))
      return [user.name, user.emailVerificationTime ?? null, user.locale ?? null, user.hosted_domain ?? null]
    })
    expect(await fieldsOf()).to.deep.eq(['Flip Kromer', 1_760_300_000_000, 'en-GB', 'example.com'])
    await signInWithGoogle(tt, tt, 'google-sub-kept', Profile)
    expect(await fieldsOf()).to.deep.eq(['Flip Kromer', null, null, null])
  })
})
