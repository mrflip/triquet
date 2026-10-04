import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import { realmsOf, quizRowsOf } from '../../convex/reading'
import { Hunt } from '../../src/models/hunt'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { Widgeting } from '../../src/models/widgeting'
import { present } from '../support/present'
import { affirmsOf, huntHolding, identified, openTester, putOn, seedHunt } from '../support/convex'
import { seedHuntRows } from '../support/seed'

/** The widgetings of the quiz `holding` writes: two that store (one asked, one never), and one worked out on render */
const Widgetings = [
  Widgeting.fill({ widget_label: 'dumdum', label: 'dumdum' }),
  Widgeting.fill({ widget_label: 'numnum_clueing', label: 'numnum_clueing' }),
  Widgeting.fill({ widget_label: 'clueing_word_count', label: 'clueing_word_count' }),
]

/**
 * A fresh deployment holding one quiz of two questions, `aa` chained to `bb`, whose `dumdum`
 * widgeting answered for `aa` twice and then failed; the first question's id, where it sits, and
 * the session of a reviewer on the hunt, with what that reviewer affirms of themselves there.
 */
async function holding() {
  const tt = openTester()
  const questions = [{ ...Question.blank(), label: 'aa', clueing: 'Who?' }, { ...Question.blank(), label: 'bb' }]
  const hunt_id = await tt.run(async (ctx) => await seedHuntRows(ctx.db, huntHolding([{ ...Quiz.blank(), questions, widgetings: Widgetings }])))
  const { question_id, place } = await tt.run(async (ctx) => {
    const [home] = await realmsOf(ctx.db, hunt_id)
    const realm = present(home)
    const quiz = present(realm.quizzes[0])
    const rows = present(await quizRowsOf(ctx.db, quiz._id))
    const first = present(rows.questions[0])._id
    const widgeting_id = present(rows.widgetings.find((widgeting) => widgeting.label === 'dumdum'))._id
    await ctx.db.patch('questions', first, { chains_to: 'bb' })
    for (const recorded of [
      { status: 'ok' as const,      value: { guess: 'Hamlet', explanation: 'A prince.' }, message: null },
      { status: 'ok' as const,      value: { guess: 'Leon', explanation: 'A lion.' },     message: null },
      { status: 'errored' as const, value: null,                                          message: 'Overloaded' },
    ]) { await ctx.db.insert('widgeteds', { question_id: first, widgeting_id, result_meta: {}, ...recorded }) }
    return { question_id: first, place: { hunt_id, realm_id: realm.realm._id, quiz_id: quiz._id } }
  })
  const alice = await identified(tt, 'alice_reviews')
  await putOn(tt, hunt_id, alice.ident_id, 'reviewer')
  const { hunt: affirms } = await affirmsOf(tt, alice, place)
  return { tt, question_id, place, alice, affirms }
}

describe("questions.open", () => {
  it("reads one question: its row, and for each widgeting that stored, the newest row and the newest ok one", async () => {
    const { question_id, alice, affirms } = await holding()
    const seen = present(await alice.as.query(api.questions.open, { question_id, affirms }))
    expect(seen).to.deep.include({ _id: question_id, label: 'aa', clueing: 'Who?' })
    expect(Object.keys(seen.stored)).to.deep.eq(['dumdum'])
    const cell = present(seen.stored.dumdum)
    expect(cell.newest).to.deep.include({ status: 'errored', value: null, message: 'Overloaded', result_meta: {} })
    expect(cell.ok).to.deep.include({ status: 'ok', value: { guess: 'Leon', explanation: 'A lion.' }, message: null })
    expect(present(cell.ok)._creationTime).to.be.below(cell.newest._creationTime)
  })

  it("reads nothing stored for a question none of its widgetings has recorded for", async () => {
    const { tt, question_id, alice, affirms } = await holding()
    const second = await tt.run(async (ctx) => {
      const question = present(await ctx.db.get('questions', question_id))
      return present(present(await ctx.db.get('quizzes', question.quiz_id)).row_ordering[1])
    })
    expect(present(await alice.as.query(api.questions.open, { question_id: second, affirms })).stored).to.deep.eq({})
  })

  it("leaves a chain as the label the row holds: only the quiz knows which question answers to it", async () => {
    const { question_id, alice, affirms } = await holding()
    expect(present(await alice.as.query(api.questions.open, { question_id, affirms })).chains_to).to.eq('bb')
  })

  it("reads null for a question that is not there", async () => {
    const { tt, question_id, alice, affirms } = await holding()
    await tt.run(async (ctx) => { await ctx.db.delete('questions', question_id) })
    expect(await alice.as.query(api.questions.open, { question_id, affirms })).to.be.null
  })

  it("reads null, as for one not there, for someone not on its hunt", async () => {
    const { tt, question_id, place, affirms } = await holding()
    const stranger = await identified(tt, 'carol_strays')
    const { hunt: strangers } = await affirmsOf(tt, stranger, place)
    expect(strangers.standing).to.eq('stranger')
    expect(await stranger.as.query(api.questions.open, { question_id, affirms: strangers })).to.be.null
    expect(await tt.query(api.questions.open, { question_id, affirms })).to.be.null
  })

  it("reads null for affirms that are not so: a standing not held, another's ident, or a hunt the question is not of", async () => {
    const { tt, question_id, alice, affirms } = await holding()
    const stranger = await identified(tt, 'carol_strays')
    const other = await seedHunt(tt, Hunt.blank('loud_heron'), { smith: 'alice_reviews' })
    const { hunt: elsewhere } = await affirmsOf(tt, alice, other.open)
    expect(elsewhere.standing).to.eq('smith')
    expect(await alice.as.query(api.questions.open, { question_id, affirms: { ...affirms, standing: 'smith' } })).to.be.null
    expect(await stranger.as.query(api.questions.open, { question_id, affirms })).to.be.null
    expect(await alice.as.query(api.questions.open, { question_id, affirms: elsewhere })).to.be.null
    expect(await alice.as.query(api.questions.open, { question_id, affirms })).to.not.be.null
  })
})
