import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { quizRowsOf, realmsOf, widgetingsOf } from '../../convex/reading'
import { quizFromSeen } from '../../src/lib/rows'
import { Hunt, type HuntT } from '../../src/models/hunt'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { Widgeting } from '../../src/models/widgeting'
import { present } from '../support/present'
import { huntHolding, identified, openTester, putOn, type Tester } from '../support/convex'
import { seedHuntRows } from '../support/seed'

/** What a test reads a quiz through: a deployment, and the browser of a reviewer on the quiz's hunt */
type Reading = { tt: Tester, browser_key: string }

/** A fresh deployment holding `hunt` with a reviewer on it; its first quiz's id, and its questions' ids in order */
async function holding(hunt: HuntT): Promise<Reading & { quiz_id: Id<'quizzes'>, question_ids: Id<'questions'>[] }> {
  const tt = openTester()
  const hunt_id = await tt.run(async (ctx) => await seedHuntRows(ctx.db, hunt))
  const [home] = await tt.run(async (ctx) => await realmsOf(ctx.db, hunt_id))
  const quiz_id = present(present(home).quizzes[0])._id
  const question_ids = await tt.run(async (ctx) => present(await quizRowsOf(ctx.db, quiz_id)).questions.map((row) => row._id))
  const { browser_key, ident_id } = await identified(tt, 'alice_reviews')
  await putOn(tt, hunt_id, ident_id, 'reviewer')
  return { tt, browser_key, quiz_id, question_ids }
}

/** A hunt of one quiz, its questions labelled `aa`, `bb` and `cc` */
function threeQuestions(): HuntT {
  return huntHolding([{ ...Quiz.blank(), questions: ['aa', 'bb', 'cc'].map((label) => ({ ...Question.blank(), label, title: label.toUpperCase() })) }])
}

/** The quiz as a browser reads it: its frame from `quizzes.open`, each question from `questions.open`, assembled */
async function opened({ tt, browser_key }: Reading, quiz_id: Id<'quizzes'>) {
  const frame = present(await tt.query(api.quizzes.open, { quiz_id, browser_key }))
  const seen = await Promise.all(frame.row_ordering.map(async (question_id) => present(await tt.query(api.questions.open, { question_id, browser_key }))))
  return quizFromSeen(frame, seen)
}

describe("a quiz as the browser assembles it from quizzes.open and questions.open", () => {
  it("reads back a quiz exactly as it was written, apart from its ids", async () => {
    const hunt = Hunt.blank()
    const { quiz_id, ...reading } = await holding(hunt)
    const written = present(Hunt.quizzesOf(hunt)[0])
    const back = await opened(reading, quiz_id)
    const sansIds = (quiz: typeof back) => ({ ...quiz, _id: '', questions: quiz.questions.map((question) => ({ ...question, _id: '' })) })
    expect(sansIds(back)).to.deep.eq(sansIds(written))
  })

  it("names the quiz and each question by its row's id", async () => {
    const { quiz_id, question_ids, ...reading } = await holding(threeQuestions())
    const quiz = await opened(reading, quiz_id)
    expect([quiz._id, ...quiz.questions.map((question) => question._id)]).to.deep.eq([quiz_id, ...question_ids])
  })

  it("reads a chain held as a label as the id of the question answering to it, by the label in force", async () => {
    const { quiz_id, question_ids, ...reading } = await holding(threeQuestions())
    const { tt } = reading
    const [first, second, third] = question_ids
    await tt.run(async (ctx) => {
      await ctx.db.patch('questions', present(first), { chains_to: 'cc' })
      await ctx.db.patch('questions', present(second), { forced_label: 'bee' })
      await ctx.db.patch('questions', present(third), { chains_to: 'bee' })
    })
    const quiz = await opened(reading, quiz_id)
    expect(quiz.questions.map((question) => question.chains_to)).to.deep.eq([third, null, second])
  })

  it("reads a chain to no question here, or to itself, as no chain", async () => {
    const { quiz_id, question_ids, ...reading } = await holding(threeQuestions())
    const { tt } = reading
    const [first, second] = question_ids
    await tt.run(async (ctx) => {
      await ctx.db.patch('questions', present(first), { chains_to: 'nobody' })
      await ctx.db.patch('questions', present(second), { chains_to: 'bb' })
    })
    const quiz = await opened(reading, quiz_id)
    expect(quiz.questions.map((question) => question.chains_to)).to.deep.eq([null, null, null])
  })

  it("carries what each stored widgeting recorded onto its question: the newest row, and the newest ok one", async () => {
    const widgetings = [Widgeting.fill({ widget_label: 'numnum_clueing', label: 'numnum_clueing' })]
    const hunt = huntHolding([{ ...Quiz.blank(), widgetings, questions: ['aa', 'bb'].map((label) => ({ ...Question.blank(), label })) }])
    const { quiz_id, question_ids, ...reading } = await holding(hunt)
    const { tt } = reading
    const [question_id] = question_ids
    await tt.run(async (ctx) => {
      const [widgeting] = await widgetingsOf(ctx.db, quiz_id)
      const widgeting_id = present(widgeting)._id
      for (const text of ['older', 'newer']) {
        await ctx.db.insert('widgeteds', { question_id: present(question_id), widgeting_id, status: 'ok', value: { items: [{ text, value: 1, kind: 'numeral' }] }, message: null, result_meta: {} })
      }
    })
    const quiz = await opened(reading, quiz_id)
    const [first, second] = quiz.questions.map((question) => question.stored)
    expect(present(first?.numnum_clueing?.ok).value).to.deep.eq({ items: [{ text: 'newer', value: 1, kind: 'numeral' }] })
    expect(first?.numnum_clueing?.newest).to.deep.eq(first?.numnum_clueing?.ok)
    expect(second).to.deep.eq({})
  })
})

describe("quizzes.open", () => {
  it("reads the quiz without its questions: its fields, its layout, and its questions' order by id", async () => {
    const { tt, browser_key, quiz_id, question_ids } = await holding(threeQuestions())
    const frame = present(await tt.query(api.quizzes.open, { quiz_id, browser_key }))
    expect(frame.row_ordering).to.deep.eq(question_ids)
    expect(frame).to.not.have.any.keys('questions', 'realm_id', '_creationTime')
    expect(frame).to.include.keys('widgetings', 'columns')
  })

  it("reads null for a quiz that is not there", async () => {
    const { tt, browser_key, quiz_id } = await holding(Hunt.blank())
    await tt.run(async (ctx) => { await ctx.db.delete('quizzes', quiz_id) })
    expect(await tt.query(api.quizzes.open, { quiz_id, browser_key })).to.be.null
  })

  it("reads null, as for one not there, for someone not on its hunt", async () => {
    const { tt, quiz_id } = await holding(Hunt.blank())
    const stranger = await identified(tt, 'carol_strays')
    expect(await tt.query(api.quizzes.open, { quiz_id, browser_key: stranger.browser_key })).to.be.null
  })
})
