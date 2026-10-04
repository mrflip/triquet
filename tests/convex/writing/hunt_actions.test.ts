import { describe, expect, it } from 'vitest'
import { huntForLabel, realmsOf } from '../../../convex/reading'
import type { Id } from '../../../convex/_generated/dataModel'
import { classicLayout } from '../../support/layouts'
import { Question } from '../../../src/models/question'
import { Quiz } from '../../../src/models/quiz'
import { present } from '../../support/present'
import { expectSound } from '../../support/soundness'
import { expectRefusal, huntHolding, openOf, openTester, seedHunt, type Tester } from '../../support/convex'

/** A hunt of two quizzes, the first holding two questions, laid out with the default widgetings and columns */
function huntOfTwo() {
  const questions = ['a', 'b'].map((title) => ({ ...Question.blank(), title }))
  return huntHolding([{ ...Quiz.blank('Quiz one'), ...classicLayout(), questions }, Quiz.blank('Quiz two')])
}

/** A hunt down to its last quiz, holding two questions, laid out with the default widgetings and columns */
function huntOfOne() {
  const questions = ['a', 'b'].map((title) => ({ ...Question.blank(), title }))
  return huntHolding([{ ...Quiz.blank('Quiz one'), ...classicLayout(), questions }])
}

/** The label `hunt_id` answers to, read back the way an address is: whichever hunt the label finds */
async function answersTo(tt: Tester, label: string): Promise<Id<'hunts'> | null> {
  const hunt = await tt.run(async (ctx) => await huntForLabel(ctx.db, label))
  return hunt?._id ?? null
}

/** How many rows each table holds that belong to a hunt, one way or another */
async function rowCounts(tt: Tester) {
  return await tt.run(async (ctx) => {
    const tablenames = ['hunts', 'realms', 'widgets', 'quizzes', 'widgetings', 'columns', 'questions', 'widgeteds', 'reviews', 'reviewings', 'huntings'] as const
    const counts = await Promise.all(tablenames.map(async (tablename) => {
      const rows = await ctx.db.query(tablename).collect()
      return [tablename, rows.length] as const
    }))
    return Object.fromEntries(counts)
  })
}

describe("hunts.perform: retitle_hunt", () => {
  it("changes what the hunt is called, and leaves the label, and so the address, alone", async () => {
    const { tt, act, open } = await seedHunt(openTester(), huntOfTwo())
    const ante = present(await tt.run(async (ctx) => await ctx.db.get('hunts', open.hunt_id)))
    await act({ kind: 'retitle_hunt', title: 'The Autumn Hunt' })
    const hunt = present(await tt.run(async (ctx) => await ctx.db.get('hunts', open.hunt_id)))
    expect([hunt.title, hunt.label]).to.deep.eq(['The Autumn Hunt', ante.label])
  })

  it("refuses a reviewer, as not theirs to change", async () => {
    const { act, join } = await seedHunt(openTester(), huntOfTwo())
    const reviewer = await join('bob_reviews', 'reviewer')
    await expectRefusal(act({ kind: 'retitle_hunt', title: 'The Autumn Hunt' }, reviewer), 'notPermitted')
  })
})

describe("hunts.perform: relabel_hunt", () => {
  it("makes the hunt answer to the new label, and no longer to the old", async () => {
    const { tt, act, open } = await seedHunt(openTester(), huntOfTwo())
    const minted = present(await tt.run(async (ctx) => await ctx.db.get('hunts', open.hunt_id))).label
    await act({ kind: 'relabel_hunt', label: 'autumn_hunt' })
    expect([await answersTo(tt, 'autumn_hunt'), await answersTo(tt, minted)]).to.deep.eq([open.hunt_id, null])
  })

  it("can be relabelled back to the label it was made with", async () => {
    const { tt, act, open } = await seedHunt(openTester(), huntOfTwo())
    const minted = present(await tt.run(async (ctx) => await ctx.db.get('hunts', open.hunt_id))).label
    await act({ kind: 'relabel_hunt', label: 'autumn_hunt' })
    await act({ kind: 'relabel_hunt', label: minted })
    expect([await answersTo(tt, minted), await answersTo(tt, 'autumn_hunt')]).to.deep.eq([open.hunt_id, null])
  })

  it("takes the label the hunt already has, changing nothing", async () => {
    const { tt, act, open } = await seedHunt(openTester(), huntOfTwo())
    const ante = present(await tt.run(async (ctx) => await ctx.db.get('hunts', open.hunt_id)))
    await act({ kind: 'relabel_hunt', label: ante.label })
    expect(await tt.run(async (ctx) => await ctx.db.get('hunts', open.hunt_id))).to.deep.eq(ante)
  })

  it("refuses a label another hunt answers to, writing nothing", async () => {
    const tt = openTester()
    const mine = await seedHunt(tt, huntOfTwo())
    const theirs = await seedHunt(tt, huntOfTwo(), { smith: 'other_smith' })
    await theirs.act({ kind: 'relabel_hunt', label: 'autumn_hunt' })
    await expectRefusal(mine.act({ kind: 'relabel_hunt', label: 'autumn_hunt' }), 'labelTaken')
    expect(await answersTo(tt, 'autumn_hunt')).to.eq(theirs.open.hunt_id)
  })

  it("refuses a reviewer, as not theirs to change", async () => {
    const { act, join } = await seedHunt(openTester(), huntOfTwo())
    const reviewer = await join('bob_reviews', 'reviewer')
    await expectRefusal(act({ kind: 'relabel_hunt', label: 'autumn_hunt' }, reviewer), 'notPermitted')
  })

  it("works on a locked quiz, since the hunt is not the quiz", async () => {
    const { tt, act, open } = await seedHunt(openTester(), huntHolding([{ ...Quiz.blank('Quiz one'), locked: true }]))
    await act({ kind: 'relabel_hunt', label: 'autumn_hunt' })
    expect(await answersTo(tt, 'autumn_hunt')).to.eq(open.hunt_id)
  })
})

describe("hunts.perform: delete_hunt", () => {
  it("takes every row the hunt and its last quiz hold with it, and leaves another hunt, the library, and the idents, alone", async () => {
    const tt = openTester()
    const spared = await seedHunt(tt, huntOfTwo(), { smith: 'spared_smith' })
    const ante = await rowCounts(tt)
    const doomed = await seedHunt(tt, huntOfOne())
    const question_id = present(openOf(await doomed.read()).questions[0])._id as Id<'questions'>
    const reviewer = await doomed.join('bob_reviews', 'reviewer')
    await doomed.act({ kind: 'open_review', quiz_id: doomed.open.quiz_id }, reviewer)
    await doomed.act({ kind: 'set_reviewing', quiz_id: doomed.open.quiz_id, question_id, patch: { keep_it: true } }, reviewer)
    await doomed.act({ kind: 'record_widgeted', widgeted: { question_id, widgeting_label: 'dumdum', status: 'ok', value: { guess: 'Hamlet', explanation: '' } } })
    const { widgeteds } = await rowCounts(tt)
    expect(widgeteds).to.eq(1)

    await doomed.act({ kind: 'delete_hunt' })
    const idents = await tt.run(async (ctx) => await ctx.db.query('idents').collect())
    expect(await rowCounts(tt)).to.deep.eq(ante)
    expect(idents.map((ident) => ident.label)).to.include.members(['seed_smith', 'bob_reviews'])
    const { quizzes } = await spared.read()
    expect(quizzes.map((quiz) => quiz.title)).to.deep.eq(['Quiz one', 'Quiz two'])
    await expectSound(tt)
  })

  it("refuses while the hunt holds another quiz, deleting nothing", async () => {
    const tt = openTester()
    const { act } = await seedHunt(tt, huntOfTwo())
    const ante = await rowCounts(tt)
    await expectRefusal(act({ kind: 'delete_hunt' }), 'huntNotEmptied')
    expect(await rowCounts(tt)).to.deep.eq(ante)
  })

  it("refuses a reviewer, deleting nothing", async () => {
    const { tt, act, join, open } = await seedHunt(openTester(), huntOfOne())
    const reviewer = await join('bob_reviews', 'reviewer')
    await expectRefusal(act({ kind: 'delete_hunt' }, reviewer), 'notPermitted')
    const realms = await tt.run(async (ctx) => await realmsOf(ctx.db, open.hunt_id))
    expect(realms).to.have.lengthOf(1)
  })
})
