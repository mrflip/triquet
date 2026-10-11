import { describe, expect, it } from 'vitest'
import type { Id } from '../../../convex/_generated/dataModel'
import { triggers } from '../../../convex/triggers'
import { userForSignIn, type SignInT } from '../../../convex/writing/user_actions'
import { anonymousUser, openTester, type Tester } from '../../support/convex'
import { present } from '../../support/present'

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
