import { ValidatorKit } from '../src/lib/validator'
import type { ReviewedT } from '../src/lib/rows'
import { IdentingValidators } from '../src/models/identing'
import { zQuery } from './functions'
import { mayReadReview } from './authorize'
import { identFor, reviewingsOf, reviewsOf } from './reading'

const { zid } = ValidatorKit

/**
 * The reviews of `quiz_id` that the ident the browser `browser_key` is now may read (their own,
 * and the shared ones of a hunt they are on), oldest first, each with who wrote it and its verdict
 * on each question.
 */
export const forQuiz = zQuery({
  args:    { quiz_id: zid('quizzes'), browser_key: IdentingValidators.browserKey },
  handler: async (ctx, { quiz_id, browser_key }): Promise<ReviewedT[]> => {
    const [reviews, ident] = await Promise.all([reviewsOf(ctx.db, quiz_id), identFor(ctx.db, browser_key)])
    const readable = await Promise.all(reviews.map(async (review) => await mayReadReview(ctx.db, review, ident?._id ?? null)))
    return await Promise.all(reviews.filter((_review, idx) => readable[idx]).map(async (review) => {
      const [reviewer, reviewings] = await Promise.all([ctx.db.get('idents', review.ident_id), reviewingsOf(ctx.db, review._id)])
      return { ...review, reviewer: reviewer && { label: reviewer.label, title: reviewer.title }, reviewings }
    }))
  },
})
