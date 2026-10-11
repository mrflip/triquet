import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { userForUserlabel } from '../../convex/reading'
import { RefusalNotices } from '../../src/lib/notices'
import { failurekindOf, noticeOf } from '../../src/lib/refusals'
import { Quiz } from '../../src/models/quiz'
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
  it('gives the user a userlabel nobody holds, titled as asked: one write to the user, and nothing else', async () => {
    const tt = openTester()
    const session = await anonymousSession(tt)
    expect(await assume(session, 'flip_kromer', 'Flip')).to.eq(session.user_id)
    const user = await userOf(tt, session.user_id)
    expect([user.userlabel, user.title, user.isAnonymous]).to.deep.eq(['flip_kromer', 'Flip', true])
    const users = await allOf(tt, 'users')
    expect([users.length, await allOf(tt, 'hunts'), await allOf(tt, 'huntships')]).to.deep.eq([1, [], []])
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
  })

  it("refuses a userlabel too short to be one, and a word kept for the app's own use, writing nothing", async () => {
    const tt = openTester()
    const session = await anonymousSession(tt)
    await expect(assume(session, 'flip', 'Flip')).rejects.toThrow(/should have «6» or more/)
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
