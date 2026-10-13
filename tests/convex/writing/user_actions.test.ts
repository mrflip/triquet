import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { membersOf, nameChoiceFor } from '../../../convex/reading'
import { triggers } from '../../../convex/triggers'
import { relabelUser, userForSignIn } from '../../../convex/writing/user_actions'
import { Hunt } from '../../../src/models/hunt'
import type { SignInDNA } from '../../../src/models/user'
import {
  GoogleProfile as Profile, anonymousSession, anonymousUser, exchangeCode, expectRefusal, googleCallback, googleFinish, googleStart, googleUser, openTester, seedHunt, signInWithGoogle, type Session, type Tester,
} from '../../support/convex'
import { present } from '../../support/present'
import { expectSound } from '../../support/soundness'

// Google's keys, before `convex/auth.ts` loads (hoisted above the imports), so its provider list
// holds Google, as a keyed deployment's does. Placeholders: nothing here reaches Google.
vi.hoisted(() => {
  vi.stubEnv('AUTH_GOOGLE_ID', 'test-google-client-id')
  vi.stubEnv('AUTH_GOOGLE_SECRET', 'test-google-client-secret')
})

/** The user a sign-in comes to, as Convex Auth's `createOrUpdateUser` would be asked for it, through the database the triggers run on */
async function signedInAs(tt: Tester, signIn: SignInDNA): Promise<Id<'users'>> {
  return await tt.run(async (ctx) => await userForSignIn(triggers.wrapDB(ctx).db, signIn))
}

/** Every user, as the tests count them */
async function usersIn(tt: Tester) {
  return await tt.run(async (ctx) => await ctx.db.query('users').collect())
}

/** The user `user_id`'s row as it now stands */
async function userRow(tt: Tester, user_id: Id<'users'>): Promise<Doc<'users'>> {
  return present(await tt.run(async (ctx) => await ctx.db.get('users', user_id)), 'the user')
}

/** The rows of the users `user_ids` as they now stand, in that order */
async function userRows(tt: Tester, ...user_ids: Id<'users'>[]): Promise<Doc<'users'>[]> {
  return await Promise.all(user_ids.map(async (user_id) => await userRow(tt, user_id)))
}

/** The name choice `user_id` has yet to make, by the user merged into it, if any */
async function choiceOf(tt: Tester, user_id: Id<'users'>): Promise<Doc<'users'> | null> {
  return await tt.run(async (ctx) => await nameChoiceFor(ctx.db, user_id))
}

/** Google's account id for a person whose account no user has yet */
const NewSub = 'google-sub-new'

/** The user the Google account `sub` belongs to, if any */
async function accountUser(tt: Tester, sub: string): Promise<Id<'users'> | undefined> {
  const account = await tt.run(async (ctx) => await ctx.db.query('authAccounts').withIndex('providerAndAccountId', (cvx) => cvx.eq('provider', 'google').eq('providerAccountId', sub)).unique())
  return account?.userId
}

/** A user signed in with Google holding no userlabel yet, with its Google account: how a Google sign-in from a browser with no session leaves one */
async function googleUnlabelled(tt: Tester): Promise<Id<'users'>> {
  return await tt.run(async (ctx) => {
    const user_id = await ctx.db.insert('users', { isAnonymous: false, email: 'nolabel@example.com' })
    await ctx.db.insert('authAccounts', { userId: user_id, provider: 'google', providerAccountId: 'google-sub-nolabel' })
    return user_id
  })
}

/** `anon`'s sandbox, made through the public function, as an anonymous user makes its one hunt */
async function sandboxOf(anon: Session & { label: string }): Promise<Id<'hunts'>> {
  return await anon.as.mutation(api.hunts.performOuter, { action: { kind: 'new_hunt', label: anon.label } })
}

/** Give each of `user_id`'s sessions a refresh token, as a browser that has kept its session holds one */
async function refreshed(tt: Tester, user_id: Id<'users'>): Promise<void> {
  await tt.run(async (ctx) => {
    const sessions = await ctx.db.query('authSessions').withIndex('userId', (cvx) => cvx.eq('userId', user_id)).collect()
    for (const session of sessions) {
      await ctx.db.insert('authRefreshTokens', { sessionId: session._id, expirationTime: Date.now() + 60_000 })
    }
  })
}

/** How many sessions `user_id` has, and how many refresh tokens they hold */
async function sessionsOf(tt: Tester, user_id: Id<'users'>): Promise<[number, number]> {
  return await tt.run(async (ctx) => {
    const sessions = await ctx.db.query('authSessions').withIndex('userId', (cvx) => cvx.eq('userId', user_id)).collect()
    const tokens = await Promise.all(sessions.map(async (session) => await ctx.db.query('authRefreshTokens').withIndex('sessionId', (cvx) => cvx.eq('sessionId', session._id)).collect()))
    return [sessions.length, tokens.flat().length]
  })
}

/** How many refresh tokens there are, whoever's session they were given to, a deleted one's included */
async function refreshTokensIn(tt: Tester): Promise<number> {
  const tokens = await tt.run(async (ctx) => await ctx.db.query('authRefreshTokens').collect())
  return tokens.length
}

/** Who is on `hunt_id`, by userlabel and role */
async function membersByLabel(tt: Tester, hunt_id: Id<'hunts'>): Promise<[string, string][]> {
  const members = await tt.run(async (ctx) => await membersOf(ctx.db, hunt_id))
  return members.map((member) => [member.label, member.role])
}

describe('userForSignIn, anonymously', () => {
  it('makes a new anonymous user for a new anonymous account, holding no userlabel, its row stamped', async () => {
    const tt = openTester()
    const user = await userRow(tt, await signedInAs(tt, { existingUserId: null, provider: { id: 'anonymous' } }))
    expect([user.isAnonymous, user.userlabel, user.title, user.admin]).to.deep.eq([true, undefined, undefined, undefined])
    expect([user.created_at, user.updated_at]).to.deep.eq([Math.floor(user._creationTime), Math.floor(user._creationTime)])
  })

  it('returns a returning account its own user, as it is, writing nothing', async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_alice')
    const ante = await usersIn(tt)
    expect(await signedInAs(tt, { existingUserId: anon.user_id, authUserId: null, provider: { id: 'anonymous' } })).to.eq(anon.user_id)
    expect(await usersIn(tt)).to.deep.eq(ante)
  })

  it('refuses a sign-in with a provider no user is made for, writing nothing', async () => {
    const tt = openTester()
    await expect(signedInAs(tt, { existingUserId: null, provider: { id: 'github' } })).rejects.toThrow(/No user is made for a sign-in with github/)
    expect(await usersIn(tt)).to.deep.eq([])
  })

  it('refuses what is not a sign-in at all, writing nothing', async () => {
    const tt = openTester()
    await expect(signedInAs(tt, { existingUserId: 'not an id', provider: { id: 'anonymous' } })).rejects.toThrow()
    await expect(signedInAs(tt, { existingUserId: null } as SignInDNA)).rejects.toThrow()
    expect(await usersIn(tt)).to.deep.eq([])
  })
})

/** Relabel the user `user_id` as `adopt:perform` does, through the database the triggers run on, and how many huntships' copies it rewrote */
async function relabelled(tt: Tester, user_id: Id<'users'>, userlabel: string, title: string): Promise<number> {
  return await tt.run(async (ctx) => await relabelUser(triggers.wrapDB(ctx).db, user_id, userlabel, title))
}

describe('relabelUser', () => {
  it('gives a user holding no userlabel one, its title the userlabel titleized when blank', async () => {
    const tt = openTester()
    const { user_id } = await anonymousSession(tt)
    expect(await relabelled(tt, user_id, 'mrflip', '')).to.eq(0)
    const user = present(await tt.run(async (ctx) => await ctx.db.get('users', user_id)))
    expect([user.userlabel, user.title]).to.deep.eq(['mrflip', 'Mrflip'])
  })

  it("relabels and retitles a user on three hunts, rewriting each huntship's copies, and moves no hunt's address", async () => {
    const tt = openTester()
    for (const label of ['quiet_otter', 'loud_heron', 'brisk_finch']) { await seedHunt(tt, Hunt.blank(label), { smith: 'flippy_kromer' }) }
    const flippy = await googleUser(tt, 'flippy_kromer')
    expect(await relabelled(tt, flippy.user_id, 'mrflip', 'Flip')).to.eq(3)
    const huntships = await tt.run(async (ctx) => await ctx.db.query('huntships').collect())
    expect(huntships.map((huntship) => [huntship.userlabel, huntship.usertitle])).to.deep.eq([['mrflip', 'Flip'], ['mrflip', 'Flip'], ['mrflip', 'Flip']])
    const hunts = await tt.run(async (ctx) => await ctx.db.query('hunts').collect())
    expect(hunts.map((hunt) => hunt.orglabel)).to.deep.eq(['flippy_kromer', 'flippy_kromer', 'flippy_kromer'])
    await expectSound(tt)
  })

  it('rewrites nothing that already matches', async () => {
    const tt = openTester()
    const { smith } = await seedHunt(tt, Hunt.blank('quiet_otter'), { smith: 'flippy_kromer' })
    expect(await relabelled(tt, smith.user_id, 'flippy_kromer', 'Flippy Kromer')).to.eq(0)
  })

  it('keeps the userlabel a user holds, though a word reserved since would refuse it, retitling it alone', async () => {
    const tt = openTester()
    const { user_id } = await anonymousSession(tt)
    await tt.run(async (ctx) => { await ctx.db.patch('users', user_id, { userlabel: 'handles', title: 'Handles' }) })
    expect(await relabelled(tt, user_id, 'handles', 'Handy')).to.eq(0)
    const user = present(await tt.run(async (ctx) => await ctx.db.get('users', user_id)))
    expect([user.userlabel, user.title]).to.deep.eq(['handles', 'Handy'])
    await expect(relabelled(tt, user_id, 'sessions', '')).rejects.toThrow()
  })

  it('refuses a userlabel that is not one, or a reserved word, writing nothing', async () => {
    const tt = openTester()
    const { user_id } = await anonymousSession(tt)
    await expect(relabelled(tt, user_id, 'Mr Flip', '')).rejects.toThrow()
    await expect(relabelled(tt, user_id, 'support', '')).rejects.toThrow()
    const user = present(await tt.run(async (ctx) => await ctx.db.get('users', user_id)))
    expect(user.userlabel).to.be.undefined
  })
})

describe('userForSignIn, with a new Google account', () => {
  it('upgrades an anonymous browser in place: the account joins its user, which keeps its userlabel, sandbox and session, and is no longer anonymous', async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_alice')
    const sandbox_id = await sandboxOf(anon)
    expect(await signInWithGoogle(tt, anon, NewSub)).to.eq(anon.user_id)
    const user = await userRow(tt, anon.user_id)
    expect([user.isAnonymous, user.userlabel, user.email, user.name, user.image, user.provisional]).to.deep.eq([false, 'anon_alice', Profile.email, Profile.name, Profile.image, undefined])
    const users = await usersIn(tt)
    expect([await accountUser(tt, NewSub), users.length]).to.deep.eq([anon.user_id, 1])
    expect(await membersByLabel(tt, sandbox_id)).to.deep.eq([['anon_alice', 'smith']])
    const current = present(await anon.as.query(api.users.current, {}))
    expect(current.actor.anonymous).to.be.false
    await expectSound(tt)
  })

  it('upgrades an anonymous browser holding no userlabel in place, too', async () => {
    const tt = openTester()
    const anon = await anonymousSession(tt)
    expect(await signInWithGoogle(tt, anon, NewSub)).to.eq(anon.user_id)
    const [user] = await userRows(tt, anon.user_id)
    expect(user?.isAnonymous).to.be.false
    expect(await usersIn(tt)).to.have.lengthOf(1)
  })

  it('makes a new user, signed in with Google and holding no userlabel, for a browser with no session', async () => {
    const tt = openTester()
    const user = await userRow(tt, present(await signInWithGoogle(tt, tt, NewSub)))
    expect([user.isAnonymous, user.userlabel, user.email, user.name, user.provisional]).to.deep.eq([false, undefined, Profile.email, Profile.name, undefined])
    expect(user.created_at).to.eq(Math.floor(user._creationTime))
  })

  it('makes a new user for a browser signed in with Google as another user, which it leaves as it was: a second Google account is never linked', async () => {
    const tt = openTester()
    const alice = await googleUser(tt, 'alice_google')
    const ante = await userRow(tt, alice.user_id)
    const user_id = present(await signInWithGoogle(tt, alice, NewSub))
    expect(user_id).not.to.eq(alice.user_id)
    const [made, aliceNow] = await userRows(tt, user_id, alice.user_id)
    expect([made?.userlabel, aliceNow]).to.deep.eq([undefined, ante])
  })

  it('makes a new user for an account sharing its email with another Google user: an email links nothing', async () => {
    const tt = openTester()
    const alice = await googleUser(tt, 'alice_google')
    const [aliceAnte] = await userRows(tt, alice.user_id)
    const shared = present(aliceAnte?.email)
    const user_id = present(await signInWithGoogle(tt, tt, NewSub, { ...Profile, email: shared }))
    expect(user_id).not.to.eq(alice.user_id)
    const [made, aliceNow] = await userRows(tt, user_id, alice.user_id)
    expect([made?.email, aliceNow?.userlabel]).to.deep.eq([shared, 'alice_google'])
    expect(await usersIn(tt)).to.have.lengthOf(2)
  })

  it('keeps only the email, when it was verified, the name, picture, locale and Workspace domain of what Google sends', async () => {
    const tt = openTester()
    const sent = { ...Profile, emailVerificationTime: 1_760_300_000_000, locale: 'en', hosted_domain: 'example.com', given_name: 'Flip', emailVerified: true, admin: true, userlabel: 'mrflip' }
    const user = await userRow(tt, present(await signInWithGoogle(tt, tt, NewSub, sent)))
    expect(Object.keys(user).filter((field) => ! field.startsWith('_')).toSorted((aa, bb) => aa.localeCompare(bb))).to.deep.eq(['created_at', 'email', 'emailVerificationTime', 'hosted_domain', 'image', 'isAnonymous', 'locale', 'name', 'updated_at'])
  })
})

describe('userForSignIn, with a known Google account', () => {
  it("returns the account's user to its own browser, or a browser with no session, bringing what Google sent up to date", async () => {
    const tt = openTester()
    const alice = await googleUser(tt, 'alice_google')
    expect(await signInWithGoogle(tt, alice, 'google-sub-alice_google')).to.eq(alice.user_id)
    expect(await signInWithGoogle(tt, tt, 'google-sub-alice_google', { ...Profile, name: 'Alice Anew' })).to.eq(alice.user_id)
    const user = await userRow(tt, alice.user_id)
    expect([user.userlabel, user.name, user.email, user.isAnonymous]).to.deep.eq(['alice_google', 'Alice Anew', Profile.email, false])
    expect(await usersIn(tt)).to.have.lengthOf(1)
  })

  it("switches a browser signed in with Google as another user to the account's user, merging neither: two Google users are never merged", async () => {
    const tt = openTester()
    const [alice, bob] = [await googleUser(tt, 'alice_google'), await googleUser(tt, 'bob_google')]
    const bobAnte = await userRow(tt, bob.user_id)
    expect(await signInWithGoogle(tt, bob, 'google-sub-alice_google')).to.eq(alice.user_id)
    expect(await userRow(tt, bob.user_id)).to.deep.eq(bobAnte)
    const [aliceNow] = await userRows(tt, alice.user_id)
    expect([aliceNow?.merged, await sessionsOf(tt, bob.user_id)]).to.deep.eq([undefined, [1, 0]])
  })

  it("switches an anonymous browser holding no userlabel to the account's user, leaving the anonymous user as it was", async () => {
    const tt = openTester()
    const alice = await googleUser(tt, 'alice_google')
    const anon = await anonymousSession(tt)
    const anonAnte = await userRow(tt, anon.user_id)
    expect(await signInWithGoogle(tt, anon, 'google-sub-alice_google')).to.eq(alice.user_id)
    expect(await userRow(tt, anon.user_id)).to.deep.eq(anonAnte)
    expect(await choiceOf(tt, alice.user_id)).to.be.null
  })
})

/** An anonymous user with its sandbox and a kept session, and a Google user whose account its browser signs in to */
async function merging() {
  const tt = openTester()
  const anon = await anonymousUser(tt, 'anon_alice')
  await anon.as.mutation(api.users.perform, { action: { kind: 'retitle_user', title: 'Alice of the Sandbox' } })
  const sandbox_id = await sandboxOf(anon)
  await refreshed(tt, anon.user_id)
  const alice = await googleUser(tt, 'alice_google')
  const account = present(await tt.run(async (ctx) => await ctx.db.query('authAccounts').withIndex('userIdAndProvider', (cvx) => cvx.eq('userId', alice.user_id).eq('provider', 'google')).unique()))
  return { tt, anon, sandbox_id, alice, account_id: account._id, sub: 'google-sub-alice_google' }
}

describe('userForSignIn, merging an anonymous browser holding a userlabel into a known Google account', () => {
  it("carries the account's user on, made smith of the sandbox in the anonymous user's place, the sandbox keeping its address", async () => {
    const { tt, anon, sandbox_id, alice, sub } = await merging()
    expect(await signInWithGoogle(tt, anon, sub)).to.eq(alice.user_id)
    const sandbox = present(await tt.run(async (ctx) => await ctx.db.get('hunts', sandbox_id)))
    expect(await membersByLabel(tt, sandbox_id)).to.deep.eq([['alice_google', 'smith']])
    expect([sandbox.orglabel, sandbox.label]).to.deep.eq(['anon_alice', 'anon_alice'])
    await expectSound(tt)
  })

  it("marks the anonymous user merged, never deleting it, and deletes its sessions and their refresh tokens, and no one else's", async () => {
    const { tt, anon, alice, account_id, sub } = await merging()
    expect([await sessionsOf(tt, anon.user_id), await refreshTokensIn(tt)]).to.deep.eq([[1, 1], 1])
    await signInWithGoogle(tt, anon, sub)
    const gone = await userRow(tt, anon.user_id)
    expect([gone.merged, gone.isAnonymous]).to.deep.eq([{ into_user_id: alice.user_id, account_id }, true])
    // Alice's own session, and the one the exchange signed the merged browser in with
    expect([await sessionsOf(tt, anon.user_id), await sessionsOf(tt, alice.user_id), await refreshTokensIn(tt)]).to.deep.eq([[0, 0], [2, 0], 0])
    expect(await anon.as.query(api.users.current, {})).to.be.null
  })

  it("records the name choice, the account's user's handle standing until it is made, and the browser's held from everyone else", async () => {
    const { tt, anon, alice, sub } = await merging()
    await signInWithGoogle(tt, anon, sub)
    const choice = present(await choiceOf(tt, alice.user_id))
    expect([choice._id, choice.userlabel, choice.title]).to.deep.eq([anon.user_id, 'anon_alice', 'Alice of the Sandbox'])
    const [aliceNow] = await userRows(tt, alice.user_id)
    expect(aliceNow?.userlabel).to.eq('alice_google')
    const other = await anonymousSession(tt)
    await expectRefusal(other.as.mutation(api.users.perform, { action: { kind: 'assume_userlabel', userlabel: 'anon_alice', title: '' } }), 'userlabelClaimed')
  })

  it('records the choice for an anonymous user with no sandbox, too', async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_bob')
    const alice = await googleUser(tt, 'alice_google')
    await signInWithGoogle(tt, anon, 'google-sub-alice_google')
    const choice = await choiceOf(tt, alice.user_id)
    expect(choice?._id).to.eq(anon.user_id)
    expect(await sessionsOf(tt, anon.user_id)).to.deep.eq([0, 0])
  })

  it("hands the anonymous user's userlabel and title to an account's user holding none, with nothing to choose", async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_alice')
    const sandbox_id = await sandboxOf(anon)
    const heir_id = await googleUnlabelled(tt)
    expect(await signInWithGoogle(tt, anon, 'google-sub-nolabel')).to.eq(heir_id)
    const [heir, gone] = [await userRow(tt, heir_id), await userRow(tt, anon.user_id)]
    expect([heir.userlabel, heir.title, gone.userlabel, gone.merged?.into_user_id]).to.deep.eq(['anon_alice', 'Anon Alice', undefined, heir_id])
    expect(await membersByLabel(tt, sandbox_id)).to.deep.eq([['anon_alice', 'smith']])
    expect(await choiceOf(tt, heir_id)).to.be.null
    await expectSound(tt)
  })

  it('never merges a Google user away: its browser is switched, as from any user signed in with Google', async () => {
    const { tt, anon, alice, sub } = await merging()
    await signInWithGoogle(tt, anon, sub)
    const bob = await googleUser(tt, 'bob_google')
    expect(await signInWithGoogle(tt, alice, 'google-sub-bob_google')).to.eq(bob.user_id)
    const rows = await userRows(tt, alice.user_id, bob.user_id)
    expect(rows.map((row) => row.merged)).to.deep.eq([undefined, undefined])
  })
})

describe('userForSignIn, when the browser finishing a Google sign-in did not start it', () => {
  // The attack: a browser starts a sign-in and sends its link to someone, whose browser finishes
  // it at Google with their own account. Their browser holds the code Google sent it, but not the
  // verifier the starting browser kept, which holds the code's starter alone.

  it('touches nothing of the starting browser\'s user at Google\'s callback, for a new account or a known one', async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_mallory')
    await googleUser(tt, 'alice_google')
    const ante = await userRow(tt, anon.user_id)
    await googleCallback(tt, anon, NewSub)
    await googleCallback(tt, anon, 'google-sub-alice_google')
    expect(await userRow(tt, anon.user_id)).to.deep.eq(ante)
  })

  it('refuses the upgrade: the starting anonymous user stays anonymous and gets no account, and the code is spent', async () => {
    const tt = openTester()
    const mallory = await anonymousUser(tt, 'anon_mallory')
    const sandbox_id = await sandboxOf(mallory)
    const ante = await userRow(tt, mallory.user_id)
    const { verifier, code } = await googleCallback(tt, mallory, NewSub)
    expect(await exchangeCode(tt, code, undefined)).to.be.null
    expect(await userRow(tt, mallory.user_id)).to.deep.eq(ante)
    expect(await accountUser(tt, NewSub)).not.to.eq(mallory.user_id)
    expect(await membersByLabel(tt, sandbox_id)).to.deep.eq([['anon_mallory', 'smith']])
    // The starter, holding its verifier, cannot use a code its browser was never sent, nor this one now
    expect(await exchangeCode(tt, code, verifier)).to.be.null
    expect(await userRow(tt, mallory.user_id)).to.deep.eq(ante)
  })

  it('refuses the merge: the starting anonymous user keeps its sandbox, sessions and handle, and nothing is merged into the account\'s user', async () => {
    const { tt, anon, sandbox_id, alice, sub } = await merging()
    const anonAnte = await userRow(tt, anon.user_id)
    const { code } = await googleCallback(tt, anon, sub)
    expect(await exchangeCode(tt, code, undefined)).to.be.null
    const [anonNow, aliceNow] = await userRows(tt, anon.user_id, alice.user_id)
    expect([anonNow, aliceNow?.userlabel, aliceNow?.merged]).to.deep.eq([anonAnte, 'alice_google', undefined])
    expect([await membersByLabel(tt, sandbox_id), await sessionsOf(tt, anon.user_id), await choiceOf(tt, alice.user_id)]).to.deep.eq([[['anon_alice', 'smith']], [1, 1], null])
  })

  it('leaves a new account its provisional user, which a later sign-in from the account holder\'s own anonymous browser folds away', async () => {
    const tt = openTester()
    const mallory = await anonymousUser(tt, 'anon_mallory')
    const { code } = await googleCallback(tt, mallory, NewSub)
    expect(await exchangeCode(tt, code, undefined)).to.be.null
    const provisional = present(await accountUser(tt, NewSub))
    const left = await userRow(tt, provisional)
    expect(left.provisional).to.be.true
    const alice = await anonymousUser(tt, 'anon_alice')
    expect(await signInWithGoogle(tt, alice, NewSub)).to.eq(alice.user_id)
    expect([await accountUser(tt, NewSub), await tt.run(async (ctx) => await ctx.db.get('users', provisional))]).to.deep.eq([alice.user_id, null])
  })
})

/** How many verifiers and codes Convex Auth holds, whoever's sign-ins they were */
async function flowsIn(tt: Tester): Promise<[number, number]> {
  const [verifiers, codes] = await tt.run(async (ctx) => [await ctx.db.query('authVerifiers').collect(), await ctx.db.query('authVerificationCodes').collect()])
  return [verifiers.length, codes.length]
}

/** Let `minutes` pass on the clock Convex's functions read */
function pass(minutes: number): void {
  vi.setSystemTime(Date.now() + (minutes * 60_000))
}

/** How a sign-in started by `starter` stands, so a test can say it was left exactly as it was */
async function standingOf(tt: Tester, starter: Session, sandbox_id: Id<'hunts'>) {
  return { row: await userRow(tt, starter.user_id), sessions: await sessionsOf(tt, starter.user_id), members: await membersByLabel(tt, sandbox_id), current: await starter.as.query(api.users.current, {}) }
}

describe("a Google sign-in's verifier, bounded to its start, and dying with its code", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })

  it('refuses an upgrade whose sign-in started past the bound, leaving the browser\'s anonymous user exactly as it was', async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_alice')
    const sandbox_id = await sandboxOf(anon)
    await refreshed(tt, anon.user_id)
    const ante = await standingOf(tt, anon, sandbox_id)
    const verifier = await googleStart(anon)
    pass(16)
    const code = await googleFinish(tt, verifier, NewSub)
    expect(await exchangeCode(tt, code, verifier)).to.be.null
    expect(await standingOf(tt, anon, sandbox_id)).to.deep.eq(ante)
    expect(await flowsIn(tt)).to.deep.eq([0, 0])
  })

  it('refuses a merge whose sign-in started past the bound the same way, recording no name choice', async () => {
    const { tt, anon, sandbox_id, alice, sub } = await merging()
    const ante = await standingOf(tt, anon, sandbox_id)
    const verifier = await googleStart(anon)
    pass(16)
    expect(await exchangeCode(tt, await googleFinish(tt, verifier, sub), verifier)).to.be.null
    expect([await standingOf(tt, anon, sandbox_id), await choiceOf(tt, alice.user_id)]).to.deep.eq([ante, null])
  })

  it('upgrades within the bound, as ever', async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_alice')
    const verifier = await googleStart(anon)
    pass(14)
    expect(await exchangeCode(tt, await googleFinish(tt, verifier, NewSub), verifier)).to.eq(anon.user_id)
    expect(await flowsIn(tt)).to.deep.eq([0, 0])
  })

  it('deletes the verifier when its code is presented with the wrong one', async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_alice')
    const { code } = await googleCallback(tt, anon, NewSub)
    expect(await flowsIn(tt)).to.deep.eq([1, 1])
    expect(await exchangeCode(tt, code, undefined)).to.be.null
    expect(await flowsIn(tt)).to.deep.eq([0, 0])
  })

  it('deletes the verifier when its code has expired, leaving the browser as it was', async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_alice')
    const ante = await userRow(tt, anon.user_id)
    const { verifier, code } = await googleCallback(tt, anon, NewSub)
    pass(3)
    expect(await exchangeCode(tt, code, verifier)).to.be.null
    expect([await flowsIn(tt), await userRow(tt, anon.user_id)]).to.deep.eq([[0, 0], ante])
  })

  it("deletes the verifier of a code a later callback for the same account replaced, and keeps the later one's", async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_alice')
    const first = await googleCallback(tt, anon, NewSub)
    const second = await googleCallback(tt, tt, NewSub)
    expect(await flowsIn(tt)).to.deep.eq([1, 1])
    expect(await exchangeCode(tt, first.code, first.verifier)).to.be.null
    expect(await exchangeCode(tt, second.code, second.verifier)).not.to.be.null
    expect(await flowsIn(tt)).to.deep.eq([0, 0])
  })

  it('leaves the provisional user of a refused sign-in with no session, nobody signed in as it', async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_alice')
    const { code } = await googleCallback(tt, anon, NewSub)
    expect(await exchangeCode(tt, code, undefined)).to.be.null
    const provisional = present(await accountUser(tt, NewSub))
    expect(await sessionsOf(tt, provisional)).to.deep.eq([0, 0])
  })
})

describe('userForSignIn, asked at neither step of a Google sign-in', () => {
  it('refuses, writing nothing', async () => {
    const tt = openTester()
    await expect(signedInAs(tt, { existingUserId: null, provider: { id: 'google' }, type: 'credentials' })).rejects.toThrow(/not asked for its user at credentials/)
    expect(await usersIn(tt)).to.deep.eq([])
  })
})

describe('the admin flag, through a sign-in', () => {
  it("counts for nothing on an anonymous user, and for an admin once its browser signs in with Google and upgrades it", async () => {
    vi.stubEnv('TRIQUET_EVERYONE_ADMIN', '')
    try {
      const tt = openTester()
      const anon = await anonymousUser(tt, 'anon_alice')
      await tt.run(async (ctx) => { await ctx.db.patch('users', anon.user_id, { admin: true }) })
      expect(present(await anon.as.query(api.users.current, {})).actor.admin).to.be.false
      await signInWithGoogle(tt, anon, NewSub)
      expect(present(await anon.as.query(api.users.current, {})).actor.admin).to.be.true
    } finally {
      vi.stubEnv('TRIQUET_EVERYONE_ADMIN', 'yes')
    }
  })
})

/** The userlabel the user `user_id` holds now, if any */
async function userlabelOf(tt: Tester, user_id: Id<'users'>): Promise<string | undefined> {
  const user = await userRow(tt, user_id)
  return user.userlabel
}

/** The handle the name choice pending for `user_id` asks about, if any */
async function choiceLabelOf(tt: Tester, user_id: Id<'users'>): Promise<string | undefined> {
  const choice = await choiceOf(tt, user_id)
  return choice?.userlabel
}

/** Settle `by`'s name choice of the handle `merged`, keeping `keep`, through the public function */
async function settle(by: Session, merged: string, keep: string) {
  return await by.as.mutation(api.users.perform, { action: { kind: 'settle_name_choice', merged, keep } })
}

/** Every ghosting, as the tests read them: the handle retired, who held it, into whom */
async function ghostingsIn(tt: Tester) {
  const ghostings = await tt.run(async (ctx) => await ctx.db.query('ghostings').collect())
  return ghostings.map(({ userlabel, user_id, into_user_id, account_id }) => ({ userlabel, user_id, into_user_id, account_id }))
}

/** A merge carried out (`merging`, then the sign-in), leaving Alice a name choice: `anon_alice`, which the merged browser went by, or her own `alice_google` */
async function choosing() {
  const merge = await merging()
  await signInWithGoogle(merge.tt, merge.anon, merge.sub)
  return merge
}

describe('settleNameChoice, through users.perform', () => {
  it("keeps the user's own handle: the merged browser's is taken from the user merged away and retired, and no address moves", async () => {
    const { tt, anon, alice, account_id, sandbox_id } = await choosing()
    expect(await settle(alice, 'anon_alice', 'alice_google')).to.eq(alice.user_id)
    const [aliceNow, gone] = await userRows(tt, alice.user_id, anon.user_id)
    expect([aliceNow?.userlabel, gone?.userlabel, gone?.merged?.into_user_id]).to.deep.eq(['alice_google', undefined, alice.user_id])
    expect(await ghostingsIn(tt)).to.deep.eq([{ userlabel: 'anon_alice', user_id: anon.user_id, into_user_id: alice.user_id, account_id }])
    expect(await choiceOf(tt, alice.user_id)).to.be.null
    const sandbox = present(await tt.run(async (ctx) => await ctx.db.get('hunts', sandbox_id)))
    expect([sandbox.orglabel, sandbox.label, await membersByLabel(tt, sandbox_id)]).to.deep.eq(['anon_alice', 'anon_alice', [['alice_google', 'smith']]])
    await expectSound(tt)
  })

  it("keeps the merged browser's handle: the user is relabelled and retitled with it, its huntships' copies follow, and its own is retired", async () => {
    const { tt, anon, alice, account_id, sandbox_id } = await choosing()
    const own = await seedHunt(tt, Hunt.blank('quiet_otter'), { smith: 'alice_google' })
    expect(await settle(alice, 'anon_alice', 'anon_alice')).to.eq(alice.user_id)
    const [aliceNow, gone] = await userRows(tt, alice.user_id, anon.user_id)
    expect([aliceNow?.userlabel, aliceNow?.title, gone?.userlabel]).to.deep.eq(['anon_alice', 'Alice of the Sandbox', undefined])
    expect(await ghostingsIn(tt)).to.deep.eq([{ userlabel: 'alice_google', user_id: alice.user_id, into_user_id: alice.user_id, account_id }])
    expect([await membersByLabel(tt, sandbox_id), await membersByLabel(tt, own.open.hunt_id)]).to.deep.eq([[['anon_alice', 'smith']], [['anon_alice', 'smith']]])
    // Addresses never change: the hunt Alice made as alice_google stays at ~alice_google
    const ownHunt = present(await tt.run(async (ctx) => await ctx.db.get('hunts', own.open.hunt_id)))
    expect(ownHunt.orglabel).to.eq('alice_google')
    expect(present(await alice.as.query(api.users.current, {})).user.userlabel).to.eq('anon_alice')
    await expectSound(tt)
  })

  it('leaves the handle not kept for nobody else to take', async () => {
    const { tt, alice } = await choosing()
    await settle(alice, 'anon_alice', 'anon_alice')
    const other = await anonymousSession(tt)
    await expectRefusal(other.as.mutation(api.users.perform, { action: { kind: 'assume_userlabel', userlabel: 'alice_google', title: '' } }), 'userlabelClaimed')
  })

  it("keeps a merged browser's handle that a word reserved since would refuse to anyone claiming it now", async () => {
    const { tt, alice, account_id } = await choosing()
    // A handle claimed before `handles` was kept for the app's own use
    await tt.run(async (ctx) => { await ctx.db.insert('users', { isAnonymous: true, userlabel: 'handles', title: 'Handles', merged: { into_user_id: alice.user_id, account_id } }) })
    await settle(alice, 'handles', 'handles')
    expect(await userlabelOf(tt, alice.user_id)).to.eq('handles')
    await expectSound(tt)
  })

  it('brings the next pending choice up once one is settled', async () => {
    const { tt, alice, account_id } = await choosing()
    const zed_id = await tt.run(async (ctx) => await ctx.db.insert('users', { isAnonymous: true, userlabel: 'zed_anon', title: 'Zed', merged: { into_user_id: alice.user_id, account_id } }))
    expect(await choiceLabelOf(tt, alice.user_id)).to.eq('anon_alice')
    await settle(alice, 'zed_anon', 'alice_google')
    expect(await choiceLabelOf(tt, alice.user_id)).to.eq('anon_alice')
    await settle(alice, 'anon_alice', 'anon_alice')
    expect(await choiceOf(tt, alice.user_id)).to.be.null
    expect(await userlabelOf(tt, zed_id)).to.be.undefined
    await expectSound(tt)
  })

  it('refuses a choice already settled, as from another tab, writing nothing more', async () => {
    const { tt, alice } = await choosing()
    await settle(alice, 'anon_alice', 'alice_google')
    const ante = await ghostingsIn(tt)
    await expectRefusal(settle(alice, 'anon_alice', 'anon_alice'), 'nameChoiceGone')
    expect([await userlabelOf(tt, alice.user_id), await ghostingsIn(tt)]).to.deep.eq(['alice_google', ante])
  })

  it('refuses a handle to keep that is neither of the two', async () => {
    const { tt, alice } = await choosing()
    await googleUser(tt, 'bob_google')
    await expectRefusal(settle(alice, 'anon_alice', 'bob_google'), 'nameChoiceGone')
    expect(await choiceOf(tt, alice.user_id)).to.not.be.null
  })

  it("refuses to settle another user's choice", async () => {
    const { tt, alice } = await choosing()
    const bob = await googleUser(tt, 'bob_google')
    await expectRefusal(settle(bob, 'anon_alice', 'bob_google'), 'nameChoiceGone')
    expect(await choiceOf(tt, alice.user_id)).to.not.be.null
  })

  it('refuses a user holding no userlabel', async () => {
    const { tt, alice } = await choosing()
    const nobody = await anonymousSession(tt)
    await expectRefusal(settle(nobody, 'anon_alice', 'anon_alice'), 'notIdentified')
    expect(await choiceOf(tt, alice.user_id)).to.not.be.null
  })
})
