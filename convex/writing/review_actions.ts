import type { Doc, Id } from '../_generated/dataModel'
import * as PA from '../../src/lib/vv/patterns'
import { refuse } from '../../src/lib/refusals'
import { ReviewValidators, type ReviewPhase } from '../../src/models/review'
import { Reviewing, ReviewingValidators, type ReviewingPatch } from '../../src/models/reviewing'
import { questionOf, reviewFor, reviewingFor, reviewsOf } from '../reading'
import { updateReview, updateReviewing, type Writer } from './quiz_writing'

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

/**
 * Revise `ident_id`'s verdict on one question of `quiz_id` by `patch`, making it the first time;
 * a field the patch leaves out is left as it was. An `empty` review moves to `draft`; a `shared`
 * one stays shared. Refused when the review has not been opened, or the question is not the
 * quiz's.
 *
 * @param db - The mutation's database.
 * @param quiz_id - Which quiz.
 * @param ident_id - Who is reviewing it.
 * @param question_id - Which of its questions.
 * @param patch - What the reviewer changed.
 */
export async function setReviewing(db: Writer, quiz_id: Id<'quizzes'>, ident_id: Id<'idents'>, question_id: Id<'questions'>, patch: ReviewingPatch): Promise<void> {
  const { review, held } = await reviewingPlaceOf(db, quiz_id, ident_id, question_id)
  if (held) {
    await updateReviewing(db, held, patch)
  } else {
    await db.insert('reviewings', ReviewingValidators.row({ ...Reviewing.blank(review._id, question_id), ...patch }))
  }
  if (review.phase === 'empty') { await updateReview(db, review, { phase: 'draft' }) }
}

/**
 * Record that `ident_id` has seen the answer to one question of `quiz_id`: once, and never
 * cleared. Seeing an answer writes nothing else, so the review keeps its phase. Refused as
 * `setReviewing` is.
 */
export async function peekAnswer(db: Writer, quiz_id: Id<'quizzes'>, ident_id: Id<'idents'>, question_id: Id<'questions'>): Promise<void> {
  const { review, held } = await reviewingPlaceOf(db, quiz_id, ident_id, question_id)
  if (held?.peeked) { return }
  if (held) {
    await updateReviewing(db, held, { peeked: true })
  } else {
    await db.insert('reviewings', ReviewingValidators.row({ ...Reviewing.blank(review._id, question_id), peeked: true }))
  }
}

/**
 * Where a verdict on one question goes: the reviewer's review, and the reviewing it has of the
 * question, if any yet. Refused when the review has not been opened, or the question is not the
 * quiz's.
 */
async function reviewingPlaceOf(db: Writer, quiz_id: Id<'quizzes'>, ident_id: Id<'idents'>, question_id: Id<'questions'>): Promise<{ review: Doc<'reviews'>, held: Doc<'reviewings'> | null }> {
  const [review, question] = await Promise.all([reviewFor(db, quiz_id, ident_id), questionOf(db, quiz_id, question_id)])
  if (! review) { refuse('reviewNotOpened') }
  if (! question) { refuse('questionGone') }
  return { review, held: await reviewingFor(db, review._id, question_id) }
}
