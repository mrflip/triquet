import { ValidatorKit } from '../src/lib/validator'
import type { ReviewedT } from '../src/lib/rows'
import { zQuery } from './functions'
import { reviewsOf } from './reading'

const { zid } = ValidatorKit

/** The reviews of `quiz_id`, oldest first, each with who wrote it */
export const forQuiz = zQuery({
  args:    { quiz_id: zid('quizzes') },
  handler: async (ctx, { quiz_id }): Promise<ReviewedT[]> => {
    const reviews = await reviewsOf(ctx.db, quiz_id)
    return await Promise.all(reviews.map(async (review) => {
      const ident = await ctx.db.get('idents', review.ident_id)
      return { ...review, reviewer: ident && { label: ident.label, title: ident.title } }
    }))
  },
})
