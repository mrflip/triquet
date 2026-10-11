import { describe, expect, it } from 'vitest'
import type { Id } from '../../../convex/_generated/dataModel'
import { triggers } from '../../../convex/triggers'
import { relabelUser, userForSignIn, type SignInT } from '../../../convex/writing/user_actions'
import { Hunt } from '../../../src/models/hunt'
import { anonymousSession, anonymousUser, googleUser, openTester, seedHunt, type Tester } from '../../support/convex'
import { present } from '../../support/present'
import { expectSound } from '../../support/soundness'

/** The user a sign-in comes to, as Convex Auth's `createOrUpdateUser` would be asked for it, through the database the triggers run on */
async function signedInAs(tt: Tester, signIn: SignInT): Promise<Id<'users'>> {
  return await tt.run(async (ctx) => await userForSignIn(triggers.wrapDB(ctx).db, signIn))
}

/** Every user, as the tests count them */
async function usersIn(tt: Tester) {
  return await tt.run(async (ctx) => await ctx.db.query('users').collect())
}

describe('userForSignIn', () => {
  it('makes a new anonymous user for a new anonymous account, holding no userlabel, its row stamped', async () => {
    const tt = openTester()
    const user_id = await signedInAs(tt, { existingUserId: null, provider: { id: 'anonymous' } })
    const user = present(await tt.run(async (ctx) => await ctx.db.get('users', user_id)))
    expect([user.isAnonymous, user.userlabel, user.title, user.admin]).to.deep.eq([true, undefined, undefined, undefined])
    expect([user.created_at, user.updated_at]).to.deep.eq([Math.floor(user._creationTime), Math.floor(user._creationTime)])
  })

  it('returns a returning account its own user, as it is, writing nothing', async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_alice')
    const ante = await usersIn(tt)
    expect(await signedInAs(tt, { existingUserId: anon.user_id, provider: { id: 'anonymous' } })).to.eq(anon.user_id)
    expect(await usersIn(tt)).to.deep.eq(ante)
  })

  it('refuses a new account of a provider no user is made for yet, writing nothing', async () => {
    const tt = openTester()
    await expect(signedInAs(tt, { existingUserId: null, provider: { id: 'google' } })).rejects.toThrow(/No user is made for a sign-in with google/)
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

  it('refuses a userlabel that is not one, or a reserved word, writing nothing', async () => {
    const tt = openTester()
    const { user_id } = await anonymousSession(tt)
    await expect(relabelled(tt, user_id, 'Mr Flip', '')).rejects.toThrow()
    await expect(relabelled(tt, user_id, 'support', '')).rejects.toThrow()
    const user = present(await tt.run(async (ctx) => await ctx.db.get('users', user_id)))
    expect(user.userlabel).to.be.undefined
  })
})
