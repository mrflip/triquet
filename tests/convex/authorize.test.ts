import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import { mayActOnAccount, mayChangeHunt, mayPerform, mayReadHunt, mayReadReview, mayWriteReview, roleOn } from '../../convex/authorize'
import { identForLabel, reviewFor } from '../../convex/reading'
import { Hunt } from '../../src/models/hunt'
import { mintId } from '../../src/lib/ids'
import { present } from '../support/present'
import { expectRefusal, identified, openOf, openTester, seedHunt } from '../support/convex'

const modules = import.meta.glob('../../convex/**/*.ts')

/** Whether `val` is a function any caller on the internet may run */
function isPublicFunction(val: unknown): boolean {
  return typeof val === 'function' && 'isPublic' in val && val.isPublic === true
}

/** Every public function the deployment offers, as `module:name`, in order */
async function publicFunctions(): Promise<string[]> {
  const sources = Object.entries(modules).filter(([path]) => ! path.includes('/_generated/') && ! path.endsWith('/convex.config.ts'))
  const found = await Promise.all(sources.map(async ([path, load]) => {
    const exported = await load() as Record<string, unknown>
    const modulename = path.replace('../../convex/', '').replace(/\.ts$/, '')
    return Object.entries(exported).filter(([, val]) => isPublicFunction(val)).map(([fnname]) => `${modulename}:${fnname}`)
  }))
  return found.flat().toSorted((aa, bb) => aa.localeCompare(bb))
}

/** One hunt with a smith, a reviewer and a stranger (an ident on no hunt), and a second hunt the smith alone is on */
async function peopled() {
  const tt = openTester()
  const seeded = await seedHunt(tt, Hunt.blank('quiet_otter'), { smith: 'alice_smiths' })
  const other = await seedHunt(tt, Hunt.blank('loud_heron'), { smith: 'alice_smiths' })
  const bob = await seeded.join('bob_reviews', 'reviewer')
  const carol = await identified(tt, 'carol_strays')
  return { ...seeded, other, alice: seeded.smith, bob, carol }
}

describe("the rules", () => {
  it("let a smith read and change the hunt, a reviewer read it and write reviews, and nobody else do either", async () => {
    const { tt, open, alice, bob, carol } = await peopled()
    const verdicts = await tt.run(async (ctx) => await Promise.all([alice, bob, carol].map(async ({ ident_id }) => [
      await roleOn(ctx.db, open.hunt_id, ident_id),
      await mayReadHunt(ctx.db, open.hunt_id, ident_id),
      await mayChangeHunt(ctx.db, open.hunt_id, ident_id),
      await mayWriteReview(ctx.db, open.hunt_id, ident_id),
    ])))
    expect(verdicts).to.deep.eq([
      ['smith',    true,  true,  true],
      ['reviewer', true,  false, true],
      [null,       false, false, false],
    ])
  })

  it("let nobody at all read or change a hunt: a browser that has not said who it is", async () => {
    const { tt, open } = await peopled()
    const verdicts = await tt.run(async (ctx) => [await roleOn(ctx.db, open.hunt_id, null), await mayReadHunt(ctx.db, open.hunt_id, null), await mayChangeHunt(ctx.db, open.hunt_id, null)])
    expect(verdicts).to.deep.eq([null, false, false])
  })

  it("let a reviewer read their own review whatever its phase; once shared, a smith, and another reviewer only while theirs is shared too", async () => {
    const { tt, open, act, join, alice, bob, carol } = await peopled()
    const dave = await join('dave_reviews', 'reviewer')
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, bob.browser_key)
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, dave.browser_key)
    const readers = async () => await tt.run(async (ctx) => {
      const review = present(await reviewFor(ctx.db, open.quiz_id, bob.ident_id))
      return await Promise.all([bob, alice, dave, carol].map(async ({ ident_id }) => await mayReadReview(ctx.db, review, ident_id)))
    })
    expect(await readers()).to.deep.eq([true, false, false, false])
    await act({ kind: 'set_review_phase', quiz_id: open.quiz_id, phase: 'shared' }, bob.browser_key)
    expect(await readers()).to.deep.eq([true, true, false, false])
    await act({ kind: 'set_review_phase', quiz_id: open.quiz_id, phase: 'shared' }, dave.browser_key)
    expect(await readers()).to.deep.eq([true, true, true, false])
    await act({ kind: 'set_review_phase', quiz_id: open.quiz_id, phase: 'draft' }, dave.browser_key)
    expect(await readers()).to.deep.eq([true, true, false, false])
  })
})

describe("mayActOnAccount", () => {
  it("lets only a smith retitle or relabel a hunt, and anyone take the actions that name none", async () => {
    const { tt, open, alice, bob, carol } = await peopled()
    const actions = [
      { kind: 'retitle_hunt', hunt_id: open.hunt_id, title: 'Mine now' },
      { kind: 'relabel_hunt', hunt_id: open.hunt_id, label: 'mine_now' },
      { kind: 'new_hunt',     label: 'loud_heron' },
    ] as const
    const verdicts = await tt.run(async (ctx) => await Promise.all([alice, bob, carol].map(async ({ ident_id }) => (
      await Promise.all(actions.map(async (action) => await mayActOnAccount(ctx.db, ident_id, action)))
    ))))
    expect(verdicts).to.deep.eq([
      [true,  true,  true],
      [false, false, true],
      [false, false, true],
    ])
  })

  it("lets nobody retitle a hunt from a browser that has not said who it is", async () => {
    const { tt, open } = await peopled()
    expect(await tt.run(async (ctx) => await mayActOnAccount(ctx.db, null, { kind: 'retitle_hunt', hunt_id: open.hunt_id, title: 'Mine now' }))).to.be.false
  })
})

describe("hunts.perform, authorized", () => {
  it("lets a smith change the hunt, and refuses a reviewer and a stranger, writing nothing", async () => {
    const { act, read, bob, carol } = await peopled()
    await act({ kind: 'retitle_quiz', title: 'Princes' })
    await expectRefusal(act({ kind: 'retitle_quiz', title: 'Kings' }, bob.browser_key), 'notPermitted')
    await expectRefusal(act({ kind: 'retitle_quiz', title: 'Kings' }, carol.browser_key), 'notPermitted')
    await expectRefusal(act({ kind: 'add_hunting', ident_label: 'carol_strays', role: 'smith' }, bob.browser_key), 'notPermitted')
    await expectRefusal(act({ kind: 'import_questions', questions: [{ label: 'smuggled', patch: {} }] }, bob.browser_key), 'notPermitted')
    expect(openOf(await read()).title).to.eq('Princes')
  })

  it("lets a reviewer, or a smith, write their own review, and refuses a stranger", async () => {
    const { act, open, bob, carol, alice } = await peopled()
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, bob.browser_key)
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, alice.browser_key)
    await expectRefusal(act({ kind: 'open_review', quiz_id: open.quiz_id }, carol.browser_key), 'notPermitted')
  })

  it("refuses a browser that has not said who it is, before anything else", async () => {
    const { act } = await peopled()
    await expectRefusal(act({ kind: 'retitle_quiz', title: 'Kings' }, mintId()), 'notIdentified')
  })

  it("refuses a place whose realm or quiz is another hunt's, or an action naming a quiz of another hunt", async () => {
    const tt = openTester()
    const mine = await seedHunt(tt, Hunt.blank('quiet_otter'), { smith: 'alice_smiths' })
    const theirs = await seedHunt(tt, Hunt.blank('loud_heron'), { smith: 'bob_smiths' })
    const before = openOf(await theirs.read())
    const forgeries = [{ ...mine.open, quiz_id: theirs.open.quiz_id }, { ...theirs.open, hunt_id: mine.open.hunt_id }]
    for (const open of forgeries) {
      await expectRefusal(tt.mutation(api.hunts.perform, { open, action: { kind: 'retitle_quiz', title: 'Mine now' }, browser_key: mine.smith.browser_key }), 'notPermitted')
    }
    await expectRefusal(mine.act({ kind: 'set_lock', quiz_id: theirs.open.quiz_id, locked: true }), 'notPermitted')
    await expectRefusal(mine.act({ kind: 'open_review', quiz_id: theirs.open.quiz_id }), 'notPermitted')
    expect(openOf(await theirs.read())).to.deep.eq(before)
  })
})

describe("mayPerform", () => {
  it("asks the rule of the hunt the place names, and holds the place to that hunt", async () => {
    const { tt, open, other, alice, bob } = await peopled()
    const retitle = { kind: 'retitle_quiz', title: 'Kings' } as const
    const peek = { kind: 'open_review', quiz_id: open.quiz_id } as const
    const verdicts = await tt.run(async (ctx) => [
      await mayPerform(ctx.db, open, alice.ident_id, retitle),
      await mayPerform(ctx.db, open, bob.ident_id, retitle),
      await mayPerform(ctx.db, open, bob.ident_id, peek),
      await mayPerform(ctx.db, { ...open, quiz_id: other.open.quiz_id }, alice.ident_id, retitle),
      await mayPerform(ctx.db, { ...open, realm_id: other.open.realm_id }, alice.ident_id, retitle),
    ])
    expect(verdicts).to.deep.eq([true, false, true, false, false])
  })

  it("refuses a quiz whose realm is gone, since nothing then says whose it is", async () => {
    const { tt, open, alice } = await peopled()
    const verdict = await tt.run(async (ctx) => {
      await ctx.db.delete('realms', open.realm_id)
      return await mayPerform(ctx.db, open, alice.ident_id, { kind: 'retitle_quiz', title: 'Kings' })
    })
    expect(verdict).to.be.false
  })
})

describe("identings, each browser's own", () => {
  it("are read only through the browser's own key: another browser learns nothing of them", async () => {
    const tt = openTester()
    await identified(tt, 'alice_reviews')
    expect(await tt.query(api.idents.current, { browser_key: mintId() })).to.be.null
  })

  it("are listed by no function, nor are idents changed or removed by one", async () => {
    expect(await publicFunctions()).to.deep.eq([
      'hunts:list', 'hunts:open', 'hunts:perform', 'hunts:whole',
      'idents:current', 'idents:performAccount',
      'questions:open',
      'quizzes:open',
      'reviews:forQuiz',
      'widgets:library',
    ])
  })
})

describe("idents", () => {
  it("are made by anyone, and are never changed by taking one on again", async () => {
    const tt = openTester()
    await tt.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label: 'flip_kromer', title: 'Flip' }, browser_key: mintId() })
    await tt.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label: 'flip_kromer', title: 'Impostor' }, browser_key: mintId() })
    const ident = await tt.run(async (ctx) => await identForLabel(ctx.db, 'flip_kromer'))
    expect(ident?.title).to.eq('Flip')
  })
})
