import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { quizRowsOf, realmsOf } from '../../convex/reading'
import { quizFromSeen } from '../../src/lib/rows'
import { Hunt, type HuntT } from '../../src/models/hunt'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { present } from '../support/present'
import { huntHolding, openTester, type Tester } from '../support/convex'
import { seedHuntRows } from '../support/seed'

/** A fresh deployment holding `hunt`, its first quiz's id, and its questions' ids in order */
async function holding(hunt: HuntT): Promise<{ tt: Tester, quiz_id: Id<'quizzes'>, question_ids: Id<'questions'>[] }> {
  const tt = openTester()
  const hunt_id = await tt.run(async (ctx) => await seedHuntRows(ctx.db, hunt))
  const [home] = await tt.run(async (ctx) => await realmsOf(ctx.db, hunt_id))
  const quiz_id = present(present(home).quizzes[0])._id
  const question_ids = await tt.run(async (ctx) => present(await quizRowsOf(ctx.db, quiz_id)).questions.map((row) => row._id))
  return { tt, quiz_id, question_ids }
}

/** A hunt of one quiz, its questions labelled `aa`, `bb` and `cc` */
function threeQuestions(): HuntT {
  return huntHolding([{ ...Quiz.blank(), questions: ['aa', 'bb', 'cc'].map((label) => ({ ...Question.blank(), label, title: label.toUpperCase() })) }])
}

/** The quiz as a browser reads it: its frame from `quizzes.open`, each question from `questions.open`, assembled */
async function opened(tt: Tester, quiz_id: Id<'quizzes'>) {
  const frame = present(await tt.query(api.quizzes.open, { quiz_id }))
  const seen = await Promise.all(frame.row_ordering.map(async (question_id) => present(await tt.query(api.questions.open, { question_id }))))
  return quizFromSeen(frame, seen)
}

describe('a quiz as the browser assembles it from quizzes.open and questions.open', () => {
  it('reads back a quiz exactly as it was written, apart from its ids', async () => {
    const hunt = Hunt.blank()
    const { tt, quiz_id } = await holding(hunt)
    const written = present(Hunt.quizzesOf(hunt)[0])
    const back = await opened(tt, quiz_id)
    const sansIds = (quiz: typeof back) => ({ ...quiz, _id: '', questions: quiz.questions.map((question) => ({ ...question, _id: '' })) })
    expect(sansIds(back)).to.deep.eq(sansIds(written))
  })

  it('names the quiz and each question by its row\'s id', async () => {
    const { tt, quiz_id, question_ids } = await holding(threeQuestions())
    const quiz = await opened(tt, quiz_id)
    expect([quiz._id, ...quiz.questions.map((question) => question._id)]).to.deep.eq([quiz_id, ...question_ids])
  })

  it('reads a chain held as a label as the id of the question answering to it, by the label in force', async () => {
    const { tt, quiz_id, question_ids } = await holding(threeQuestions())
    const [first, second, third] = question_ids
    await tt.run(async (ctx) => {
      await ctx.db.patch('questions', present(first), { chains_to: 'cc' })
      await ctx.db.patch('questions', present(second), { forced_label: 'bee' })
      await ctx.db.patch('questions', present(third), { chains_to: 'bee' })
    })
    const quiz = await opened(tt, quiz_id)
    expect(quiz.questions.map((question) => question.chains_to)).to.deep.eq([third, null, second])
  })

  it('reads a chain to no question here, or to itself, as no chain', async () => {
    const { tt, quiz_id, question_ids } = await holding(threeQuestions())
    const [first, second] = question_ids
    await tt.run(async (ctx) => {
      await ctx.db.patch('questions', present(first), { chains_to: 'nobody' })
      await ctx.db.patch('questions', present(second), { chains_to: 'bb' })
    })
    const quiz = await opened(tt, quiz_id)
    expect(quiz.questions.map((question) => question.chains_to)).to.deep.eq([null, null, null])
  })

  it('shows each cell\'s newest reply in whole milliseconds, stale once its text is edited', async () => {
    const { tt, quiz_id, question_ids } = await holding(threeQuestions())
    const [question_id] = question_ids
    const ask = async (reply: string) => {
      await tt.run(async (ctx) => {
        await ctx.db.insert('bottings', {
          question_id: present(question_id), bot_label: 'numnum', textkind: 'clueing', asked_text: '', status: 'done', reply_text: null,
          items: [{ text: reply, value: 1, kind: 'numeral' }], message: null, response: null, truncated: false, model_tier_applied: null, approx_tokens: null,
        })
      })
    }
    await ask('older')
    await ask('newer')
    const freshQuiz = await opened(tt, quiz_id)
    const fresh = present(freshQuiz.questions[0]).clueing_ishes
    expect(fresh).to.deep.include({ status: 'done', items: [{ text: 'newer', value: 1, kind: 'numeral' }], stale: false })
    expect(Number.isSafeInteger(fresh?.updated_at)).to.eq(true)
    await tt.run(async (ctx) => { await ctx.db.patch('questions', present(question_id), { clueing: 'Reworded' }) })
    const editedQuiz = await opened(tt, quiz_id)
    expect(present(editedQuiz.questions[0]).clueing_ishes).to.deep.include({ stale: true })
  })

})

describe('quizzes.open', () => {
  it('reads the quiz without its questions: its fields, its layout, and its questions\' order by id', async () => {
    const { tt, quiz_id, question_ids } = await holding(threeQuestions())
    const frame = present(await tt.query(api.quizzes.open, { quiz_id }))
    expect(frame.row_ordering).to.deep.eq(question_ids)
    expect(frame).to.not.have.any.keys('questions', 'realm_id', '_creationTime')
    expect(frame).to.include.keys('widgets', 'columns')
  })

  it('reads null for a quiz that is not there', async () => {
    const { tt, quiz_id } = await holding(Hunt.blank())
    await tt.run(async (ctx) => { await ctx.db.delete('quizzes', quiz_id) })
    expect(await tt.query(api.quizzes.open, { quiz_id })).to.eq(null)
  })
})
