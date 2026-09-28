import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import { realmsOf, quizRowsOf } from '../../convex/reading'
import { writeHunt } from '../../convex/writing/quiz_writing'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { present } from '../support/present'
import { huntHolding, openTester } from '../support/convex'

/** A fresh deployment holding one quiz of two questions, `aa` chained to `bb`, and the first question's id */
async function holding() {
  const tt = openTester()
  const questions = [{ ...Question.blank(), label: 'aa', clueing: 'Who?' }, { ...Question.blank(), label: 'bb' }]
  const hunt_id = await tt.run(async (ctx) => await writeHunt(ctx.db, huntHolding([{ ...Quiz.blank(), questions }])))
  const question_id = await tt.run(async (ctx) => {
    const [home] = await realmsOf(ctx.db, hunt_id)
    const quiz_id = present(present(home).quizzes[0])._id
    const first = present(present(await quizRowsOf(ctx.db, quiz_id)).questions[0])._id
    await ctx.db.patch('questions', first, { chains_to: 'bb' })
    await ctx.db.insert('bottings', {
      question_id: first, bot_label: 'dumdum', textkind: 'clueing', asked_text: 'Who?', status: 'done', reply_text: 'Leon',
      items: [], message: null, response: null, truncated: false, model_tier_applied: null, approx_tokens: null,
    })
    return first
  })
  return { tt, question_id }
}

describe('questions.open', () => {
  it('reads one question: its row, and the newest reply in each of its cells', async () => {
    const { tt, question_id } = await holding()
    const seen = present(await tt.query(api.questions.open, { question_id }))
    expect(seen).to.deep.include({ _id: question_id, label: 'aa', clueing: 'Who?', clueing_ishes: null, hint_ishes: null })
    expect(seen.guess).to.deep.include({ status: 'done', text: 'Leon' })
  })

  it('leaves a chain as the label the row holds: only the quiz knows which question answers to it', async () => {
    const { tt, question_id } = await holding()
    expect(present(await tt.query(api.questions.open, { question_id })).chains_to).to.eq('bb')
  })

  it('reads null for a question that is not there', async () => {
    const { tt, question_id } = await holding()
    await tt.run(async (ctx) => { await ctx.db.delete('questions', question_id) })
    expect(await tt.query(api.questions.open, { question_id })).to.eq(null)
  })
})
