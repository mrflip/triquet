import type * as Z from 'zod'
import { Validator } from '../lib/validator'

/** How far a review has come: nothing written yet, still being drafted, or visible to the smiths */
export const ReviewPhaseVals = ['empty', 'draft', 'shared'] as const
export type ReviewPhase = typeof ReviewPhaseVals[number]

export const ReviewValidators = Validator(({ obj, oneof, noteish, zid }) => {
  const phase = oneof(ReviewPhaseVals)
    .describe('How far the review has come. Nothing moves it back to `empty` once anything has been written; sharing and withdrawing move it between `draft` and `shared` only.')
  const overall = noteish
    .describe('What the reviewer made of the quiz as a whole.')

  const row = obj({
    hunt_id:  zid('hunts')
      .describe('The hunt the quiz belongs to, which says who besides the reviewer may read the review once shared.'),
    quiz_id:  zid('quizzes')
      .describe('The quiz being reviewed.'),
    ident_id: zid('idents')
      .describe('Who is reviewing it.'),
    overall:  overall.default(''),
    phase:    phase.default('empty'),
  })
    .describe('One ident\'s review of one quiz. Hidden from the smiths until shared: it is live once shared, not a snapshot.')

  return { phase, overall, row }
})

export type ReviewRowT = Z.output<typeof ReviewValidators.row>

/**
 * The reviews of `reviews` that are shared: what the smiths' panel shows. (Whether a review
 * reaches a browser at all is the server's to say; a smith's own draft reaches theirs, and is not
 * shared.)
 *
 * @param reviews - Reviews of a quiz.
 * @returns Only the shared ones.
 *
 * @example sharedReviewsOf([{ phase: 'draft' }, { phase: 'shared' }])  // => [{ phase: 'shared' }]
 */
export function sharedReviewsOf<RT extends { phase: ReviewPhase }>(reviews: readonly RT[]): RT[] {
  return reviews.filter((review) => review.phase === 'shared')
}
