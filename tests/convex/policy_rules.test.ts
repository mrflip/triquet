import _ from 'es-toolkit/compat'
import { describe, expect, it } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import type { MutationCtx } from '../../convex/_generated/server'
import { ReadingRules, scopedReader, scopedWriter, WritingRules, type ScopeClaimsT } from '../../convex/policy_rules'
import { reviewsOf } from '../../convex/reading'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { Widgeting } from '../../src/models/widgeting'
import { huntHolding, openTester, seedHunt, type Identified, type Seeded, type Tester } from '../support/convex'
import { present } from '../support/present'
import { expectSound } from '../support/soundness'

/** The tables a hunt owns, each row of which carries the hunt it belongs to */
const HuntOwnedTablenames = ['realms', 'quizzes', 'questions', 'widgetings', 'columns', 'widgeteds', 'huntings', 'reviews', 'reviewings'] as const
type HuntOwnedTablename = typeof HuntOwnedTablenames[number]

/** One row of each table a hunt owns, and the hunt's own, by table */
type RowIdsT = { [TN in HuntOwnedTablename | 'hunts']: Id<TN> }

/** A hunt labelled `label` whose quiz holds a row of every table a hunt owns: a question, a widgeting that stored for it, a column, and its smith's review with a verdict */
async function stocked(tt: Tester, label: string, smith: string): Promise<{ seeded: Seeded, rows: RowIdsT }> {
  const widgetings = [Widgeting.fill({ widget_label: 'dumdum', label: 'dumdum' })]
  const hunt = { ...huntHolding([{ ...Quiz.blank(), widgetings, questions: [{ ...Question.blank(), label: 'aa' }] }]), label }
  const seeded = await seedHunt(tt, hunt, { smith })
  const { hunt_id, realm_id, quiz_id } = seeded.open
  await seeded.act({ kind: 'add_column', column: { label: 'qnum', title: 'Qnum', source: 'question.qnum', width_px: 80 } })
  await seeded.act({ kind: 'open_review', quiz_id })
  const question_id = await tt.run(async (ctx) => present(await ctx.db.query('questions').withIndex('by_quiz_id', (cvx) => cvx.eq('quiz_id', quiz_id)).first())._id)
  await seeded.act({ kind: 'set_reviewing', quiz_id, question_id, patch: { keep_it: true } })
  const rows = await tt.run(async (ctx) => {
    const widgeting = present(await ctx.db.query('widgetings').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz_id)).first())
    const widgeted_id = await ctx.db.insert('widgeteds', { hunt_id, quiz_id, question_id, widgeting_id: widgeting._id, status: 'ok', value: { guess: 'Leon', explanation: '' }, message: null, result_meta: {} })
    const review = present(await ctx.db.query('reviews').withIndex('by_quiz_id', (cvx) => cvx.eq('quiz_id', quiz_id)).first())
    return {
      hunts:      hunt_id,
      realms:     realm_id,
      quizzes:    quiz_id,
      questions:  question_id,
      widgetings: widgeting._id,
      columns:    present(await ctx.db.query('columns').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz_id)).first())._id,
      widgeteds:  widgeted_id,
      huntings:   present(await ctx.db.query('huntings').withIndex('by_hunt_id', (cvx) => cvx.eq('hunt_id', hunt_id)).first())._id,
      reviews:    review._id,
      reviewings: present(await ctx.db.query('reviewings').withIndex('by_review_id_and_question_id', (cvx) => cvx.eq('review_id', review._id)).first())._id,
    }
  })
  return { seeded, rows }
}

/** The claims of `by` on the hunt `hunt_id`, as `affirmForHunt` would hand them on */
function claimsOf(by: Identified, hunt_id: Id<'hunts'>, standing: ScopeClaimsT['standing']): ScopeClaimsT {
  return { ...by.actor, hunt_id, standing }
}

/** Two stocked hunts, each with its own smith: ours, alice's, and theirs, bob's */
async function twoHunts() {
  const tt = openTester()
  const ours = await stocked(tt, 'quiet_otter', 'alice_smiths')
  const theirs = await stocked(tt, 'loud_heron', 'bob_smiths')
  const claims = claimsOf(ours.seeded.smith, ours.seeded.open.hunt_id, 'smith')
  return { tt, ours, theirs, claims }
}

/** How a write through a scoped database went: `'wrote'`, or the message it was refused with */
async function outcomeOf(pending: Promise<unknown>): Promise<string> {
  try {
    await pending
  } catch (err) {
    return (err as Error).message
  }
  return 'wrote'
}

/** `row` without the fields the database owns, as it would be inserted */
function insertable(row: object): object {
  return _.omit(row, ['_id', '_creationTime'])
}

/**
 * What a database scoped to `claims` makes of the row `row_id` of `tablename`: whether `get` finds
 * it, whether a query of the table lists it, and how a patch, a delete and an insert of its like go.
 */
async function probe<TN extends HuntOwnedTablename | 'hunts'>(tt: Tester, claims: ScopeClaimsT, tablename: TN, row_id: Id<TN>) {
  return await tt.run(async (ctx: MutationCtx) => {
    const held = present(await ctx.db.get(tablename, row_id as never))
    const db = scopedWriter(ctx.db, claims)
    const got = await db.get(tablename, row_id as never)
    const listed = await db.query(tablename).take(1000)
    return {
      gets:    got !== null,
      lists:   listed.some((row) => row._id === row_id),
      patch:   await outcomeOf(db.patch(tablename, row_id as never, {})),
      remove:  await outcomeOf(db.delete(tablename, row_id as never)),
      insert:  await outcomeOf(db.insert(tablename, insertable(held) as never)),
    }
  })
}

describe("a database scoped to one hunt", () => {
  for (const tablename of [...HuntOwnedTablenames, 'hunts'] as const) {
    it(`neither sees nor writes a row of ${tablename} of another hunt, and sees and writes its own`, async () => {
      const { tt, ours, theirs, claims } = await twoHunts()
      const NotThere = 'no read access or doc does not exist'
      const NoInsert = 'insert access not allowed'
      expect(await probe(tt, claims, tablename, theirs.rows[tablename] as never)).to.deep.eq({ gets: false, lists: false, patch: NotThere, remove: NotThere, insert: NoInsert })
      const own = await probe(tt, claims, tablename, ours.rows[tablename] as never)
      // A hunt is made from the hunts list, never from inside one
      expect(own).to.deep.eq({ gets: true, lists: true, patch: 'wrote', remove: 'wrote', insert: tablename === 'hunts' ? NoInsert : 'wrote' })
    })
  }

  it("reaches no ident's identings, and none of Convex Auth's tables", async () => {
    const { tt, claims } = await twoHunts()
    const seen = await tt.run(async (ctx) => {
      const [identing, session] = await Promise.all([ctx.db.query('identings').first(), ctx.db.query('authSessions').first()])
      const db = scopedReader(ctx.db, claims)
      return [
        await db.get('identings', present(identing)._id), await db.query('identings').take(10),
        await db.get('authSessions', present(session)._id), await db.query('users').take(10),
      ]
    })
    expect(seen).to.deep.eq([null, [], null, []])
  })

  it("sees every ident, as the persona it is, and writes none", async () => {
    const { tt, theirs, claims } = await twoHunts()
    const bob_id = theirs.seeded.smith.ident_id
    const outcomes = await tt.run(async (ctx) => {
      const db = scopedWriter(ctx.db, claims)
      const bob = await db.get('idents', bob_id)
      return [bob?.label, await outcomeOf(db.patch('idents', bob_id, { title: 'Bobby' }))]
    })
    expect(outcomes).to.deep.eq(['bob_smiths', 'write access not allowed'])
  })

  it("shows the library to anyone on the hunt, and changes it as Approve says a smith of the hunt may", async () => {
    const { tt, ours, claims } = await twoHunts()
    const carol = await ours.seeded.join('carol_reviews', 'reviewer')
    const reviewer = claimsOf(carol, ours.seeded.open.hunt_id, 'reviewer')
    const outcomesFor = async (scope: ScopeClaimsT) => await tt.run(async (ctx) => {
      const db = scopedWriter(ctx.db, scope)
      const widget = present(await db.query('widgets').first())
      return [widget.label, await outcomeOf(db.patch('widgets', widget._id, { title: 'Renamed' }))]
    })
    expect([await outcomesFor(claims), await outcomesFor(reviewer)]).to.deep.eq([['dumdum', 'wrote'], ['dumdum', 'write access not allowed']])
  })
})

/** Our stocked hunt, with a reviewer's draft review beside the smith's, and the claims of each */
async function reviewed() {
  const { tt, ours, theirs, claims } = await twoHunts()
  const carol = await ours.seeded.join('carol_reviews', 'reviewer')
  const { quiz_id } = ours.seeded.open
  await ours.seeded.act({ kind: 'open_review', quiz_id }, carol)
  await ours.seeded.act({ kind: 'set_reviewing', quiz_id, question_id: ours.rows.questions, patch: { keep_it: true } }, carol)
  const reviewer = claimsOf(carol, ours.seeded.open.hunt_id, 'reviewer')
  return { tt, ours, theirs, claims, carol, reviewer, quiz_id }
}

describe("a review, through a database scoped to its hunt", () => {
  it("is written by its writer, and by no other reviewer; a smith deletes another's with what it is part of", async () => {
    const { tt, ours, reviewer } = await reviewed()
    const outcomes = await tt.run(async (ctx) => {
      const db = scopedWriter(ctx.db, reviewer)
      return [
        await outcomeOf(db.patch('reviews', ours.rows.reviews, { overall: 'Forged' })),
        await outcomeOf(db.patch('reviewings', ours.rows.reviewings, { keep_it: false })),
      ]
    })
    expect(outcomes).to.deep.eq(['write access not allowed', 'write access not allowed'])
  })

  it("is seen whole by a mutation, which counts and deletes them, and shown by a query only as Approve.mayReadReview says", async () => {
    const { tt, quiz_id, claims, reviewer } = await reviewed()
    const counted = await tt.run(async (ctx) => {
      const seen = await Promise.all([
        reviewsOf(scopedWriter(ctx.db, claims), quiz_id),
        reviewsOf(scopedWriter(ctx.db, reviewer), quiz_id),
        reviewsOf(scopedReader(ctx.db, claims), quiz_id),
        reviewsOf(scopedReader(ctx.db, { ...reviewer, own_review: null }), quiz_id),
      ])
      return seen.map((reviews) => reviews.length)
    })
    // The smith's own, and the reviewer's draft hidden from them; the reviewer judged as having none, their own still theirs
    expect(counted).to.deep.eq([2, 2, 1, 1])
  })
})

describe("the cascades, through hunts.perform's scoped database", () => {
  it("delete a quiz whole, others' draft reviews and verdicts with it, and leave the other hunt as it was", async () => {
    const tt = openTester()
    const widgetings = [Widgeting.fill({ widget_label: 'dumdum', label: 'dumdum' })]
    const ours = await seedHunt(tt, huntHolding([{ ...Quiz.blank('One'), widgetings }, Quiz.blank('Two')]), { smith: 'alice_smiths' })
    const theirs = await stocked(tt, 'loud_heron', 'bob_smiths')
    const carol = await ours.join('carol_reviews', 'reviewer')
    const { quiz_id } = ours.open
    const question_id = await tt.run(async (ctx) => present(await ctx.db.query('questions').withIndex('by_quiz_id', (cvx) => cvx.eq('quiz_id', quiz_id)).first())._id)
    await ours.act({ kind: 'open_review', quiz_id }, carol)
    await ours.act({ kind: 'set_reviewing', quiz_id, question_id, patch: { keep_it: true } }, carol)
    const before = await theirs.seeded.read()
    await ours.act({ kind: 'delete_quiz', quiz_id })
    const left = await tt.run(async (ctx) => [
      await ctx.db.query('reviews').withIndex('by_quiz_id', (cvx) => cvx.eq('quiz_id', quiz_id)).take(10),
      await ctx.db.query('reviewings').withIndex('by_question_id', (cvx) => cvx.eq('question_id', question_id)).take(10),
    ])
    expect(left).to.deep.eq([[], []])
    expect(await theirs.seeded.read()).to.deep.eq(before)
    await expectSound(tt)
  })

  it("delete a hunt whole, and leave the other hunt as it was", async () => {
    const { tt, ours, theirs } = await twoHunts()
    const carol = await ours.seeded.join('carol_reviews', 'reviewer')
    const { quiz_id } = ours.seeded.open
    await ours.seeded.act({ kind: 'open_review', quiz_id }, carol)
    const before = await theirs.seeded.read()
    await ours.seeded.act({ kind: 'delete_hunt' })
    expect(await tt.run(async (ctx) => await ctx.db.get('hunts', ours.rows.hunts))).to.be.null
    expect(await theirs.seeded.read()).to.deep.eq(before)
    await expectSound(tt)
  })
})

describe("the rules", () => {
  it("are one per table a scoped database reaches, and a query's differ from a mutation's only in which reviews they show", () => {
    expect(Object.keys(ReadingRules)).to.deep.eq(Object.keys(WritingRules))
    const differing = Object.keys(WritingRules).filter((tablename) => ReadingRules[tablename as keyof typeof ReadingRules] !== WritingRules[tablename as keyof typeof WritingRules])
    expect(differing).to.deep.eq(['reviews'])
    expect(Object.keys(WritingRules)).to.not.include.members(['identings', 'users', 'authSessions'])
  })
})
