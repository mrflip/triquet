import { describe, expect, it } from 'vitest'
import { api, internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { noticeOf } from '../../src/lib/refusals'
import type { OuterHuntActionDNA } from '../../src/models/actions'
import * as PA from '../../src/lib/vv/patterns'
import { Hunt } from '../../src/models/hunt'
import { callerOf, googleUser, openTester, seedHunt, type Session, type Tester } from '../support/convex'
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

describe('check_reserved:refused', () => {
  it('names every hunt whose label or org the reserved list would refuse, in the order they were made, and counts every hunt', async () => {
    const tt = openTester()
    await standing(tt, 'quiet_otter', 'pat_smith')
    await standing(tt, 'privacy', 'pat_smith')
    await standing(tt, 'loud_heron', 'google_fan')
    await standing(tt, 'handle', 'support_desk')
    expect(await tt.query(internal.check_reserved.refused, {})).to.deep.eq({
      counted: 4,
      refused: [
        { orglabel: 'pat_smith',    label: 'privacy',    refused: ['label'] },
        { orglabel: 'google_fan',   label: 'loud_heron', refused: ['orglabel'] },
        { orglabel: 'support_desk', label: 'handle',     refused: ['orglabel', 'label'] },
      ],
    })
  })

  it('names none on a deployment holding no hunt, or none so labelled', async () => {
    const tt = openTester()
    expect(await tt.query(internal.check_reserved.refused, {})).to.deep.eq({ counted: 0, refused: [] })
    await standing(tt, 'quiet_otter', 'pat_smith')
    expect(await tt.query(internal.check_reserved.refused, {})).to.deep.eq({ counted: 1, refused: [] })
  })

  it('reads and writes nothing else: a hunt it names is as it was', async () => {
    const tt = openTester()
    const { open: { hunt_id } } = await standing(tt, 'privacy', 'google_fan')
    const ante = await heldHunt(tt, hunt_id)
    await tt.query(internal.check_reserved.refused, {})
    expect(await heldHunt(tt, hunt_id)).to.deep.eq(ante)
  })
})

describe('a hunt named before its words were reserved', () => {
  it('opens at its address, org and all', async () => {
    const tt = openTester()
    const { smith } = await standing(tt, 'privacy', 'google_fan')
    const opening = await smith.as.query(api.hunts.open, { orglabel: 'google_fan', hunt_label: 'privacy' })
    expect([opening.why, opening.hunt?.label, opening.hunt?.org]).to.deep.eq([null, 'privacy', 'google_fan'])
  })

  it('stays writable: retitled, rebranched and worked in, keeping its label and org', async () => {
    const tt = openTester()
    const { open: { hunt_id }, smith, act } = await standing(tt, 'privacy', 'google_fan')
    await performOuter(smith, { kind: 'retitle_hunt', hunt_id, title: 'Our Privacy Hunt' })
    await performOuter(smith, { kind: 'rebranch_hunt', hunt_id, branch: 'playtest' })
    await act({ kind: 'retitle_hunt', title: 'Still Ours' })
    await act({ kind: 'add_question' })
    const hunt = await heldHunt(tt, hunt_id)
    expect([hunt.label, hunt.orglabel, hunt.title, hunt.branch]).to.deep.eq(['privacy', 'google_fan', 'Still Ours', 'playtest'])
    await expectSound(tt)
  })

  it('takes a new label only if the list allows it', async () => {
    const tt = openTester()
    const { open: { hunt_id }, smith, act } = await standing(tt, 'privacy', 'google_fan')
    expect(await noticeFor(performOuter(smith, { kind: 'relabel_hunt', hunt_id, label: 'terms' }))).to.include(PA.UnreservedToplevel.msg)
    expect(await noticeFor(act({ kind: 'relabel_hunt', label: 'google_docs' }))).to.include(PA.UnreservedToplevel.msg)
    expect(await labelOf(tt, hunt_id)).to.eq('privacy')
    await performOuter(smith, { kind: 'relabel_hunt', hunt_id, label: 'autumn_hunt' })
    expect(await labelOf(tt, hunt_id)).to.eq('autumn_hunt')
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
