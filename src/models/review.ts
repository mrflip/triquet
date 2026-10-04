import type * as Z from 'zod'
import * as Actor from '../lib/actor'
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

/** One ident's review of one quiz, and what a policy reads of it */
export class Review implements ReviewRowT {
  declare hunt_id:  ReviewRowT['hunt_id']
  declare quiz_id:  ReviewRowT['quiz_id']
  declare ident_id: ReviewRowT['ident_id']
  declare overall:  ReviewRowT['overall']
  declare phase:    ReviewPhase

  /**
   * Whether `review` is shared: visible beyond its writer.
   *
   * @example Review.isShared({ phase: 'shared' })  // => true
   */
  static isShared(review: Pick<ReviewRowT, 'phase'>): boolean {
    return review.phase === 'shared'
  }

  /**
   * Whether `review` is hidden: not shared, so read by its writer alone.
   *
   * @example Review.isHidden({ phase: 'draft' })  // => true
   */
  static isHidden(review: Pick<ReviewRowT, 'phase'>): boolean {
    return review.phase !== 'shared'
  }

  /**
   * Whether the claimed actor wrote `review` and is on its hunt now. In order:
   *
   * * Nobody who has asserted no username wrote it
   * * Nobody else's review is theirs
   * * Claims on another hunt say nothing of this one
   * * The writer, while a member of its hunt
   *
   * @example Review.isActiveOwner(review, { ...actor, hunt_id: review.hunt_id, standing: 'reviewer' })  // => true, for actor's own
   */
  static isActiveOwner(review: Pick<ReviewRowT, 'hunt_id' | 'ident_id'>, claims: Actor.HuntClaimsT): boolean {
    /* eslint-disable unicorn/prefer-combined-guards -- one guard per rule, each beside its rule, as notes/policy_approve.md asks */
    if (Actor.isAnonymous(claims))           { return false } // Nobody who has asserted no username wrote it
    if (review.ident_id !== claims.ident_id) { return false } // Nobody else's review is theirs
    if (review.hunt_id !== claims.hunt_id)   { return false } // Claims on another hunt say nothing of this one
    /* eslint-enable unicorn/prefer-combined-guards */
    return Actor.isMember(claims)                              // The writer, while a member of its hunt
  }

  /**
   * The review of `reviews` that `actor` wrote; null when they wrote none, or have asserted no
   * username.
   *
   * @param reviews - Reviews of one quiz.
   * @param actor - Who is asking.
   *
   * @example Review.ownOf(reviews, actor)  // => actor's review of the quiz, or null
   */
  static ownOf<RT extends Pick<ReviewRowT, 'ident_id'>>(reviews: readonly RT[], actor: Actor.ActorT): RT | null {
    if (Actor.isAnonymous(actor)) { return null }
    return reviews.find((review) => review.ident_id === actor.ident_id) ?? null
  }
}
