import type { ReviewedT } from '../src/lib/rows'
import { ActionValidators } from '../src/models/actions'
import { zHuntQuery } from './functions'
import { affirmReadReviews } from './authorize'
import { reviewingsOf, reviewsOf } from './reading'

/**
 * The reviews of the affirmed quiz that the asking actor may read (their own;
 * the shared ones, for a smith of its hunt, or for a reviewer whose own is shared: see
 * `Approve.mayReadReview`), oldest first, each with who wrote it and its verdict on each question.
 * None when what they affirm of themselves is not so. The quiz's reviews are read whole, and the
 * database they are read through shows only those the actor may read (`policy_rules.ts`).
 */
export const forQuiz = zHuntQuery({
  args:    { affirms: ActionValidators.quizAffirms },
  empty:   [],
  affirm:  async (ctx, { affirms }) => await affirmReadReviews(ctx.db, affirms, ctx.actor),
  handler: async (ctx, { affirms }): Promise<ReviewedT[]> => {
    const readable = await reviewsOf(ctx.db, affirms.quiz_id)
    return await Promise.all(readable.map(async (review) => {
      const [reviewer, reviewings] = await Promise.all([ctx.db.get('idents', review.ident_id), reviewingsOf(ctx.db, review._id)])
      return { ...review, reviewer: reviewer && { label: reviewer.label, title: reviewer.title }, reviewings }
    }))
  },
})
