import { describe, expect, it } from 'vitest'
import { api, internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { noticeOf } from '../../src/lib/refusals'
import type { OuterHuntActionDNA } from '../../src/models/actions'
import * as PA from '../../src/lib/vv/patterns'
import { Hunt } from '../../src/models/hunt'
import { anonymousSession, callerOf, googleUser, openTester, seedHunt, type Session, type Tester } from '../support/convex'
import { present } from '../support/present'
import { expectSound } from '../support/soundness'

/**
 * A hunt labelled `label`, made with its smith, then moved to the org `orglabel` past every check,
 * as a hunt made before a word was reserved would stand.
 */
async function standing(tt: Tester, label: string, orglabel: string) {
  const seeded = await seedHunt(tt, Hunt.blank(label), { smith: 'alice_smiths' })
  await tt.run(async (ctx) => { await ctx.db.patch('hunts', seeded.open.hunt_id, { orglabel }) })
  return seeded
}

/** The hunt `hunt_id`'s row, which must be there */
async function heldHunt(tt: Tester, hunt_id: Id<'hunts'>) {
  return present(await tt.run(async (ctx) => await ctx.db.get('hunts', hunt_id)), 'the hunt')
}

/** The hunt `hunt_id`'s label as it stands */
async function labelOf(tt: Tester, hunt_id: Id<'hunts'>): Promise<string> {
  const hunt = await heldHunt(tt, hunt_id)
  return hunt.label
}

/** What `pending` was refused with, in the words the author is shown; fails the test when it went through */
async function noticeFor(pending: Promise<unknown>): Promise<string> {
  try {
    await pending
  } catch (err) {
    return noticeOf(err)
  }
  throw new Error('expected a refusal, and the call went through')
}

/** Every hunt row there is */
async function huntsIn(tt: Tester) {
  return await tt.run(async (ctx) => await ctx.db.query('hunts').collect())
}

/** Carry out a hunt action from outside its quizzes, as the session `by` */
async function performOuter(by: Session, action: OuterHuntActionDNA) {
  return await callerOf(by).mutation(api.hunts.performOuter, { action })
}

/** What `check_reserved:held` answers */
async function heldIn(tt: Tester) {
  return await tt.query(internal.check_reserved.held, {})
}

describe("check_reserved:held", () => {
  it("answers every userlabel a user holds, alphabetically, and every one a ghosting holds and every hunt's org and label, each in the order made, unjudged", async () => {
    const tt = openTester()
    await standing(tt, 'quiet_otter', 'pat_smith')
    await standing(tt, 'privacy', 'google_fan')
    await googleUser(tt, 'abel_google')
    const { user_id } = await anonymousSession(tt)
    await tt.run(async (ctx) => {
      const account = present(await ctx.db.query('authAccounts').first(), 'an account')
      await ctx.db.insert('ghostings', { userlabel: 'support_me', user_id, into_user_id: user_id, account_id: account._id })
    })
    expect(await heldIn(tt)).to.deep.eq({
      users:     ['abel_google', 'alice_smiths'],
      ghostings: ['support_me'],
      hunts:     [{ orglabel: 'pat_smith', label: 'quiet_otter' }, { orglabel: 'google_fan', label: 'privacy' }],
    })
  })

  it("answers nothing on a deployment holding nothing, a user with no userlabel among it", async () => {
    const tt = openTester()
    expect(await heldIn(tt)).to.deep.eq({ users: [], ghostings: [], hunts: [] })
    await anonymousSession(tt)
    expect(await heldIn(tt)).to.deep.eq({ users: [], ghostings: [], hunts: [] })
  })

  it("writes nothing: a hunt it reads is as it was", async () => {
    const tt = openTester()
    const { open: { hunt_id } } = await standing(tt, 'privacy', 'google_fan')
    const ante = await heldHunt(tt, hunt_id)
    await heldIn(tt)
    expect(await heldHunt(tt, hunt_id)).to.deep.eq(ante)
  })
})

describe("a hunt labelled before its label was reserved", () => {
  it("opens at its address", async () => {
    const tt = openTester()
    const { smith } = await standing(tt, 'privacy', 'pat_smith')
    const opening = await smith.as.query(api.hunts.open, { orglabel: 'pat_smith', hunt_label: 'privacy' })
    expect([opening.why, opening.hunt?.label, opening.hunt?.org]).to.deep.eq([null, 'privacy', 'pat_smith'])
  })

  it("stays writable: retitled, rebranched and worked in, keeping its label", async () => {
    const tt = openTester()
    const { open: { hunt_id }, smith, act } = await standing(tt, 'privacy', 'pat_smith')
    await performOuter(smith, { kind: 'retitle_hunt', hunt_id, title: 'Our Privacy Hunt' })
    await performOuter(smith, { kind: 'rebranch_hunt', hunt_id, branch: 'playtest' })
    await act({ kind: 'retitle_hunt', title: 'Still Ours' })
    await act({ kind: 'add_question' })
    const hunt = await heldHunt(tt, hunt_id)
    expect([hunt.label, hunt.orglabel, hunt.title, hunt.branch]).to.deep.eq(['privacy', 'pat_smith', 'Still Ours', 'playtest'])
    await expectSound(tt)
  })

  it("takes a new label only if the list allows it", async () => {
    const tt = openTester()
    const { open: { hunt_id }, smith, act } = await standing(tt, 'privacy', 'pat_smith')
    expect(await noticeFor(performOuter(smith, { kind: 'relabel_hunt', hunt_id, label: 'terms' }))).to.include(PA.UnreservedToplevel.msg)
    expect(await noticeFor(act({ kind: 'relabel_hunt', label: 'google_docs' }))).to.include(PA.UnreservedToplevel.msg)
    expect(await labelOf(tt, hunt_id)).to.eq('privacy')
    await performOuter(smith, { kind: 'relabel_hunt', hunt_id, label: 'autumn_hunt' })
    expect(await labelOf(tt, hunt_id)).to.eq('autumn_hunt')
  })
})

describe("a hunt of an org whose word was reserved after it was named", () => {
  it("is out of reach at its address", async () => {
    const tt = openTester()
    const { smith } = await standing(tt, 'quiet_otter', 'google_fan')
    await expect(smith.as.query(api.hunts.open, { orglabel: 'google_fan', hunt_label: 'quiet_otter' })).rejects.toThrow(PA.UnreservedToplevel.msg)
  })

  it("takes no write to its own row, and keeps its org", async () => {
    const tt = openTester()
    const { open: { hunt_id }, smith, act } = await standing(tt, 'quiet_otter', 'google_fan')
    const ante = await heldHunt(tt, hunt_id)
    await expect(performOuter(smith, { kind: 'retitle_hunt', hunt_id, title: 'Ours' })).rejects.toThrow(PA.UnreservedToplevel.msg)
    await expect(act({ kind: 'retitle_hunt', title: 'Still Ours' })).rejects.toThrow(PA.UnreservedToplevel.msg)
    expect(await heldHunt(tt, hunt_id)).to.deep.eq(ante)
  })
})

describe('a new hunt', () => {
  it('is refused a label the list keeps, and makes nothing', async () => {
    const tt = openTester()
    const alice = await googleUser(tt, 'alice_smiths')
    for (const label of ['privacy', 'google_docs', 'handle', 'smiths']) {
      expect(await noticeFor(performOuter(alice, { kind: 'new_hunt', label }))).to.include(PA.UnreservedToplevel.msg)
    }
    expect(await huntsIn(tt)).to.deep.eq([])
  })
})
