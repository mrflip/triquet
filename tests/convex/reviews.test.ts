import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import { Hunt } from '../../src/models/hunt'
import { present } from '../support/present'
import { affirmsOf, identified, openOf, openTester, putOn, seedHunt, type Identified, type PlaceT, type Tester } from '../support/convex'

/** The reviews of the quiz `place` names that `by` reads, affirming what a browser that has read the hunt would */
async function reviewsFor(tt: Tester, by: Identified, place: PlaceT) {
  const { quiz: affirms } = await affirmsOf(tt, by, place)
  return await by.as.query(api.reviews.forQuiz, { affirms })
}

describe('reviews.forQuiz', () => {
  it('reads a quiz\'s reviews oldest first, each with who wrote it', async () => {
    const tt = openTester()
    const { act, open, join, smith } = await seedHunt(tt, Hunt.blank())
    const { quiz_id } = open
    const [alice, bob] = [await join('alice_reviews', 'reviewer'), await join('bob_reviews', 'reviewer')]
    await act({ kind: 'open_review', quiz_id }, bob)
    await act({ kind: 'open_review', quiz_id }, alice)
    await act({ kind: 'set_overall', quiz_id, overall: 'Went well.' }, alice)
    await act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, alice)
    await act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, bob)
    const reviews = await reviewsFor(tt, smith, open)
    expect(reviews.map((review) => [review.reviewer?.label, review.overall, review.phase])).to.deep.eq([
      ['bob_reviews', '', 'shared'],
      ['alice_reviews', 'Went well.', 'shared'],
    ])
  })

  it('reads only that quiz\'s reviews, and none for a quiz nobody has reviewed', async () => {
    const tt = openTester()
    const mine = await seedHunt(tt, Hunt.blank())
    const theirs = await seedHunt(tt, Hunt.blank())
    const alice = await theirs.join('alice_reviews', 'reviewer')
    await theirs.act({ kind: 'open_review', quiz_id: theirs.open.quiz_id }, alice)
    await putOn(tt, mine.open.hunt_id, alice.ident_id, 'reviewer')
    expect(await reviewsFor(tt, alice, mine.open)).to.deep.eq([])
    expect(await reviewsFor(tt, alice, theirs.open)).to.have.lengthOf(1)
  })

  it("reads one's own review whatever its phase; another's once shared, for a smith, or for a reviewer whose own is shared", async () => {
    const tt = openTester()
    const { act, open, join, smith } = await seedHunt(tt, Hunt.blank())
    const { quiz_id } = open
    const [alice, bob] = [await join('alice_reviews', 'reviewer'), await join('bob_reviews', 'reviewer')]
    await act({ kind: 'open_review', quiz_id }, alice)
    await act({ kind: 'set_overall', quiz_id, overall: 'Not yet.' }, alice)
    const seenBy = async (by: Identified) => {
      const reviews = await reviewsFor(tt, by, open)
      return reviews.map((review) => review.reviewer?.label)
    }
    expect([await seenBy(alice), await seenBy(bob), await seenBy(smith)]).to.deep.eq([['alice_reviews'], [], []])
    await act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, alice)
    await act({ kind: 'open_review', quiz_id }, bob)
    expect([await seenBy(alice), await seenBy(bob), await seenBy(smith)]).to.deep.eq([['alice_reviews'], ['bob_reviews'], ['alice_reviews']])
    await act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, bob)
    const both = ['alice_reviews', 'bob_reviews']
    expect([await seenBy(alice), await seenBy(bob), await seenBy(smith)]).to.deep.eq([both, both, both])
    await act({ kind: 'set_review_phase', quiz_id, phase: 'draft' }, bob)
    expect([await seenBy(alice), await seenBy(bob)]).to.deep.eq([['alice_reviews'], ['bob_reviews']])
  })

  it("reads nothing of a shared review for someone not on the hunt", async () => {
    const tt = openTester()
    const { act, open, join } = await seedHunt(tt, Hunt.blank())
    const alice = await join('alice_reviews', 'reviewer')
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, alice)
    await act({ kind: 'set_review_phase', quiz_id: open.quiz_id, phase: 'shared' }, alice)
    const stranger = await identified(tt, 'carol_strays')
    const { quiz: affirms } = await affirmsOf(tt, alice, open)
    expect(await reviewsFor(tt, stranger, open)).to.deep.eq([])
    expect(await tt.query(api.reviews.forQuiz, { affirms })).to.deep.eq([])
  })

  it("reads nothing for affirms that are not so: a standing not held, another's ident, or a quiz of another hunt", async () => {
    const tt = openTester()
    const { act, open, join, smith } = await seedHunt(tt, Hunt.blank())
    const theirs = await seedHunt(tt, Hunt.blank('loud_heron'), { smith: 'carol_strays' })
    const alice = await join('alice_reviews', 'reviewer')
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, alice)
    await act({ kind: 'set_review_phase', quiz_id: open.quiz_id, phase: 'shared' }, alice)
    const { quiz: affirms } = await affirmsOf(tt, smith, open)
    expect(await smith.as.query(api.reviews.forQuiz, { affirms: { ...affirms, standing: 'reviewer' } })).to.deep.eq([])
    expect(await theirs.smith.as.query(api.reviews.forQuiz, { affirms })).to.deep.eq([])
    expect(await smith.as.query(api.reviews.forQuiz, { affirms: { ...affirms, quiz_id: theirs.open.quiz_id } })).to.deep.eq([])
    expect(await smith.as.query(api.reviews.forQuiz, { affirms })).to.have.lengthOf(1)
  })

  it('hands each review back with its own reviewings, and none for a review with nothing written', async () => {
    const tt = openTester()
    const { act, open, read, join, smith } = await seedHunt(tt, Hunt.blank())
    const { quiz_id } = open
    const [first, second] = openOf(await read()).questions
    const [alice, bob] = [await join('alice_reviews', 'reviewer'), await join('bob_reviews', 'reviewer')]
    await act({ kind: 'open_review', quiz_id }, alice)
    await act({ kind: 'open_review', quiz_id }, bob)
    await act({ kind: 'set_reviewing', quiz_id, question_id: present(first)._id, patch: { get_rate: 40 } }, alice)
    await act({ kind: 'peek_answer', quiz_id, question_id: present(second)._id }, alice)
    await act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, alice)
    await act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, bob)
    const reviews = await reviewsFor(tt, smith, open)
    // A review's reviewings come in no order a view relies on: it places each by its question.
    const verdicts = reviews.map((review) => [review.reviewer?.label, new Map(review.reviewings.map((reviewing) => [reviewing.question_id, [reviewing.get_rate, reviewing.peeked]]))])
    expect(verdicts).to.deep.eq([
      ['alice_reviews', new Map([[present(first)._id, [40, false]], [present(second)._id, [null, true]]])],
      ['bob_reviews',   new Map()],
    ])
  })
})
