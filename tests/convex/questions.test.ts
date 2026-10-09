import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import { affirmReadQuestion } from '../../convex/authorize'
import { realmsOf, quizRowsOf, storedFor } from '../../convex/reading'
import { Hunt } from '../../src/models/hunt'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { Widgeting } from '../../src/models/widgeting'
import { counting, plainReads } from '../support/counting'
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
 * the sessions of a smith and a reviewer on the hunt, with what each affirms of themselves there.
 */
async function holding() {
  const tt = openTester()
  const questions = [
    { ...Question.blank(), label: 'aa', title: 'Danish prince', clueing: 'Who?', hint: 'Not a king.', full_answer: 'Hamlet', notes: 'Check the folio.', alt_text: 'A prince.' },
    { ...Question.blank(), label: 'bb' },
  ]
  const hunt_id = await tt.run(async (ctx) => await seedHuntRows(ctx.db, huntHolding([{ ...Quiz.blank(), questions, widgetings: Widgetings }])))
  const { question_id, dumdum_id, place } = await tt.run(async (ctx) => {
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
    ]) { await ctx.db.insert('widgeteds', { hunt_id, quiz_id: quiz._id, question_id: first, widgeting_id, result_meta: {}, ...recorded }) }
    return { question_id: first, dumdum_id: widgeting_id, place: { hunt_id, realm_id: realm.realm._id, quiz_id: quiz._id } }
  })
  const alice = await identified(tt, 'alice_reviews')
  await putOn(tt, hunt_id, alice.ident_id, 'reviewer')
  const sam = await identified(tt, 'sam_smiths')
  await putOn(tt, hunt_id, sam.ident_id, 'smith')
  const { hunt: affirms } = await affirmsOf(tt, alice, place)
  const { hunt: smiths } = await affirmsOf(tt, sam, place)
  return { tt, question_id, dumdum_id, place, alice, affirms, sam, smiths }
}

/** A question as a smith reads it: every field, and what was stored */
async function smithsRead(holds: Awaited<ReturnType<typeof holding>>, question_id = holds.question_id) {
  const seen = present(await holds.sam.as.query(api.questions.open, { question_id, affirms: holds.smiths }))
  if (! ('stored' in seen)) { throw new Error('A smith is sent what was stored') }
  return seen
}

describe("questions.open", () => {
  it("reads one question for a smith: every field, and for each widgeting that stored, by its id, the newest row and the newest ok one", async () => {
    const holds = await holding()
    const { question_id } = holds
    const seen = await smithsRead(holds)
    expect(seen).to.deep.include({ _id: question_id, label: 'aa', clueing: 'Who?', notes: 'Check the folio.', alt_text: 'A prince.', full_answer: 'Hamlet' })
    expect(Object.keys(seen.stored)).to.deep.eq([holds.dumdum_id])
    const cell = present(seen.stored[holds.dumdum_id])
    expect(cell.newest).to.deep.include({ status: 'errored', value: null, message: 'Overloaded', result_meta: {} })
    expect(cell.ok).to.deep.include({ status: 'ok', value: { guess: 'Leon', explanation: 'A lion.' }, message: null })
    expect(present(cell.ok)._creationTime).to.be.below(cell.newest._creationTime)
  })

  it("reads nothing of its quiz, not even its widgetings: a widgeting relabelled leaves a question's reading as it was", async () => {
    const holds = await holding()
    const { tt, question_id, dumdum_id, sam, smiths } = holds
    const before = await smithsRead(holds)
    const reads = await tt.run(async (ctx) => {
      const { db, reads: counted } = counting(ctx.db)
      await affirmReadQuestion(db, smiths, sam.actor, question_id)  // what `questions.open` reads, then...
      await storedFor(db, question_id)                              // ...for a smith
      return plainReads(counted)
    })
    expect(reads.tables).to.deep.eq(['huntings', 'questions', 'widgeteds'])
    expect(reads).to.deep.include({ docs: 4, ranges: 4 })   // before: 7 and 6, the quiz's three widgetings among them
    await tt.run(async (ctx) => { await ctx.db.patch('widgetings', dumdum_id, { label: 'hasty_guess' }) })
    expect(await smithsRead(holds)).to.deep.eq(before)
  })

  it("reads nothing stored for a question none of its widgetings has recorded for", async () => {
    const holds = await holding()
    const { tt, question_id } = holds
    const second = await tt.run(async (ctx) => {
      const question = present(await ctx.db.get('questions', question_id))
      return present(present(await ctx.db.get('quizzes', question.quiz_id)).row_ordering[1])
    })
    const seen = await smithsRead(holds, second)
    expect(seen.stored).to.deep.eq({})
  })

  it("leaves a chain as the label the row holds: only the quiz knows which question answers to it", async () => {
    const holds = await holding()
    const { question_id, alice, affirms } = holds
    const seen = await smithsRead(holds)
    expect(seen.chains_to).to.eq('bb')
    expect(present(await alice.as.query(api.questions.open, { question_id, affirms }))).to.deep.include({ chains_to: 'bb' })
  })

  it("reads a reviewer what a review needs, the answer and how it is shown among it, and not the notes or what was stored", async () => {
    const { question_id, alice, affirms } = await holding()
    expect(await alice.as.query(api.questions.open, { question_id, affirms })).to.deep.eq({
      _id: question_id, label: 'aa', title: 'Danish prince', qnum: '', clueing: 'Who?', hint: 'Not a king.', chains_to: 'bb', full_answer: 'Hamlet', viz: 'normal',
    })
  })

  it("reads a reviewer the answer whether or not they have peeked at it", async () => {
    const { tt, question_id, place, alice, affirms } = await holding()
    const before = present(await alice.as.query(api.questions.open, { question_id, affirms }))
    const { action } = await affirmsOf(tt, alice, place)
    await alice.as.mutation(api.hunts.perform, { affirms: action, action: { kind: 'open_review', quiz_id: place.quiz_id } })
    await alice.as.mutation(api.hunts.perform, { affirms: action, action: { kind: 'peek_answer', quiz_id: place.quiz_id, question_id } })
    const after = present(await alice.as.query(api.questions.open, { question_id, affirms }))
    expect([before, after].map((seen) => 'full_answer' in seen && seen.full_answer)).to.deep.eq(['Hamlet', 'Hamlet'])
    expect(after).to.not.have.any.keys('notes', 'alt_text', 'stored')
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
