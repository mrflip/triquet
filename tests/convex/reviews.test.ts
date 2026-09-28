import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import { Hunt } from '../../src/models/hunt'
import { identified, openTester, seedHunt } from '../support/convex'

describe('reviews.forQuiz', () => {
  it('reads a quiz\'s reviews oldest first, each with who wrote it', async () => {
    const tt = openTester()
    const { act, open } = await seedHunt(tt, Hunt.blank())
    const { quiz_id } = open
    const [alice, bob] = [await identified(tt, 'alice_reviews'), await identified(tt, 'bob_reviews')]
    await act({ kind: 'open_review', quiz_id }, bob.browser_key)
    await act({ kind: 'open_review', quiz_id }, alice.browser_key)
    await act({ kind: 'set_overall', quiz_id, overall: 'Went well.' }, alice.browser_key)
    const reviews = await tt.query(api.reviews.forQuiz, { quiz_id })
    expect(reviews.map((review) => [review.reviewer?.label, review.overall, review.phase])).to.deep.eq([
      ['bob_reviews', '', 'empty'],
      ['alice_reviews', 'Went well.', 'draft'],
    ])
  })

  it('reads only that quiz\'s reviews, and none for a quiz nobody has reviewed', async () => {
    const tt = openTester()
    const mine = await seedHunt(tt, Hunt.blank())
    const theirs = await seedHunt(tt, Hunt.blank())
    const { browser_key } = await identified(tt, 'alice_reviews')
    await theirs.act({ kind: 'open_review', quiz_id: theirs.open.quiz_id }, browser_key)
    expect(await tt.query(api.reviews.forQuiz, { quiz_id: mine.open.quiz_id })).to.deep.eq([])
    expect(await tt.query(api.reviews.forQuiz, { quiz_id: theirs.open.quiz_id })).to.have.lengthOf(1)
  })
})
