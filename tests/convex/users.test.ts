import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { userForUserlabel } from '../../convex/reading'
import { RefusalNotices } from '../../src/lib/notices'
import { failurekindOf, noticeOf } from '../../src/lib/refusals'
import * as PA from '../../src/lib/vv/patterns'
import { BlankQuestionQty, Quiz } from '../../src/models/quiz'
import type { OwnUserT } from '../../src/models/user'
import { present } from '../support/present'
import { anonymousSession, anonymousUser, callerOf, googleUser, huntHolding, openTester, putOn, refusedAs, seedHunt, type Session, type Tester } from '../support/convex'
import { expectSound } from '../support/soundness'

/** Take the userlabel `userlabel` as the session `by` (the bare tester for no session), through the public function */
async function assume(by: Session | Tester, userlabel: string, title = '') {
  return await callerOf(by).mutation(api.users.perform, { action: { kind: 'assume_userlabel', userlabel, title } })
}

/** Retitle the user the session `by` is signed in as, through the public function */
async function retitle(by: Session | Tester, title: string) {
  return await callerOf(by).mutation(api.users.perform, { action: { kind: 'retitle_user', title } })
}

/** Every row of a table, for the tests that count them */
async function allOf<TN extends 'users' | 'hunts' | 'huntships'>(tt: Tester, tablename: TN) {
  return await tt.run(async (ctx) => await ctx.db.query(tablename).collect())
}

/** What `pending` rejected with; fails the test when it went through */
async function rejectionOf(pending: Promise<unknown>): Promise<unknown> {
  try {
    await pending
  } catch (err) {
    return err
  }
  throw new Error('expected a refusal, and the call went through')
}

/** One of our fields of the user `user_id`, which must be there: undefined until it is given one */
async function fieldOf(tt: Tester, user_id: Id<'users'>, fieldname: 'userlabel' | 'title'): Promise<string | undefined> {
  const user = await userOf(tt, user_id)
  return user[fieldname]
}

/** The user `user_id`, which must be there */
async function userOf(tt: Tester, user_id: Id<'users'>) {
  return present(await tt.run(async (ctx) => await ctx.db.get('users', user_id)), 'the user')
}

describe('users.perform: assume_userlabel', () => {
  it("gives the user a userlabel nobody holds, titled as asked, and makes it its sandbox, ~label/label, with it the one smith", async () => {
    const tt = openTester()
    const session = await anonymousSession(tt)
    expect(await assume(session, 'flip_kromer', 'Flip')).to.eq(session.user_id)
    const user = await userOf(tt, session.user_id)
    expect([user.userlabel, user.title, user.isAnonymous]).to.deep.eq(['flip_kromer', 'Flip', true])
    const [users, hunts, huntships] = [await allOf(tt, 'users'), await allOf(tt, 'hunts'), await allOf(tt, 'huntships')]
    expect(users).to.have.lengthOf(1)
    expect(hunts.map((hunt) => [hunt.orglabel, hunt.label, hunt.title])).to.deep.eq([['flip_kromer', 'flip_kromer', 'Flip Kromer']])
    expect(huntships.map((huntship) => [huntship.hunt_id, huntship.user_id, huntship.userlabel, huntship.usertitle, huntship.role])).to.deep.eq([[hunts[0]?._id, session.user_id, 'flip_kromer', 'Flip', 'smith']])
    await expectSound(tt)
  })

  it("makes the sandbox's first quiz, holding the blank questions every new quiz does, and lists the sandbox among the user's hunts", async () => {
    const tt = openTester()
    const session = await anonymousSession(tt)
    await assume(session, 'flip_kromer', 'Flip')
    const listed = await session.as.query(api.hunts.list, {})
    expect(listed.map((hunt) => [hunt.org, hunt.label, hunt.role])).to.deep.eq([['flip_kromer', 'flip_kromer', 'smith']])
    expect(listed[0]?.realms.map((realm) => [realm.label, realm.quizzes.map((quiz) => [quiz.label, quiz.title, quiz.locked])])).to.deep.eq([['home', [['flip_kromer', 'Flip Kromer', false]]]])
    const questions = await tt.run(async (ctx) => await ctx.db.query('questions').collect())
    expect(questions).to.have.lengthOf(BlankQuestionQty)
  })

  it("makes a user signed in with Google its sandbox too, as it takes its handle", async () => {
    const tt = openTester()
    const session = await anonymousSession(tt)
    await tt.run(async (ctx) => { await ctx.db.patch('users', session.user_id, { isAnonymous: false, email: 'flip@example.com' }) })
    await assume(session, 'flip_kromer', 'Flip')
    const listed = await session.as.query(api.hunts.list, {})
    expect(listed.map((hunt) => [hunt.org, hunt.label, hunt.role])).to.deep.eq([['flip_kromer', 'flip_kromer', 'smith']])
  })

  it("leaves an anonymous user its sandbox as its one hunt: making another is refused, as sealing refuses it", async () => {
    const tt = openTester()
    const session = await anonymousSession(tt)
    await assume(session, 'flip_kromer', 'Flip')
    expect(await refusedAs(session.as.mutation(api.hunts.performOuter, { action: { kind: 'new_hunt', label: 'flip_kromer' } }))).to.eq('sealedHunts')
    expect(await allOf(tt, 'hunts')).to.have.lengthOf(1)
  })

  it("refuses the handle, and makes no sandbox, when the app holds all the hunts it may: no user holds a handle taken here without one", async () => {
    const tt = openTester()
    await tt.run(async (ctx) => {
      for (let idx = 0; idx < PA.HuntsInApp.max; idx += 1) {
        await ctx.db.insert('hunts', { label: `hunt_${String(idx)}`, orglabel: 'seed_smith', title: '', branch: 'main' })
      }
    })
    const session = await anonymousSession(tt)
    expect(await refusedAs(assume(session, 'flip_kromer', 'Flip'))).to.eq('huntsFull')
    expect(await fieldOf(tt, session.user_id, 'userlabel')).to.be.undefined
    expect(await tt.run(async (ctx) => await ctx.db.query('hunts').withIndex('by_orglabel_and_label', (cvx) => cvx.eq('orglabel', 'flip_kromer')).collect())).to.deep.eq([])
  })

  it('titles the user after its userlabel when no title is given', async () => {
    const tt = openTester()
    const session = await anonymousSession(tt)
    await assume(session, 'quiet_otter', '  ')
    expect(await fieldOf(tt, session.user_id, 'title')).to.eq('Quiet Otter')
  })

  it('changes nothing when the user takes the userlabel it holds again', async () => {
    const tt = openTester()
    const session = await anonymousSession(tt)
    await assume(session, 'flip_kromer', 'Flip')
    const ante = await userOf(tt, session.user_id)
    expect(await assume(session, 'flip_kromer', 'Ignored')).to.eq(session.user_id)
    expect(await userOf(tt, session.user_id)).to.deep.eq(ante)
    expect(await allOf(tt, 'hunts')).to.have.lengthOf(1)
  })

  it('refuses a second userlabel: a userlabel is chosen once, and the first stays', async () => {
    const tt = openTester()
    const session = await anonymousSession(tt)
    await assume(session, 'flip_kromer', 'Flip')
    expect(await refusedAs(assume(session, 'quiet_otter'))).to.eq('userlabelSet')
    expect([await fieldOf(tt, session.user_id, 'userlabel'), await tt.run(async (ctx) => await userForUserlabel(ctx.db, 'quiet_otter'))]).to.deep.eq(['flip_kromer', null])
  })

  it('refuses a userlabel another user holds, saying what to do instead, and writes nothing', async () => {
    const tt = openTester()
    const [mine, theirs] = [await anonymousSession(tt), await anonymousSession(tt)]
    await assume(mine, 'flip_kromer', 'Flip')
    const err = await rejectionOf(assume(theirs, 'flip_kromer', 'Not Flip'))
    expect([failurekindOf(err), noticeOf(err)]).to.deep.eq(['userlabelClaimed', RefusalNotices.userlabelClaimed])
    expect(noticeOf(err)).to.match(/different one.*the browser where you first chose it/)
    expect(await fieldOf(tt, theirs.user_id, 'userlabel')).to.be.undefined
    expect(await allOf(tt, 'hunts')).to.have.lengthOf(1)
  })

  it('refuses a userlabel a ghosting holds, retired by a merge', async () => {
    const tt = openTester()
    const flip = await googleUser(tt, 'flip_kromer')
    await tt.run(async (ctx) => {
      const account = present(await ctx.db.query('authAccounts').first())
      await ctx.db.insert('ghostings', { userlabel: 'old_flip', user_id: flip.user_id, into_user_id: flip.user_id, account_id: account._id })
    })
    const session = await anonymousSession(tt)
    expect(await refusedAs(assume(session, 'old_flip'))).to.eq('userlabelClaimed')
    expect(await fieldOf(tt, session.user_id, 'userlabel')).to.be.undefined
  })

  it("refuses a userlabel a hunt carries as its address (its orglabel), held by no user: a stranger may not seem to own the hunts addressed ~label", async () => {
    const tt = openTester()
    await tt.run(async (ctx) => { await ctx.db.insert('hunts', { label: 'spring_hunt', orglabel: 'mrflip_hunts', title: '', branch: 'main' }) })
    const session = await anonymousSession(tt)
    expect(await refusedAs(assume(session, 'mrflip_hunts'))).to.eq('userlabelClaimed')
    expect(await fieldOf(tt, session.user_id, 'userlabel')).to.be.undefined
  })

  it('leaves one holder when two users take one new userlabel at once', async () => {
    const tt = openTester()
    const [mine, theirs] = [await anonymousSession(tt), await anonymousSession(tt)]
    const outcomes = await Promise.allSettled([assume(mine, 'fresh_name'), assume(theirs, 'fresh_name')])
    expect(outcomes.map((outcome) => outcome.status)).to.have.members(['fulfilled', 'rejected'])
    const users = await allOf(tt, 'users')
    expect(users.filter((user) => user.userlabel === 'fresh_name')).to.have.lengthOf(1)
    expect(await allOf(tt, 'hunts')).to.have.lengthOf(1)
  })

  it("refuses a userlabel too short to be one, and a word kept for the app's own use, writing nothing", async () => {
    const tt = openTester()
    const session = await anonymousSession(tt)
    await expect(assume(session, 'flo', 'Flo')).rejects.toThrow(/should have «4» or more/)
    await expect(assume(session, 'support', 'Help')).rejects.toThrow()
    expect(await fieldOf(tt, session.user_id, 'userlabel')).to.be.undefined
  })

  it('refuses a request with no session, writing nothing', async () => {
    const tt = openTester()
    expect(await refusedAs(assume(tt, 'flip_kromer'))).to.eq('notSignedIn')
    expect(await allOf(tt, 'users')).to.deep.eq([])
  })

  it('refuses a session Convex Auth no longer holds, as for no session at all', async () => {
    const tt = openTester()
    const session = await anonymousSession(tt)
    await tt.run(async (ctx) => {
      const [held] = await ctx.db.query('authSessions').collect()
      await ctx.db.delete('authSessions', present(held)._id)
    })
    expect(await refusedAs(assume(session, 'flip_kromer'))).to.eq('notSignedIn')
  })
})

describe('users.current', () => {
  it("is the session's user, by its userlabel and title, and never its email or anything else of its row", async () => {
    const tt = openTester()
    const flip = await googleUser(tt, 'flip_kromer')
    await retitle(flip, 'Flip')
    const { user } = present(await flip.as.query(api.users.current, {}))
    expect(user).to.deep.eq({ _id: flip.user_id, userlabel: 'flip_kromer', title: 'Flip' })
  })

  it('hands the session the actor the server sees in its requests, which the browser builds its claims on', async () => {
    const tt = openTester()
    const otter = await googleUser(tt, 'quiet_otter')
    const { user, actor } = present(await otter.as.query(api.users.current, {}))
    expect(actor).to.deep.eq({ kind: 'user', user_id: user._id, userlabel: 'quiet_otter', usertitle: 'Quiet Otter', admin: true, anonymous: false })
  })

  it('says so of an anonymous user, which sealing turns on', async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_otter')
    expect(present(await anon.as.query(api.users.current, {})).actor.anonymous).to.be.true
  })

  it('is null for a user holding no userlabel, and for a request with no session', async () => {
    const tt = openTester()
    await googleUser(tt, 'flip_kromer')
    const session = await anonymousSession(tt)
    expect([await session.as.query(api.users.current, {}), await tt.query(api.users.current, {})]).to.deep.eq([null, null])
  })
})

describe('users.perform: retitle_user', () => {
  it('retitles the user, keeping its userlabel', async () => {
    const tt = openTester()
    const otter = await googleUser(tt, 'quiet_otter')
    expect(await retitle(otter, 'Otto')).to.eq(otter.user_id)
    const user = await userOf(tt, otter.user_id)
    expect([user.userlabel, user.title]).to.deep.eq(['quiet_otter', 'Otto'])
  })

  it("rewrites the title every huntship of the user copies, on every hunt it is on, and no one else's", async () => {
    const tt = openTester()
    const one = await seedHunt(tt, huntHolding([Quiz.blank()]), { smith: 'quiet_otter' })
    const two = await seedHunt(tt, huntHolding([Quiz.blank()]), { smith: 'loud_heron' })
    await putOn(tt, two.open.hunt_id, one.smith.user_id, 'reviewer')
    await retitle(one.smith, 'Otto')
    const huntships = await allOf(tt, 'huntships')
    expect(huntships.map((row) => [row.userlabel, row.usertitle])).to.deep.eq([['quiet_otter', 'Otto'], ['loud_heron', 'Loud Heron'], ['quiet_otter', 'Otto']])
    await expectSound(tt)
  })

  it("rewrites a huntship's copy of the userlabel too, should it have drifted from the user's", async () => {
    const tt = openTester()
    const { open, smith } = await seedHunt(tt, huntHolding([Quiz.blank()]), { smith: 'quiet_otter' })
    await tt.run(async (ctx) => {
      const huntship = present(await ctx.db.query('huntships').withIndex('by_hunt_id', (cvx) => cvx.eq('hunt_id', open.hunt_id)).first())
      await ctx.db.patch('huntships', huntship._id, { userlabel: 'drifted_otter' })
    })
    await retitle(smith, 'Otto')
    const huntships = await allOf(tt, 'huntships')
    expect(huntships.map((row) => [row.userlabel, row.usertitle])).to.deep.eq([['quiet_otter', 'Otto']])
    await expectSound(tt)
  })

  it('lets an anonymous user retitle itself', async () => {
    const tt = openTester()
    const anon = await anonymousUser(tt, 'anon_otter')
    await retitle(anon, 'Otto')
    expect(await fieldOf(tt, anon.user_id, 'title')).to.eq('Otto')
  })

  it('refuses a user holding no userlabel, or a request with no session, writing nothing', async () => {
    const tt = openTester()
    const session = await anonymousSession(tt)
    expect([await refusedAs(retitle(session, 'Otto')), await refusedAs(retitle(tt, 'Otto'))]).to.deep.eq(['notIdentified', 'notSignedIn'])
    expect(await fieldOf(tt, session.user_id, 'title')).to.be.undefined
  })
})

describe("a user holding a userlabel the reserved list has kept since", () => {
  it("is put on no hunt by its userlabel, and makes none, as every userlabel is held to the whole list", async () => {
    const tt = openTester()
    const held = await googleUser(tt, 'kept_later')
    await tt.run(async (ctx) => {
      await ctx.db.patch('users', held.user_id, { userlabel: 'google_fan' })
    })
    const { act, open } = await seedHunt(tt, huntHolding([Quiz.blank()]))
    await expect(act({ kind: 'add_huntship', userlabel: 'google_fan', role: 'reviewer' })).rejects.toThrow(PA.UnreservedToplevel.msg)
    await expect(held.as.mutation(api.hunts.performOuter, { action: { kind: 'new_hunt', label: 'quiet_otter' } })).rejects.toThrow(PA.UnreservedToplevel.msg)
    const huntships = await tt.run(async (ctx) => await ctx.db.query('huntships').withIndex('by_hunt_id', (cvx) => cvx.eq('hunt_id', open.hunt_id)).collect())
    const hunts = await allOf(tt, 'hunts')
    expect([huntships.map((row) => row.userlabel), hunts.length]).to.deep.eq([['seed_smith'], 1])
  })
})

/** A fresh browser's session whose user Google has vouched for, holding no userlabel yet, with what Google sent: how a Google sign-in from the front door leaves one */
async function googleUnlabelled(tt: Tester, profile: { name?: string, email?: string }): Promise<Session> {
  const session = await anonymousSession(tt)
  await tt.run(async (ctx) => {
    await ctx.db.patch('users', session.user_id, { isAnonymous: false, ...profile })
    await ctx.db.insert('authAccounts', { userId: session.user_id, provider: 'google', providerAccountId: `google-sub-${session.user_id}` })
  })
  return session
}

/** What `by` is told of itself */
async function ownOf(by: Session | Tester) {
  return await callerOf(by).query(api.users.own, {})
}

/** One part of what `by` is told of itself; undefined when it is told nothing */
async function toldOf<KK extends keyof OwnUserT>(by: Session | Tester, part: KK): Promise<OwnUserT[KK] | undefined> {
  const own = await ownOf(by)
  return own?.[part]
}

describe('users.own', () => {
  it('is nothing for a request with no session', async () => {
    expect(await ownOf(openTester())).to.be.null
  })

  it('tells an anonymous user only that it is not signed in with Google', async () => {
    const tt = openTester()
    expect(await ownOf(await anonymousUser(tt, 'anon_alice'))).to.deep.eq({ google: false, email: null, suggested: null, nameChoice: null })
    expect(await ownOf(await anonymousSession(tt))).to.deep.eq({ google: false, email: null, suggested: null, nameChoice: null })
  })

  it('tells a user signed in with Google its own email, and no other', async () => {
    const tt = openTester()
    const [alice, bob] = [await googleUser(tt, 'alice_google'), await googleUser(tt, 'bob_google')]
    expect(await ownOf(alice)).to.deep.eq({ google: true, email: 'alice_google@example.com', suggested: null, nameChoice: null })
    expect(await toldOf(bob, 'email')).to.eq('bob_google@example.com')
  })

  it('offers a user signed in with Google holding no handle one from its Google name, titled with that name', async () => {
    const tt = openTester()
    const session = await googleUnlabelled(tt, { name: 'Flip Kromer', email: 'mrflip@example.com' })
    expect(await toldOf(session, 'suggested')).to.deep.eq({ userlabel: 'flip_kromer', title: 'Flip Kromer' })
  })

  it('offers the next that is free: past a userlabel a user holds, one a hunt is addressed by, and one a ghosting has retired', async () => {
    const tt = openTester()
    const holder = await googleUser(tt, 'flip_kromer')
    const { open } = await seedHunt(tt, huntHolding([Quiz.blank('One')]))
    await tt.run(async (ctx) => {
      const account = present(await ctx.db.query('authAccounts').first())
      // An address, which no user need hold: the hunt keeps it whoever its smiths are now
      await ctx.db.patch('hunts', open.hunt_id, { orglabel: 'mrflip' })
      await ctx.db.insert('ghostings', { userlabel: 'flip_kromer_2', user_id: holder.user_id, into_user_id: holder.user_id, account_id: account._id })
    })
    const session = await googleUnlabelled(tt, { name: 'Flip Kromer', email: 'mrflip@example.com' })
    expect(await toldOf(session, 'suggested')).to.deep.eq({ userlabel: 'flip_kromer_3', title: 'Flip Kromer' })
  })

  it('offers no handle when no suggestion is free, or Google sent nothing to make one of, but the title still', async () => {
    const tt = openTester()
    expect(await toldOf(await googleUnlabelled(tt, { name: 'Google Fan' }), 'suggested')).to.deep.eq({ userlabel: null, title: 'Google Fan' })
    expect(await toldOf(await googleUnlabelled(tt, {}), 'suggested')).to.deep.eq({ userlabel: null, title: '' })
  })

  it('offers a Google name longer than a title may be shortened to one, which the front door can then take as it is offered', async () => {
    const tt = openTester()
    const session = await googleUnlabelled(tt, { name: `Flip ${'Kromer '.repeat(14)}the Last` })
    const suggested = present(await toldOf(session, 'suggested'))
    expect(suggested.title).to.have.length.within(1, PA.Titleish.max)
    await assume(session, present(suggested.userlabel), suggested.title)
    expect(await fieldOf(tt, session.user_id, 'title')).to.eq(suggested.title)
  })

  it('tells a user a merge left a name choice which two handles it is between', async () => {
    const tt = openTester()
    const alice = await googleUser(tt, 'alice_google')
    await tt.run(async (ctx) => {
      const account = present(await ctx.db.query('authAccounts').withIndex('userIdAndProvider', (cvx) => cvx.eq('userId', alice.user_id).eq('provider', 'google')).unique())
      await ctx.db.insert('users', { isAnonymous: true, userlabel: 'anon_alice', merged: { into_user_id: alice.user_id, account_id: account._id } })
    })
    expect(await toldOf(alice, 'nameChoice')).to.deep.eq({ merged: { userlabel: 'anon_alice', title: 'Anon Alice' }, own: { userlabel: 'alice_google', title: 'Alice Google' } })
  })
})

/** What the front door is told of the userlabel `userlabel`, asked with no session */
async function holderOf(tt: Tester, userlabel: string) {
  return await tt.query(api.users.holder, { userlabel })
}

describe('users.holder', () => {
  it('is nothing for a userlabel nobody holds', async () => {
    expect(await holderOf(openTester(), 'fresh_name')).to.be.null
  })

  it('tells a verified account (signed in with Google) from a standalone one', async () => {
    const tt = openTester()
    await googleUser(tt, 'alice_google')
    await anonymousUser(tt, 'anon_alice')
    expect(await holderOf(tt, 'alice_google')).to.eq('verified')
    expect(await holderOf(tt, 'anon_alice')).to.eq('standalone')
  })

  it('says a userlabel a ghosting or a hunt\'s address keeps is kept, as no user holds it', async () => {
    const tt = openTester()
    const flip = await googleUser(tt, 'flip_kromer')
    await tt.run(async (ctx) => {
      const account = present(await ctx.db.query('authAccounts').first())
      await ctx.db.insert('ghostings', { userlabel: 'old_flip', user_id: flip.user_id, into_user_id: flip.user_id, account_id: account._id })
      await ctx.db.insert('hunts', { label: 'spring_hunt', orglabel: 'mrflip_hunts', title: '', branch: 'main' })
    })
    expect(await holderOf(tt, 'old_flip')).to.eq('kept')
    expect(await holderOf(tt, 'mrflip_hunts')).to.eq('kept')
  })

  it('refuses what is not a userlabel, which the front door never asks of', async () => {
    await expect(holderOf(openTester(), 'flo')).rejects.toThrow(/should have «4» or more/)
  })
})
