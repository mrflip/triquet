import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import { huntForLabel, identForLabel, realmsOf } from '../../convex/reading'
import { RefusalNotices } from '../../src/lib/notices'
import { failurekindOf, noticeOf } from '../../src/lib/refusals'
import { Hunt } from '../../src/models/hunt'
import { HomeRealmLabel } from '../../src/models/realm'
import { BlankQuestionQty, Quiz } from '../../src/models/quiz'
import { mintId } from '../../src/lib/ids'
import * as PA from '../../src/lib/vv/patterns'
import { present } from '../support/present'
import { callerOf, huntHolding, identified, openTester, putOn, refusedAs, seedHunt, signedIn, wholeHunt, type Session, type Tester } from '../support/convex'
import { expectSound } from '../support/soundness'

/** Assert the username `label` as the session `by` (the bare tester for no session), through the public function */
async function assume(by: Session | Tester, label: string, title = '') {
  return await callerOf(by).mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label, title } })
}

/** Retitle the ident the session `by` is now, through the public function */
async function retitle(by: Session | Tester, title: string) {
  return await callerOf(by).mutation(api.idents.performAccount, { action: { kind: 'retitle_ident', title } })
}

/** Make a hunt labelled `label` through the public function, as the session `by`, or as a fresh ident's session */
async function makeHunt(tt: Tester, label: string, by?: Session | Tester) {
  const maker = by ?? await identified(tt, `maker_${mintId().slice(-8)}`)
  return await callerOf(maker).mutation(api.idents.performAccount, { action: { kind: 'new_hunt', label } })
}

/** Every row of a table, for the tests that count them */
async function allOf<TN extends 'idents' | 'identings' | 'hunts' | 'huntings'>(tt: Tester, tablename: TN) {
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

/** The ident answering to `label`, which must be there */
async function identLabelled(tt: Tester, label: string) {
  return present(await tt.run(async (ctx) => await identForLabel(ctx.db, label)), `the ident ${label}`)
}

describe('idents.performAccount: assume_ident', () => {
  it('makes an ident nobody goes by yet, titled as asked and held by this session, and records the session taking it on', async () => {
    const tt = openTester()
    const session = await signedIn(tt)
    const ident_id = await assume(session, 'flip_kromer', 'Flip')
    const ident = await identLabelled(tt, 'flip_kromer')
    const identings = await allOf(tt, 'identings')
    expect([ident._id, ident.title, ident.user_id]).to.deep.eq([ident_id, 'Flip', session.user_id])
    expect(identings.map((row) => [row.user_id, row.ident_id])).to.deep.eq([[session.user_id, ident_id]])
  })

  it('titles a new ident after its label when no title is given', async () => {
    const tt = openTester()
    await assume(await signedIn(tt), 'quiet_otter', '  ')
    const ident = await identLabelled(tt, 'quiet_otter')
    expect(ident.title).to.eq('Quiet Otter')
  })

  it('takes on again an ident this session holds, rather than making a second', async () => {
    const tt = openTester()
    const session = await signedIn(tt)
    const first = await assume(session, 'flip_kromer', 'Flip')
    const again = await assume(session, 'flip_kromer', 'Ignored')
    const [idents, identings] = [await allOf(tt, 'idents'), await allOf(tt, 'identings')]
    expect([again, idents.map((row) => row.title), identings.length]).to.deep.eq([first, ['Flip'], 2])
  })

  it('claims an ident nobody holds yet, made before usernames were held', async () => {
    const tt = openTester()
    await tt.run(async (ctx) => { await ctx.db.insert('idents', { label: 'old_timer', title: 'Old Timer', user_id: null }) })
    const session = await signedIn(tt)
    await assume(session, 'old_timer')
    const idents = await allOf(tt, 'idents')
    expect(idents.map((row) => row.user_id)).to.deep.eq([session.user_id])
  })

  it('refuses a username another session holds, saying what to do instead, and writes nothing', async () => {
    const tt = openTester()
    const [mine, theirs] = [await signedIn(tt), await signedIn(tt)]
    await assume(mine, 'flip_kromer', 'Flip')
    const ante = await identLabelled(tt, 'flip_kromer')
    const err = await rejectionOf(assume(theirs, 'flip_kromer', 'Not Flip'))
    expect([failurekindOf(err), noticeOf(err)]).to.deep.eq(['usernameClaimed', RefusalNotices.usernameClaimed])
    expect(noticeOf(err)).to.match(/different one.*create an account on the device/)
    expect(await identLabelled(tt, 'flip_kromer')).to.deep.eq(ante)
    const identings = await allOf(tt, 'identings')
    expect(identings.map((row) => row.user_id)).to.deep.eq([mine.user_id])
  })

  it('leaves one holder when a second session asserts a new username the first just took', async () => {
    const tt = openTester()
    const [mine, theirs] = [await signedIn(tt), await signedIn(tt)]
    const pending = [assume(mine, 'fresh_name'), assume(theirs, 'fresh_name')]
    const outcomes = await Promise.allSettled(pending)
    expect(outcomes.map((outcome) => outcome.status)).to.have.members(['fulfilled', 'rejected'])
    const idents = await allOf(tt, 'idents')
    expect(idents.map((row) => row.label)).to.deep.eq(['fresh_name'])
  })

  it('lets one session hold two usernames, the newer being who it is now', async () => {
    const tt = openTester()
    const session = await signedIn(tt)
    await assume(session, 'flip_kromer')
    await assume(session, 'quiet_otter')
    const idents = await allOf(tt, 'idents')
    expect(idents.map((row) => row.user_id)).to.deep.eq([session.user_id, session.user_id])
    expect(present(await session.as.query(api.idents.current, {})).ident).to.deep.include({ label: 'quiet_otter' })
  })

  it('refuses a label too short to be an ident\'s, writing nothing', async () => {
    const tt = openTester()
    await expect(assume(await signedIn(tt), 'flip', 'Flip')).rejects.toThrow(/should have «6» or more/)
    expect(await allOf(tt, 'identings')).to.deep.eq([])
  })

  it('refuses a request with no session, writing nothing', async () => {
    const tt = openTester()
    expect(await refusedAs(assume(tt, 'flip_kromer'))).to.eq('notSignedIn')
    expect([await allOf(tt, 'idents'), await allOf(tt, 'identings')]).to.deep.eq([[], []])
  })

  it('refuses a session Convex Auth no longer holds, as for no session at all', async () => {
    const tt = openTester()
    const session = await signedIn(tt)
    await tt.run(async (ctx) => {
      const [held] = await ctx.db.query('authSessions').collect()
      await ctx.db.delete('authSessions', present(held)._id)
    })
    expect(await refusedAs(assume(session, 'flip_kromer'))).to.eq('notSignedIn')
  })
})

describe('idents.current', () => {
  it('is the ident the session asserted last, and never says which session holds it', async () => {
    const tt = openTester()
    const session = await signedIn(tt)
    await assume(session, 'flip_kromer', 'Flip')
    await assume(session, 'quiet_otter', 'Otter')
    const { ident } = present(await session.as.query(api.idents.current, {}))
    expect(ident).to.deep.include({ label: 'quiet_otter', title: 'Otter' })
    expect(ident).to.not.have.any.keys('user_id')
  })

  it('hands the session the actor the server sees in its requests, which the browser builds its claims on', async () => {
    const tt = openTester()
    const otter = await identified(tt, 'quiet_otter')
    const { ident, actor } = present(await otter.as.query(api.idents.current, {}))
    expect(actor).to.deep.eq(otter.actor)
    expect(actor.ident_id).to.eq(ident._id)
  })

  it('is null for a session that has asserted no username, and for a request with no session', async () => {
    const tt = openTester()
    await identified(tt, 'flip_kromer')
    const session = await signedIn(tt)
    expect([await session.as.query(api.idents.current, {}), await tt.query(api.idents.current, {})]).to.deep.eq([null, null])
  })
})

describe('idents.performAccount: retitle_ident', () => {
  it('retitles the ident this session is, keeping its label', async () => {
    const tt = openTester()
    const otter = await identified(tt, 'quiet_otter')
    expect(await retitle(otter, 'Otto')).to.eq(otter.ident_id)
    const idents = await allOf(tt, 'idents')
    expect(idents.map((row) => [row.label, row.title])).to.deep.eq([['quiet_otter', 'Otto']])
  })

  it("rewrites the title every hunting of the ident holds, on every hunt it is on, and no one else's", async () => {
    const tt = openTester()
    const one = await seedHunt(tt, huntHolding([Quiz.blank()]), { smith: 'quiet_otter' })
    const two = await seedHunt(tt, huntHolding([Quiz.blank()]), { smith: 'loud_heron' })
    await putOn(tt, two.open.hunt_id, one.smith.ident_id, 'reviewer')
    await retitle(one.smith, 'Otto')
    const huntings = await allOf(tt, 'huntings')
    expect(huntings.map((row) => [row.ident_label, row.ident_title])).to.deep.eq([['quiet_otter', 'Otto'], ['loud_heron', 'Loud Heron'], ['quiet_otter', 'Otto']])
    await expectSound(tt)
  })

  it('refuses a session that has asserted no username, or a request with no session, writing nothing', async () => {
    const tt = openTester()
    const session = await signedIn(tt)
    expect([await refusedAs(retitle(session, 'Otto')), await refusedAs(retitle(tt, 'Otto'))]).to.deep.eq(['notIdentified', 'notSignedIn'])
    expect(await allOf(tt, 'idents')).to.deep.eq([])
  })
})

describe('idents.performAccount: new_hunt', () => {
  it('makes a hunt with one realm, home, holding one blank quiz under the hunt\'s own label and title', async () => {
    const tt = openTester()
    const hunt_id = present(await makeHunt(tt, 'loud_heron'))
    const hunt = await wholeHunt(tt, present(await tt.run(async (ctx) => await huntForLabel(ctx.db, 'loud_heron')))._id)
    const [realm] = hunt.realms
    const [quiz] = present(realm).quizzes
    expect(hunt._id).to.eq(hunt_id)
    expect([hunt.label, present(realm).label, present(quiz).label, present(quiz).title, present(quiz).questions.length])
      .to.deep.eq(['loud_heron', HomeRealmLabel, 'loud_heron', hunt.title, BlankQuestionQty])
  })

  it('puts the ident the session is now on the hunt it made, as its smith, its hunting holding its label and title', async () => {
    const tt = openTester()
    const alice = await identified(tt, 'alice_smiths')
    const hunt_id = await makeHunt(tt, 'loud_heron', alice)
    const huntings = await allOf(tt, 'huntings')
    expect(huntings.map((row) => [row.hunt_id, row.ident_id, row.ident_label, row.ident_title, row.role])).to.deep.eq([[hunt_id, alice.ident_id, 'alice_smiths', 'Alice Smiths', 'smith']])
    await expectSound(tt)
  })

  it('refuses a session that has asserted no username, or a request with no session, writing nothing', async () => {
    const tt = openTester()
    const session = await signedIn(tt)
    expect([await refusedAs(makeHunt(tt, 'loud_heron', session)), await refusedAs(makeHunt(tt, 'loud_heron', tt))]).to.deep.eq(['notIdentified', 'notSignedIn'])
    expect([await allOf(tt, 'hunts'), await allOf(tt, 'huntings')]).to.deep.eq([[], []])
  })

  it('refuses a label some hunt already answers to', async () => {
    const tt = openTester()
    await makeHunt(tt, 'taken_label')
    expect(await refusedAs(makeHunt(tt, 'taken_label'))).to.eq('labelTaken')
    expect(await allOf(tt, 'hunts')).to.have.lengthOf(1)
  })

  it('refuses one hunt more than the app may hold', async () => {
    const tt = openTester()
    await tt.run(async (ctx) => {
      const labels = Array.from({ length: PA.HuntsInApp.max }, (_unused, idx) => `hunt_${String(idx)}`)
      for (const label of labels) {
        await ctx.db.insert('hunts', { label, title: '' })
      }
    })
    expect(await refusedAs(makeHunt(tt, 'one_too_many'))).to.eq('huntsFull')
  })

  it('writes the whole hunt in one go: a realm for it, and its quiz in the realm', async () => {
    const tt = openTester()
    await makeHunt(tt, 'loud_heron')
    const realms = await tt.run(async (ctx) => await realmsOf(ctx.db, present(await huntForLabel(ctx.db, 'loud_heron'))._id))
    expect(realms.map(({ realm, quizzes }) => [realm.label, quizzes.length])).to.deep.eq([[HomeRealmLabel, 1]])
  })
})

/** What a smith does to a hunt from the hunts list, less the hunt it names */
type HuntEdit = { kind: 'retitle_hunt', title: string } | { kind: 'relabel_hunt', label: string }

/** A hunt with its smith and a reviewer on it, as the hunts list would find it, and how to edit it from there */
async function smithed() {
  const tt = openTester()
  const { open: { hunt_id }, smith, join } = await seedHunt(tt, Hunt.blank('quiet_otter'), { smith: 'alice_smiths' })
  const bob = await join('bob_reviews', 'reviewer')
  const perform = async (edit: HuntEdit, by: Session | Tester = smith) => await callerOf(by).mutation(api.idents.performAccount, { action: { ...edit, hunt_id } })
  const held = async () => present(await tt.run(async (ctx) => await ctx.db.get('hunts', hunt_id)))
  return { tt, hunt_id, bob, perform, held }
}

describe('idents.performAccount: retitle_hunt and relabel_hunt', () => {
  it("lets the hunt's smith retitle it and relabel it, with no quiz open", async () => {
    const { hunt_id, perform, held } = await smithed()
    expect(await perform({ kind: 'retitle_hunt', title: 'The Autumn Hunt' })).to.eq(hunt_id)
    expect(await perform({ kind: 'relabel_hunt', label: 'autumn_hunt' })).to.eq(hunt_id)
    const hunt = await held()
    expect([hunt.title, hunt.label]).to.deep.eq(['The Autumn Hunt', 'autumn_hunt'])
  })

  it('refuses a reviewer on the hunt, and a stranger, writing nothing', async () => {
    const { tt, bob, perform, held } = await smithed()
    const carol = await identified(tt, 'carol_strays')
    const ante = await held()
    const refusals = [
      await refusedAs(perform({ kind: 'retitle_hunt', title: 'Mine now' }, bob)),
      await refusedAs(perform({ kind: 'relabel_hunt', label: 'mine_now' }, carol)),
    ]
    expect(refusals).to.deep.eq(['notPermitted', 'notPermitted'])
    expect(await held()).to.deep.eq(ante)
  })

  it('refuses a session that has asserted no username', async () => {
    const { tt, perform } = await smithed()
    const pending = perform({ kind: 'retitle_hunt', title: 'Mine now' }, await signedIn(tt))
    expect(await refusedAs(pending)).to.eq('notIdentified')
  })

  it('refuses a label another hunt answers to, writing nothing', async () => {
    const { tt, perform, held } = await smithed()
    await makeHunt(tt, 'taken_label')
    expect(await refusedAs(perform({ kind: 'relabel_hunt', label: 'taken_label' }))).to.eq('labelTaken')
    const hunt = await held()
    expect(hunt.label).to.eq('quiet_otter')
  })
})
