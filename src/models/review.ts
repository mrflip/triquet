import type * as Z from 'zod'
import { Validator } from '../lib/validator'

/** How far a review has come: nothing written yet, still being drafted, or visible to the smiths */
export const ReviewPhaseVals = ['empty', 'draft', 'shared'] as const
export type ReviewPhase = typeof ReviewPhaseVals[number]

export const ReviewValidators = Validator(({ obj, oneof, noteish, rowid }) => {
  const phase = oneof(ReviewPhaseVals)
    .describe('How far the review has come. Nothing moves it back to `empty` once anything has been written; sharing and withdrawing move it between `draft` and `shared` only.')
  const overall = noteish
    .describe('What the reviewer made of the quiz as a whole.')

  const row = obj({
    quiz_id:  rowid
      .describe('The quiz being reviewed.'),
    ident_id: rowid
      .describe('Who is reviewing it.'),
    overall:  overall.default(''),
    phase:    phase.default('empty'),
  })
    .describe('One ident\'s review of one quiz. Hidden from the smiths until shared: it is live once shared, not a snapshot.')

  return { phase, overall, row }
})

export type ReviewRowT = Z.output<typeof ReviewValidators.row>

/**
 * The reviews of `reviews` a smith may see: the shared ones.
 *
 * A client-side filter for the trial, where every review row is readable by every account; PR 6
 * moves this rule into the server's policy and this function goes with it.
 *
 * @param reviews - Every review of a quiz.
 * @returns Only the ones shared with the smiths.
 *
 * @example sharedReviewsOf([{ phase: 'draft' }, { phase: 'shared' }])  // => [{ phase: 'shared' }]
 */
export function sharedReviewsOf<RT extends { phase: ReviewPhase }>(reviews: readonly RT[]): RT[] {
  return reviews.filter((review) => review.phase === 'shared')
}
