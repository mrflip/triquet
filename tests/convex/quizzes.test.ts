import _ from 'es-toolkit/compat'
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
import { affirmsOf, huntHolding, identified, openTester, putOn, seedHunt, type AffirmsBag, type Identified, type Tester } from '../support/convex'
import { seedHuntRows } from '../support/seed'

/**
 * What a test reads a quiz through: a deployment, and the sessions of a reviewer and a smith on the
 * quiz's hunt, with what each affirms of themselves there
 */
type Reading = { tt: Tester, alice: Identified, affirms: AffirmsBag, sam: Identified, smiths: AffirmsBag }

/** A fresh deployment holding `hunt` with a reviewer and a smith on it; its first quiz's id, and its questions' ids in order */
async function holding(hunt: HuntT): Promise<Reading & { quiz_id: Id<'quizzes'>, question_ids: Id<'questions'>[] }> {
  const tt = openTester()
  const hunt_id = await tt.run(async (ctx) => await seedHuntRows(ctx.db, hunt))
  const [home] = await tt.run(async (ctx) => await realmsOf(ctx.db, hunt_id))
  const realm = present(home)
  const quiz_id = present(realm.quizzes[0])._id
  const question_ids = await tt.run(async (ctx) => present(await quizRowsOf(ctx.db, quiz_id)).questions.map((row) => row._id))
  const alice = await identified(tt, 'alice_reviews')
  await putOn(tt, hunt_id, alice.ident_id, 'reviewer')
  const sam = await identified(tt, 'sam_smiths')
  await putOn(tt, hunt_id, sam.ident_id, 'smith')
  const place = { hunt_id, realm_id: realm.realm._id, quiz_id }
  const [affirms, smiths] = [await affirmsOf(tt, alice, place), await affirmsOf(tt, sam, place)]
  return { tt, alice, affirms, sam, smiths, quiz_id, question_ids }
}

/** A hunt of one quiz, its questions labelled `aa`, `bb` and `cc` */
function threeQuestions(): HuntT {
  return huntHolding([{ ...Quiz.blank(), questions: ['aa', 'bb', 'cc'].map((label) => ({ ...Question.blank(), label, title: label.toUpperCase() })) }])
}

/**
 * The quiz as a browser reads it: its frame from `quizzes.open`, each question from
 * `questions.open`, assembled; as the smith reads it, unless a reader is given.
 */
async function opened({ sam, smiths }: Reading, quiz_id: Id<'quizzes'>, reader = sam, affirms = smiths) {
  const frame = present(await reader.as.query(api.quizzes.open, { affirms: { ...affirms.quiz, quiz_id } }))
  const seen = await Promise.all(frame.row_ordering.map(async (question_id) => present(await reader.as.query(api.questions.open, { question_id, affirms: affirms.hunt }))))
  return quizFromSeen(frame, seen)
}

describe("a quiz as the browser assembles it from quizzes.open and questions.open", () => {
  it("reads a reviewer the frame as a smith reads it, and of each question what a review needs, the rest blank", async () => {
    const written = { ...Question.blank(), label: 'aa', clueing: 'Who?', full_answer: 'Hamlet', notes: 'Check the folio.', alt_text: 'A prince.' }
    const hunt = huntHolding([{ ...Quiz.blank(), smiths_note: 'Theme: princes.', questions: [written] }])
    const { quiz_id, ...reading } = await holding(hunt)
    const [asSmith, asReviewer] = [await opened(reading, quiz_id), await opened(reading, quiz_id, reading.alice, reading.affirms)]
    expect(asReviewer.smiths_note).to.eq('Theme: princes.')
    expect(_.omit(asReviewer, ['questions'])).to.deep.eq(_.omit(asSmith, ['questions']))
    expect(asSmith.questions[0]).to.deep.include({ full_answer: 'Hamlet', notes: 'Check the folio.', alt_text: 'A prince.' })
    expect(asReviewer.questions[0]).to.deep.include({ full_answer: 'Hamlet', clueing: 'Who?', notes: '', alt_text: '', stored: {} })
  })

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

  it("reads a chain held as a label as the id of the question answering to it", async () => {
    const { quiz_id, question_ids, ...reading } = await holding(threeQuestions())
    const { tt } = reading
    const [first, second, third] = question_ids
    await tt.run(async (ctx) => {
      await ctx.db.patch('questions', present(first), { chains_to: 'cc' })
      await ctx.db.patch('questions', present(second), { label: 'bee' })
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
        await ctx.db.insert('widgeteds', { hunt_id: present(widgeting).hunt_id, quiz_id, question_id: present(question_id), widgeting_id, status: 'ok', value: { items: [{ text, value: 1, kind: 'numeral' }] }, message: null, result_meta: {} })
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
    const { alice, affirms, question_ids } = await holding(threeQuestions())
    const frame = present(await alice.as.query(api.quizzes.open, { affirms: affirms.quiz }))
    expect(frame.row_ordering).to.deep.eq(question_ids)
    expect(frame).to.not.have.any.keys('questions', 'realm_id', '_creationTime')
    expect(frame).to.include.keys('widgetings', 'columns')
  })

  it("reads null for a quiz that is not there", async () => {
    const { tt, alice, affirms, quiz_id } = await holding(Hunt.blank())
    await tt.run(async (ctx) => { await ctx.db.delete('quizzes', quiz_id) })
    expect(await alice.as.query(api.quizzes.open, { affirms: affirms.quiz })).to.be.null
  })

  it("reads null, as for one not there, for someone not on its hunt, or with no session", async () => {
    const { tt, affirms } = await holding(Hunt.blank())
    const stranger = await identified(tt, 'carol_strays')
    expect(await stranger.as.query(api.quizzes.open, { affirms: { ...affirms.quiz, ident_id: stranger.ident_id, standing: 'stranger' } })).to.be.null
    expect(await tt.query(api.quizzes.open, { affirms: affirms.quiz })).to.be.null
  })

  it("reads null for affirms that are not so: a standing not held, another's ident, or a quiz of another hunt", async () => {
    const { tt, alice, affirms } = await holding(Hunt.blank())
    const stranger = await identified(tt, 'carol_strays')
    const other = await seedHunt(tt, Hunt.blank('loud_heron'), { smith: 'carol_strays' })
    expect(await alice.as.query(api.quizzes.open, { affirms: { ...affirms.quiz, standing: 'smith' } })).to.be.null
    expect(await stranger.as.query(api.quizzes.open, { affirms: affirms.quiz })).to.be.null
    expect(await alice.as.query(api.quizzes.open, { affirms: { ...affirms.quiz, quiz_id: other.open.quiz_id } })).to.be.null
    expect(await alice.as.query(api.quizzes.open, { affirms: affirms.quiz })).to.not.be.null
  })
})
