import { ValidatorKit } from '../src/lib/validator'
import type { ReviewedT } from '../src/lib/rows'
import { zQuery } from './functions'
import { mayReadReview } from './authorize'
import { reviewingsOf, reviewsOf } from './reading'

const { zid } = ValidatorKit

/**
 * The reviews of `quiz_id` that the asking actor may read (their own;
 * the shared ones, for a smith of its hunt, or for a reviewer whose own is shared: see
 * `mayReadReview`), oldest first, each with who wrote it and its verdict on each question.
 */
export const forQuiz = zQuery({
  args:    { quiz_id: zid('quizzes') },
  handler: async (ctx, { quiz_id }): Promise<ReviewedT[]> => {
    const reviews = await reviewsOf(ctx.db, quiz_id)
    const readable = await Promise.all(reviews.map(async (review) => await mayReadReview(ctx.db, review, ctx.actor)))
    return await Promise.all(reviews.filter((_review, idx) => readable[idx]).map(async (review) => {
      const [reviewer, reviewings] = await Promise.all([ctx.db.get('idents', review.ident_id), reviewingsOf(ctx.db, review._id)])
      return { ...review, reviewer: reviewer && { label: reviewer.label, title: reviewer.title }, reviewings }
    }))
  },
})
