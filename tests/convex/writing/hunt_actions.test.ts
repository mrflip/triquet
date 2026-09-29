import { describe, expect, it } from 'vitest'
import { huntForLabel, realmsOf } from '../../../convex/reading'
import type { Id } from '../../../convex/_generated/dataModel'
import { SeedExpressions } from '../../../src/models/expression'
import { Question } from '../../../src/models/question'
import { Quiz } from '../../../src/models/quiz'
import { present } from '../../support/present'
import { expectRefusal, huntHolding, openOf, openTester, seedHunt, type Tester } from '../../support/convex'

/** A hunt of two quizzes, the first holding two questions, with the seed expressions */
function huntOfTwo() {
  const questions = ['a', 'b'].map((title) => ({ ...Question.blank(), title }))
  return huntHolding([{ ...Quiz.blank('Quiz one'), questions }, Quiz.blank('Quiz two')], SeedExpressions)
}

/** The label `hunt_id` answers to, read back the way an address is: whichever hunt the label finds */
async function answersTo(tt: Tester, label: string): Promise<Id<'hunts'> | null> {
  const hunt = await tt.run(async (ctx) => await huntForLabel(ctx.db, label))
  return hunt?._id ?? null
}

/** How many rows each table holds that belong to a hunt, one way or another */
async function rowCounts(tt: Tester) {
  return await tt.run(async (ctx) => {
    const tablenames = ['hunts', 'realms', 'expressions', 'quizzes', 'widgets', 'columns', 'questions', 'bottings', 'reviews', 'reviewings', 'huntings'] as const
    const counts = await Promise.all(tablenames.map(async (tablename) => {
      const rows = await ctx.db.query(tablename).collect()
      return [tablename, rows.length] as const
    }))
    return Object.fromEntries(counts)
  })
}

describe('hunts.perform: relabel_hunt', () => {
  it('makes the hunt answer to the new label, and no longer to the old', async () => {
    const { tt, act, open } = await seedHunt(openTester(), huntOfTwo())
    const minted = present(await tt.run(async (ctx) => await ctx.db.get('hunts', open.hunt_id))).label
    await act({ kind: 'relabel_hunt', label: 'autumn_hunt' })
    expect([await answersTo(tt, 'autumn_hunt'), await answersTo(tt, minted)]).to.deep.eq([open.hunt_id, null])
  })

  it('clears the override when relabelled back to the label it was minted with', async () => {
    const { tt, act, open } = await seedHunt(openTester(), huntOfTwo())
    const minted = present(await tt.run(async (ctx) => await ctx.db.get('hunts', open.hunt_id))).label
    await act({ kind: 'relabel_hunt', label: 'autumn_hunt' })
    await act({ kind: 'relabel_hunt', label: minted })
    const hunt = present(await tt.run(async (ctx) => await ctx.db.get('hunts', open.hunt_id)))
    expect([hunt.forced_label, await answersTo(tt, minted)]).to.deep.eq([null, open.hunt_id])
  })

  it('refuses a label another hunt answers to, writing nothing', async () => {
    const tt = openTester()
    const mine = await seedHunt(tt, huntOfTwo())
    const theirs = await seedHunt(tt, huntOfTwo(), { smith: 'other_smith' })
    await theirs.act({ kind: 'relabel_hunt', label: 'autumn_hunt' })
    await expectRefusal(mine.act({ kind: 'relabel_hunt', label: 'autumn_hunt' }), 'labelTaken')
    expect(await answersTo(tt, 'autumn_hunt')).to.eq(theirs.open.hunt_id)
  })

  it('refuses a reviewer, as not theirs to change', async () => {
    const { act, join } = await seedHunt(openTester(), huntOfTwo())
    const reviewer = await join('bob_reviews', 'reviewer')
    await expectRefusal(act({ kind: 'relabel_hunt', label: 'autumn_hunt' }, reviewer.browser_key), 'notPermitted')
  })

  it('works on a locked quiz, since the hunt is not the quiz', async () => {
    const { tt, act, open } = await seedHunt(openTester(), huntHolding([{ ...Quiz.blank('Quiz one'), locked: true }]))
    await act({ kind: 'relabel_hunt', label: 'autumn_hunt' })
    expect(await answersTo(tt, 'autumn_hunt')).to.eq(open.hunt_id)
  })
})

describe('hunts.perform: delete_hunt', () => {
  it('takes every row the hunt holds with it, and leaves another hunt, and the idents, alone', async () => {
    const tt = openTester()
    const spared = await seedHunt(tt, huntOfTwo(), { smith: 'spared_smith' })
    const ante = await rowCounts(tt)
    const doomed = await seedHunt(tt, huntOfTwo())
    const question_id = present(openOf(await doomed.read()).questions[0])._id as Id<'questions'>
    const reviewer = await doomed.join('bob_reviews', 'reviewer')
    await doomed.act({ kind: 'open_review', quiz_id: doomed.open.quiz_id }, reviewer.browser_key)
    await doomed.act({ kind: 'set_reviewing', quiz_id: doomed.open.quiz_id, question_id, patch: { keep_it: true } }, reviewer.browser_key)
    await doomed.act({ kind: 'record_botting', botting: {
      question_id, bot_label: 'dumdum', textkind: 'clueing', asked_text: '', status: 'done', reply_text: 'Hamlet', items: [],
      message: null, response: null, truncated: false, model_tier_applied: 'quick', approx_tokens: null,
    } })

    await doomed.act({ kind: 'delete_hunt' })
    const idents = await tt.run(async (ctx) => await ctx.db.query('idents').collect())
    expect(await rowCounts(tt)).to.deep.eq(ante)
    expect(idents.map((ident) => ident.label)).to.include.members(['seed_smith', 'bob_reviews'])
    const { quizzes } = await spared.read()
    expect(quizzes.map((quiz) => quiz.title)).to.deep.eq(['Quiz one', 'Quiz two'])
  })

  it('refuses a reviewer, deleting nothing', async () => {
    const { tt, act, join, open } = await seedHunt(openTester(), huntOfTwo())
    const reviewer = await join('bob_reviews', 'reviewer')
    await expectRefusal(act({ kind: 'delete_hunt' }, reviewer.browser_key), 'notPermitted')
    const realms = await tt.run(async (ctx) => await realmsOf(ctx.db, open.hunt_id))
    expect(realms).to.have.lengthOf(1)
  })
})
