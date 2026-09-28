import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import { Hunt } from '../../src/models/hunt'
import { mintId } from '../../src/lib/ids'
import { present } from '../support/present'
import { identified, openOf, openTester, seedHunt } from '../support/convex'

describe('reviews.forQuiz', () => {
  it('reads a quiz\'s reviews oldest first, each with who wrote it', async () => {
    const tt = openTester()
    const { act, open, join, smith } = await seedHunt(tt, Hunt.blank())
    const { quiz_id } = open
    const [alice, bob] = [await join('alice_reviews', 'reviewer'), await join('bob_reviews', 'reviewer')]
    await act({ kind: 'open_review', quiz_id }, bob.browser_key)
    await act({ kind: 'open_review', quiz_id }, alice.browser_key)
    await act({ kind: 'set_overall', quiz_id, overall: 'Went well.' }, alice.browser_key)
    await act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, alice.browser_key)
    await act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, bob.browser_key)
    const reviews = await tt.query(api.reviews.forQuiz, { quiz_id, browser_key: smith.browser_key })
    expect(reviews.map((review) => [review.reviewer?.label, review.overall, review.phase])).to.deep.eq([
      ['bob_reviews', '', 'shared'],
      ['alice_reviews', 'Went well.', 'shared'],
    ])
  })

  it('reads only that quiz\'s reviews, and none for a quiz nobody has reviewed', async () => {
    const tt = openTester()
    const mine = await seedHunt(tt, Hunt.blank())
    const theirs = await seedHunt(tt, Hunt.blank())
    const { browser_key } = await theirs.join('alice_reviews', 'reviewer')
    await theirs.act({ kind: 'open_review', quiz_id: theirs.open.quiz_id }, browser_key)
    expect(await tt.query(api.reviews.forQuiz, { quiz_id: mine.open.quiz_id, browser_key })).to.deep.eq([])
    expect(await tt.query(api.reviews.forQuiz, { quiz_id: theirs.open.quiz_id, browser_key })).to.have.lengthOf(1)
  })

  it("reads one's own review whatever its phase, and another's only once it is shared", async () => {
    const tt = openTester()
    const { act, open, join, smith } = await seedHunt(tt, Hunt.blank())
    const { quiz_id } = open
    const [alice, bob] = [await join('alice_reviews', 'reviewer'), await join('bob_reviews', 'reviewer')]
    await act({ kind: 'open_review', quiz_id }, alice.browser_key)
    await act({ kind: 'set_overall', quiz_id, overall: 'Not yet.' }, alice.browser_key)
    const seenBy = async (browser_key: string) => {
      const reviews = await tt.query(api.reviews.forQuiz, { quiz_id, browser_key })
      return reviews.map((review) => review.reviewer?.label)
    }
    expect([await seenBy(alice.browser_key), await seenBy(bob.browser_key), await seenBy(smith.browser_key)]).to.deep.eq([['alice_reviews'], [], []])
    await act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, alice.browser_key)
    expect([await seenBy(alice.browser_key), await seenBy(bob.browser_key), await seenBy(smith.browser_key)]).to.deep.eq([['alice_reviews'], ['alice_reviews'], ['alice_reviews']])
  })

  it("reads nothing of a shared review for someone not on the hunt", async () => {
    const tt = openTester()
    const { act, open, join } = await seedHunt(tt, Hunt.blank())
    const alice = await join('alice_reviews', 'reviewer')
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, alice.browser_key)
    await act({ kind: 'set_review_phase', quiz_id: open.quiz_id, phase: 'shared' }, alice.browser_key)
    const stranger = await identified(tt, 'carol_strays')
    expect(await tt.query(api.reviews.forQuiz, { quiz_id: open.quiz_id, browser_key: stranger.browser_key })).to.deep.eq([])
    expect(await tt.query(api.reviews.forQuiz, { quiz_id: open.quiz_id, browser_key: mintId() })).to.deep.eq([])
  })

  it('hands each review back with its own reviewings, and none for a review with nothing written', async () => {
    const tt = openTester()
    const { act, open, read, join } = await seedHunt(tt, Hunt.blank())
    const { quiz_id } = open
    const [first, second] = openOf(await read()).questions
    const [alice, bob] = [await join('alice_reviews', 'reviewer'), await join('bob_reviews', 'reviewer')]
    await act({ kind: 'open_review', quiz_id }, alice.browser_key)
    await act({ kind: 'open_review', quiz_id }, bob.browser_key)
    await act({ kind: 'set_reviewing', quiz_id, question_id: present(first)._id, patch: { get_rate: 40 } }, alice.browser_key)
    await act({ kind: 'peek_answer', quiz_id, question_id: present(second)._id }, alice.browser_key)
    await act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, bob.browser_key)
    const reviews = await tt.query(api.reviews.forQuiz, { quiz_id, browser_key: alice.browser_key })
    // A review's reviewings come in no order a view relies on: it places each by its question.
    const verdicts = reviews.map((review) => [review.reviewer?.label, new Map(review.reviewings.map((reviewing) => [reviewing.question_id, [reviewing.get_rate, reviewing.peeked]]))])
    expect(verdicts).to.deep.eq([
      ['alice_reviews', new Map([[present(first)._id, [40, false]], [present(second)._id, [null, true]]])],
      ['bob_reviews',   new Map()],
    ])
  })
})
