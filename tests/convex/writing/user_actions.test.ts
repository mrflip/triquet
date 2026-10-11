import { describe, expect, it, vi } from 'vitest'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { membersOf, nameChoiceFor } from '../../../convex/reading'
import { triggers } from '../../../convex/triggers'
import { relabelUser, userForSignIn } from '../../../convex/writing/user_actions'
import { Hunt } from '../../../src/models/hunt'
import type { SignInDNA } from '../../../src/models/user'
import { anonymousSession, anonymousUser, expectRefusal, googleUser, openTester, seedHunt, type Session, type Tester } from '../../support/convex'
import { present } from '../../support/present'
import { expectSound } from '../../support/soundness'

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

/** What Google sends of one person, as Convex Auth's Google provider hands it on */
const Profile = { email: 'flip@example.com', name: 'Flip Kromer', image: 'https://lh3.googleusercontent.com/a/flip' }

/**
 * A Google sign-in as Convex Auth asks `createOrUpdateUser` for it: to the account of
 * `existingUserId` (null for a new account), from a browser signed in as `authUserId` (null for
 * none).
 */
function googleSignIn(existingUserId: Id<'users'> | null, authUserId: Id<'users'> | null, profile: Record<string, unknown> = Profile): SignInDNA {
  return { existingUserId, authUserId, provider: { id: 'google' }, profile }
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
    expect(await signedInAs(tt, googleSignIn(null, anon.user_id))).to.eq(anon.user_id)
    const user = await userRow(tt, anon.user_id)
    expect([user.isAnonymous, user.userlabel, user.email, user.name, user.image]).to.deep.eq([false, 'anon_alice', Profile.email, Profile.name, Profile.image])
    expect(await usersIn(tt)).to.have.lengthOf(1)
    expect(await membersByLabel(tt, sandbox_id)).to.deep.eq([['anon_alice', 'smith']])
    expect(await sessionsOf(tt, anon.user_id)).to.deep.eq([1, 0])
    const current = present(await anon.as.query(api.users.current, {}))
    expect(current.actor.anonymous).to.be.false
    await expectSound(tt)
  })

  it('upgrades an anonymous browser holding no userlabel in place, too', async () => {
    const tt = openTester()
    const anon = await anonymousSession(tt)
    expect(await signedInAs(tt, googleSignIn(null, anon.user_id))).to.eq(anon.user_id)
    const [user] = await userRows(tt, anon.user_id)
    expect(user?.isAnonymous).to.be.false
    expect(await usersIn(tt)).to.have.lengthOf(1)
  })

  it('makes a new user, signed in with Google and holding no userlabel, for a browser with no session', async () => {
    const tt = openTester()
    const user = await userRow(tt, await signedInAs(tt, googleSignIn(null, null)))
    expect([user.isAnonymous, user.userlabel, user.email, user.name]).to.deep.eq([false, undefined, Profile.email, Profile.name])
    expect([user.created_at, user.updated_at]).to.deep.eq([Math.floor(user._creationTime), Math.floor(user._creationTime)])
  })

  it('makes a new user for a browser signed in with Google as another user, which it leaves as it was: a second Google account is never linked', async () => {
    const tt = openTester()
    const alice = await googleUser(tt, 'alice_google')
    const ante = await userRow(tt, alice.user_id)
    const user_id = await signedInAs(tt, googleSignIn(null, alice.user_id))
    expect(user_id).not.to.eq(alice.user_id)
    const [made, aliceNow] = await userRows(tt, user_id, alice.user_id)
    expect([made?.userlabel, aliceNow]).to.deep.eq([undefined, ante])
  })

  it('makes a new user for an account sharing its email with another Google user: an email links nothing', async () => {
    const tt = openTester()
    const alice = await googleUser(tt, 'alice_google')
    const [aliceAnte] = await userRows(tt, alice.user_id)
    const shared = present(aliceAnte?.email)
    const user_id = await signedInAs(tt, googleSignIn(null, null, { ...Profile, email: shared }))
    expect(user_id).not.to.eq(alice.user_id)
    const [made, aliceNow] = await userRows(tt, user_id, alice.user_id)
    expect([made?.email, aliceNow?.userlabel]).to.deep.eq([shared, 'alice_google'])
    expect(await usersIn(tt)).to.have.lengthOf(2)
  })

  it('keeps only the email, name and picture of what Google sends', async () => {
    const tt = openTester()
    const user = await userRow(tt, await signedInAs(tt, googleSignIn(null, null, { ...Profile, locale: 'en', given_name: 'Flip', emailVerified: true, admin: true, userlabel: 'mrflip' })))
    expect(Object.keys(user).filter((field) => ! field.startsWith('_')).toSorted((aa, bb) => aa.localeCompare(bb))).to.deep.eq(['created_at', 'email', 'image', 'isAnonymous', 'name', 'updated_at'])
  })
})

describe('userForSignIn, with a known Google account', () => {
  it("returns the account's user to its own browser, or a browser with no session, bringing what Google sent up to date", async () => {
    const tt = openTester()
    const alice = await googleUser(tt, 'alice_google')
    expect(await signedInAs(tt, googleSignIn(alice.user_id, alice.user_id))).to.eq(alice.user_id)
    expect(await signedInAs(tt, googleSignIn(alice.user_id, null, { ...Profile, name: 'Alice Anew' }))).to.eq(alice.user_id)
    const user = await userRow(tt, alice.user_id)
    expect([user.userlabel, user.name, user.email, user.isAnonymous]).to.deep.eq(['alice_google', 'Alice Anew', Profile.email, false])
    expect(await usersIn(tt)).to.have.lengthOf(1)
  })

  it("switches a browser signed in with Google as another user to the account's user, merging neither: two Google users are never merged", async () => {
    const tt = openTester()
    const [alice, bob] = [await googleUser(tt, 'alice_google'), await googleUser(tt, 'bob_google')]
    const bobAnte = await userRow(tt, bob.user_id)
    expect(await signedInAs(tt, googleSignIn(alice.user_id, bob.user_id))).to.eq(alice.user_id)
    expect(await userRow(tt, bob.user_id)).to.deep.eq(bobAnte)
    const [aliceNow] = await userRows(tt, alice.user_id)
    expect([aliceNow?.merged, await sessionsOf(tt, bob.user_id)]).to.deep.eq([undefined, [1, 0]])
  })

  it("switches an anonymous browser holding no userlabel to the account's user, leaving the anonymous user as it was", async () => {
    const tt = openTester()
    const alice = await googleUser(tt, 'alice_google')
    const anon = await anonymousSession(tt)
    const anonAnte = await userRow(tt, anon.user_id)
    expect(await signedInAs(tt, googleSignIn(alice.user_id, anon.user_id))).to.eq(alice.user_id)
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
  return { tt, anon, sandbox_id, alice, account_id: account._id }
}

describe('userForSignIn, merging an anonymous browser holding a userlabel into a known Google account', () => {
  it("carries the account's user on, made smith of the sandbox in the anonymous user's place, the sandbox keeping its address", async () => {
    const { tt, anon, sandbox_id, alice } = await merging()
    expect(await signedInAs(tt, googleSignIn(alice.user_id, anon.user_id))).to.eq(alice.user_id)
    const sandbox = present(await tt.run(async (ctx) => await ctx.db.get('hunts', sandbox_id)))
    expect(await membersByLabel(tt, sandbox_id)).to.deep.eq([['alice_google', 'smith']])
    expect([sandbox.orglabel, sandbox.label]).to.deep.eq(['anon_alice', 'anon_alice'])
    await expectSound(tt)
  })

  it("marks the anonymous user merged, never deleting it, and deletes its sessions and their refresh tokens, and no one else's", async () => {
    const { tt, anon, alice, account_id } = await merging()
    await signedInAs(tt, googleSignIn(alice.user_id, anon.user_id))
    const gone = await userRow(tt, anon.user_id)
    expect([gone.merged, gone.isAnonymous]).to.deep.eq([{ into_user_id: alice.user_id, account_id }, true])
    expect([await sessionsOf(tt, anon.user_id), await sessionsOf(tt, alice.user_id)]).to.deep.eq([[0, 0], [1, 0]])
    expect(await anon.as.query(api.users.current, {})).to.be.null
  })

  it("records the name choice, the account's user's handle standing until it is made, and the browser's held from everyone else", async () => {
    const { tt, anon, alice } = await merging()
    await signedInAs(tt, googleSignIn(alice.user_id, anon.user_id))
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
    await signedInAs(tt, googleSignIn(alice.user_id, anon.user_id))
    const choice = await choiceOf(tt, alice.user_id)
    expect(choice?._id).to.eq(anon.user_id)
    expect(await sessionsOf(tt, anon.user_id)).to.deep.eq([0, 0])
  })

  it("hands the anonymous user's userlabel and title to an account's user holding none, with nothing to choose", async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_alice')
    const sandbox_id = await sandboxOf(anon)
    const heir_id = await googleUnlabelled(tt)
    expect(await signedInAs(tt, googleSignIn(heir_id, anon.user_id))).to.eq(heir_id)
    const [heir, gone] = [await userRow(tt, heir_id), await userRow(tt, anon.user_id)]
    expect([heir.userlabel, heir.title, gone.userlabel, gone.merged?.into_user_id]).to.deep.eq(['anon_alice', 'Anon Alice', undefined, heir_id])
    expect(await membersByLabel(tt, sandbox_id)).to.deep.eq([['anon_alice', 'smith']])
    expect(await choiceOf(tt, heir_id)).to.be.null
    await expectSound(tt)
  })

  it('never merges a Google user away: its browser is switched, as from any user signed in with Google', async () => {
    const { tt, anon, alice } = await merging()
    await signedInAs(tt, googleSignIn(alice.user_id, anon.user_id))
    const bob = await googleUser(tt, 'bob_google')
    expect(await signedInAs(tt, googleSignIn(bob.user_id, alice.user_id))).to.eq(bob.user_id)
    const rows = await userRows(tt, alice.user_id, bob.user_id)
    expect(rows.map((row) => row.merged)).to.deep.eq([undefined, undefined])
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
      await signedInAs(tt, googleSignIn(null, anon.user_id))
      expect(present(await anon.as.query(api.users.current, {})).actor.admin).to.be.true
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
