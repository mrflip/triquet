import type { Doc } from './_generated/dataModel'
import { ValidatorKit } from '../src/lib/validator'
import { zQuery } from './functions'
import { reviewsOf } from './reading'

const { zid } = ValidatorKit

/** A review, with the label and title of the ident who wrote it; null for an ident no longer there */
export type ReviewedT = Doc<'reviews'> & { reviewer: Pick<Doc<'idents'>, 'label' | 'title'> | null }

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
