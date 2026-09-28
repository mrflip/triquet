import type { Id } from '../_generated/dataModel'
import * as PA from '../../src/lib/vv/patterns'
import { refuse } from '../../src/lib/refusals'
import { ReviewValidators, type ReviewPhase } from '../../src/models/review'
import { reviewFor, reviewsOf } from '../reading'
import { updateReview, type Writer } from './quiz_writing'

/**
 * Open `ident_id`'s review of `quiz_id`: the empty row the first time, nothing the times after.
 *
 * Unlike every other action on a quiz, a review is never refused for a locked quiz -- a lock is
 * what a finished draft sent out for playtesting looks like, so reviewing one is exactly the
 * point. A quiz gone, or holding as many reviews as a quiz may, refuses a new one.
 *
 * @param db - The mutation's database.
 * @param quiz_id - Which quiz.
 * @param ident_id - Who is reviewing it.
 */
export async function openReview(db: Writer, quiz_id: Id<'quizzes'>, ident_id: Id<'idents'>): Promise<void> {
  const [quiz, held, reviews] = await Promise.all([db.get('quizzes', quiz_id), reviewFor(db, quiz_id, ident_id), reviewsOf(db, quiz_id)])
  if (! quiz) { refuse('quizGone') }
  if (held) { return }
  if (reviews.length >= PA.ReviewsPerQuiz.max) { refuse('reviewsFull') }
  await db.insert('reviews', ReviewValidators.row({ quiz_id, ident_id, overall: '', phase: 'empty' }))
}

/**
 * Write `ident_id`'s overall note on `quiz_id`, moving an `empty` review to `draft`; a `shared`
 * one stays shared, since sharing is live rather than a snapshot. Refused when the review has
 * not been opened.
 */
export async function setOverall(db: Writer, quiz_id: Id<'quizzes'>, ident_id: Id<'idents'>, overall: string): Promise<void> {
  const held = await reviewFor(db, quiz_id, ident_id)
  if (! held) { refuse('reviewNotOpened') }
  await updateReview(db, held, { overall, phase: held.phase === 'shared' ? 'shared' : 'draft' })
}

/** Share or withdraw `ident_id`'s review of `quiz_id`. Refused when it has not been opened. */
export async function setReviewPhase(db: Writer, quiz_id: Id<'quizzes'>, ident_id: Id<'idents'>, phase: Exclude<ReviewPhase, 'empty'>): Promise<void> {
  const held = await reviewFor(db, quiz_id, ident_id)
  if (! held) { refuse('reviewNotOpened') }
  await updateReview(db, held, { phase })
}
