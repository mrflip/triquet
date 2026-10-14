import { describe, expect, it } from 'vitest'
import { api, internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { noticeOf } from '../../src/lib/refusals'
import type { OuterHuntActionDNA } from '../../src/models/actions'
import * as PA from '../../src/lib/vv/patterns'
import { Hunt } from '../../src/models/hunt'
import { Unsent } from '../../convex/check_reserved'
import { RowValidators } from '../../convex/schema'
import * as CheckReserved from '../../scripts/check-reserved'
import { bigQuiz } from '../support/big-quiz'
import { anonymousSession, callerOf, googleUser, huntHolding, openTester, seedHunt, type Session, type Tester } from '../support/convex'
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

/** Run a function on the tester as the guard runs one on a deployment: only `check_reserved:page` */
function runOn(tt: Tester): CheckReserved.RunT {
  return async (fnpath, args) => {
    expect(fnpath).to.eq('check_reserved:page')
    return await tt.query(internal.check_reserved.page, args as { table: string, cursor: string | null })
  }
}

/** What the guard reads of the tester, and makes of it */
async function reportOn(tt: Tester): Promise<CheckReserved.ReportT> {
  return CheckReserved.reportOf(await CheckReserved.heldFrom(runOn(tt)))
}

/** A hunt of a quiz of three questions in the classic layout, a cell of it answered, its smith and a reviewer on it, a ghosting, and the library */
async function wellStocked(tt: Tester) {
  const seeded = await seedHunt(tt, huntHolding([bigQuiz(3)]), { smith: 'alice_smiths' })
  const { join, read } = seeded
  await join('bob_reviews', 'reviewer')
  const seen = await read()
  const [question] = present(seen.quizzes[0]).questions
  await seeded.act({ kind: 'record_widgeted', widgeted: { question_id: present(question)._id, widgeting_label: 'dumdum', status: 'ok', value: 'Leon?' } })
  const { user_id } = await anonymousSession(tt)
  await tt.run(async (ctx) => {
    const account = present(await ctx.db.query('authAccounts').first(), 'an account')
    await ctx.db.insert('ghostings', { userlabel: 'old_alice', user_id, into_user_id: user_id, account_id: account._id })
  })
  return seeded
}

describe("check_reserved:page", () => {
  it("answers a table's rows a page at a time, unjudged, and null for a table not ours", async () => {
    const tt = openTester()
    const { open: { hunt_id } } = await standing(tt, 'privacy', 'google_fan')
    const first = await tt.query(internal.check_reserved.page, { table: 'hunts', cursor: null })
    expect(first?.isDone).to.be.true
    expect(first?.page.map((hunt) => hunt._id)).to.deep.eq([hunt_id])
    expect(await tt.query(internal.check_reserved.page, { table: 'authAccounts', cursor: null })).to.eq(null)
    expect(await tt.query(internal.check_reserved.page, { table: 'no_such_table', cursor: null })).to.eq(null)
  })

  it("leaves out of every page how to reach the person behind a user and what Google says of them, and still names its userlabel", async () => {
    const tt = openTester()
    const { user_id } = await googleUser(tt, 'abel_google')
    const personal = {
      email:         'abel_google@example.com', emailVerificationTime: 1_760_000_000_000,
      phone:         '+1 555 0100',             phoneVerificationTime: 1_760_000_000_000,
      name:          'Abel Google',             image:                 'https://example.com/abel.png',
      locale:        'en-GB',                   hosted_domain:         'example.com',
    }
    await tt.run(async (ctx) => { await ctx.db.patch('users', user_id, { ...personal, userlabel: 'support_me' }) })
    const held = present(await tt.run(async (ctx) => await ctx.db.get('users', user_id)))
    expect(held).to.include(personal)
    const users = present(await tt.query(internal.check_reserved.page, { table: 'users', cursor: null })).page
    expect(users.map((user) => Object.keys(user).filter((key) => Object.hasOwn(personal, key)))).to.deep.eq([[]])
    expect(new Set(Unsent.users)).to.deep.eq(new Set(Object.keys(personal)))
    const report = await reportOn(tt)
    expect(report.refused.map(({ table, row, field, val }) => [table, row, field, val])).to.deep.eq([
      ['users', 'support_me', 'userlabel', 'support_me'],
    ])
  })

  it("leaves out only fields a row may lack and no label check holds, so no verdict on a label is lost", () => {
    const { shape } = RowValidators.users
    const unsent = present(Unsent.users) as (keyof typeof shape)[]
    expect(unsent.filter((fieldname) => ! shape[fieldname].safeParse(undefined).success)).to.deep.eq([])
    // Every label check refuses a reserved word: each field takes one as text, or holds a number
    const takesAnyWord = (fieldname: keyof typeof shape) => shape[fieldname].safeParse('constructor').success || shape[fieldname].safeParse(0).success
    expect(unsent.filter((fieldname) => ! takesAnyWord(fieldname))).to.deep.eq([])
  })

  it("writes nothing: a hunt it reads is as it was", async () => {
    const tt = openTester()
    const { open: { hunt_id } } = await standing(tt, 'privacy', 'google_fan')
    const ante = await heldHunt(tt, hunt_id)
    await reportOn(tt)
    expect(await heldHunt(tt, hunt_id)).to.deep.eq(ante)
  })
})

describe("the guard, over what the app writes", () => {
  it("reads every one of our tables, and refuses no row the app wrote", async () => {
    const tt = openTester()
    await wellStocked(tt)
    const report = await reportOn(tt)
    expect(report.refused).to.deep.eq([])
    expect(report.absent).to.deep.eq([])
    expect(new Set(Object.keys(report.counted))).to.deep.eq(new Set(Object.keys(RowValidators)))
    expect([report.counted.hunts, report.counted.questions, report.counted.ghostings, report.counted.huntships]).to.deep.eq([1, 3, 1, 2])
    expect(report.counted.widgetings).to.be.above(0)
    expect(report.counted.widgeteds).to.be.above(0)
    expect(report.counted.widgets).to.be.above(0)
  })

  it("names each label a word every label is kept from now holds, in every table, by where it sits", async () => {
    const tt = openTester()
    const { open: { hunt_id, quiz_id } } = await wellStocked(tt)
    await tt.run(async (ctx) => {
      const [question] = await ctx.db.query('questions').withIndex('by_quiz_id', (cvx) => cvx.eq('quiz_id', quiz_id)).take(1)
      await ctx.db.patch('questions', present(question)._id, { chains_to: 'constructor' })
      const [widgeting] = await ctx.db.query('widgetings').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz_id)).take(1)
      await ctx.db.patch('widgetings', present(widgeting)._id, { label: 'rank', params: { data: 1 } })
      await ctx.db.patch('hunts', hunt_id, { branch: 'prototype' })
    })
    const hunt = await heldHunt(tt, hunt_id)
    const quizAt = `/~alice_smiths/${hunt.label}/quizzes/home/princes`
    const { refused } = await reportOn(tt)
    expect(refused.map(({ table, where, field, val }) => [table, where, field, val])).to.deep.eq([
      ['hunts',      `/~alice_smiths/${hunt.label}`, 'branch',      'prototype'],
      ['widgetings', quizAt,                         'label',       'rank'],
      ['widgetings', quizAt,                         'params.data', 'data'],
      ['questions',  quizAt,                         'chains_to',   'constructor'],
    ])
  })

  it("names a userlabel or org a top-level word now holds, wherever it is held, and a hunt's own label apart, as standing, once", async () => {
    const tt = openTester()
    const { open: { hunt_id } } = await wellStocked(tt)
    await tt.run(async (ctx) => {
      await ctx.db.patch('hunts', hunt_id, { orglabel: 'google_fan', label: 'privacy' })
      await ctx.db.insert('hunts', { label: 'terms', orglabel: 'alice_smiths', title: '', branch: 'main' })
      const ghosting = present(await ctx.db.query('ghostings').first())
      await ctx.db.patch('ghostings', ghosting._id, { userlabel: 'support_me' })
    })
    const report = await reportOn(tt)
    expect(report.refused.map(({ table, row, field, val }) => [table, row, field, val])).to.deep.eq([
      ['ghostings', 'support_me', 'userlabel', 'support_me'],
      ['hunts',     'privacy',    'orglabel',  'google_fan'],
    ])
    expect(report.standing).to.deep.eq(['/~alice_smiths/terms'])
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
