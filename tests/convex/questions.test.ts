import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import { realmsOf, quizRowsOf } from '../../convex/reading'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { present } from '../support/present'
import { mintId } from '../../src/lib/ids'
import { huntHolding, identified, openTester, putOn } from '../support/convex'
import { seedHuntRows } from '../support/seed'

/**
 * A fresh deployment holding one quiz of two questions, `aa` chained to `bb`; the first question's
 * id, and the browser of a reviewer on the hunt.
 */
async function holding() {
  const tt = openTester()
  const questions = [{ ...Question.blank(), label: 'aa', clueing: 'Who?' }, { ...Question.blank(), label: 'bb' }]
  const hunt_id = await tt.run(async (ctx) => await seedHuntRows(ctx.db, huntHolding([{ ...Quiz.blank(), questions }])))
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
  const { browser_key, ident_id } = await identified(tt, 'alice_reviews')
  await putOn(tt, hunt_id, ident_id, 'reviewer')
  return { tt, question_id, browser_key }
}

describe('questions.open', () => {
  it('reads one question: its row, and the newest reply in each of its cells', async () => {
    const { tt, question_id, browser_key } = await holding()
    const seen = present(await tt.query(api.questions.open, { question_id, browser_key }))
    expect(seen).to.deep.include({ _id: question_id, label: 'aa', clueing: 'Who?', clueing_ishes: null, hint_ishes: null })
    expect(seen.guess).to.deep.include({ status: 'done', text: 'Leon' })
  })

  it('leaves a chain as the label the row holds: only the quiz knows which question answers to it', async () => {
    const { tt, question_id, browser_key } = await holding()
    expect(present(await tt.query(api.questions.open, { question_id, browser_key })).chains_to).to.eq('bb')
  })

  it('reads null for a question that is not there', async () => {
    const { tt, question_id, browser_key } = await holding()
    await tt.run(async (ctx) => { await ctx.db.delete('questions', question_id) })
    expect(await tt.query(api.questions.open, { question_id, browser_key })).to.eq(null)
  })

  it("reads null, as for one not there, for someone not on its hunt", async () => {
    const { tt, question_id } = await holding()
    const stranger = await identified(tt, 'carol_strays')
    expect(await tt.query(api.questions.open, { question_id, browser_key: stranger.browser_key })).to.eq(null)
    expect(await tt.query(api.questions.open, { question_id, browser_key: mintId() })).to.eq(null)
  })
})
