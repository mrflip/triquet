import type { Db } from 'jazz-tools'
import { app } from '../db/schema'
import { ReviewValidators, type ReviewPhase } from '../models/review'
import { quizRowsOf, reviewRowFor, type HeldRows } from './quiz-rows'
import { transact, updateReview } from './quiz-writing'

/**
 * Open `ident_id`'s review of `quiz_id`: the empty row the first time, nothing the times after.
 *
 * Unlike every other action here, a review is never refused for a locked quiz -- a lock is what
 * a finished draft sent out for playtesting looks like, so reviewing one is exactly the point.
 *
 * Idempotent against the tab that already has one open; two tabs opening the review for the
 * first time at once can still both write one, an accepted race `reviewRowFor` settles for
 * reading by taking the earlier.
 *
 * @param db - The account's database.
 * @param held - Every row held, as the screen has them.
 * @param quiz_id - Which quiz.
 * @param ident_id - Who is reviewing it.
 */
export async function openReview(db: Db, held: HeldRows, quiz_id: string, ident_id: string): Promise<void> {
  const rows = quizRowsOf(held, quiz_id)
  if (! rows || reviewRowFor(rows.reviews, ident_id)) { return }
  await transact(db, (tx) => {
    tx.insert(app.reviews, ReviewValidators.row({ quiz_id, ident_id, overall: '', phase: 'empty' }))
  })
}

/**
 * Write `ident_id`'s overall note on `quiz_id`, moving an `empty` review to `draft`; a `shared`
 * one stays shared, since sharing is live rather than a snapshot. Nothing is written when the
 * review has not been opened.
 */
export async function setOverall(db: Db, held: HeldRows, quiz_id: string, ident_id: string, overall: string): Promise<void> {
  const rows = quizRowsOf(held, quiz_id)
  const heldReview = rows && reviewRowFor(rows.reviews, ident_id)
  if (! heldReview) { return }
  const phase = heldReview.phase === 'shared' ? 'shared' : 'draft'
  await transact(db, (tx) => { updateReview(tx, heldReview, { overall, phase }) })
}

/** Share or withdraw `ident_id`'s review of `quiz_id`. Nothing is written when it has not been opened. */
export async function setReviewPhase(db: Db, held: HeldRows, quiz_id: string, ident_id: string, phase: Exclude<ReviewPhase, 'empty'>): Promise<void> {
  const rows = quizRowsOf(held, quiz_id)
  const heldReview = rows && reviewRowFor(rows.reviews, ident_id)
  if (! heldReview) { return }
  await transact(db, (tx) => { updateReview(tx, heldReview, { phase }) })
}
