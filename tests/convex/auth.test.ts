import { afterAll, describe, expect, it, vi } from 'vitest'
import { api, internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { GoogleScope, googleKeyed } from '../../convex/auth'
import { anonymousSession, googleUser, openTester, type SessionTester, type Tester } from '../support/convex'
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

/** What Google sends of one person, as Convex Auth's Google provider hands it on */
const Profile = { email: 'flip@example.com', name: 'Flip Kromer', image: 'https://lh3.googleusercontent.com/a/flip' }

/**
 * A Google sign-in carried through Convex Auth's own `store`, as its routes would carry it, past
 * the part only Google can do: the browser `by` starts it (a verifier, holding its session, if it
 * has one), the sign-in route signs it, and the callback, once Google has said who the person is,
 * hands the account and profile to `userOAuth`, which calls our `createOrUpdateUser`. Nothing
 * reaches Google.
 *
 * @param by - The browser starting the sign-in: a session's caller, or the bare tester (no session).
 * @param sub - Google's account id for the person.
 */
async function signInWithGoogle(tt: Tester, by: SessionTester | Tester, sub: string): Promise<void> {
  const verifier: unknown = await by.mutation(internal.auth.store, { args: { type: 'verifier' } })
  if (typeof verifier !== 'string') { throw new TypeError('Convex Auth made no verifier') }
  const signature = `signature-of-${verifier}`
  await tt.mutation(internal.auth.store, { args: { type: 'verifierSignature', verifier, signature } })
  await tt.mutation(internal.auth.store, { args: { type: 'userOAuth', provider: 'google', providerAccountId: sub, profile: Profile, signature } })
}

/** The user Google's account `sub` belongs to, and every user there is */
async function accountUser(tt: Tester, sub: string): Promise<{ user_id: Id<'users'> | undefined, users: number }> {
  return await tt.run(async (ctx) => {
    const account = await ctx.db.query('authAccounts').withIndex('providerAndAccountId', (cvx) => cvx.eq('provider', 'google').eq('providerAccountId', sub)).unique()
    const users = await ctx.db.query('users').collect()
    return { user_id: account?.userId, users: users.length }
  })
}

describe('a Google sign-in, through Convex Auth', () => {
  it("hands our createOrUpdateUser the signing-in browser's user (the patch), so an anonymous browser is upgraded in place", async () => {
    const tt = openTester()
    const anon = await anonymousSession(tt)
    await signInWithGoogle(tt, anon.as, 'google-sub-flip')
    expect(await accountUser(tt, 'google-sub-flip')).to.deep.eq({ user_id: anon.user_id, users: 1 })
    const user = present(await tt.run(async (ctx) => await ctx.db.get('users', anon.user_id)))
    expect([user.isAnonymous, user.email]).to.deep.eq([false, Profile.email])
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
    await signInWithGoogle(tt, bob.as, 'google-sub-alice_google')
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
