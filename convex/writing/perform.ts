import type { Id } from '../_generated/dataModel'
import * as Layout from './layout_actions'
import * as Quiz from './quiz_actions'
import * as Review from './review_actions'
import { isLayoutAction, type HuntActionT, type OpenQuizT } from '../../src/models/actions'
import type { Writer } from './quiz_writing'
import { refuse } from '../../src/lib/refusals'

/**
 * Carry out what the author did, writing the rows it comes to, all in one transaction.
 *
 * Actions that revise the quiz on screen are refused outright while it is locked; actions about
 * its realm and hunt (making, deleting and locking quizzes, and the expressions), and reviews,
 * are not -- a locked quiz is exactly what a finished draft sent out for playtesting looks like.
 * A refused action writes nothing and throws a refusal saying why (`lib/refusals`). Each action
 * reads the rows it needs as they stand, inside the transaction.
 *
 * @param db - The mutation's database.
 * @param open - The quiz on the author's screen, where an action on "the quiz" lands.
 * @param ident_id - Who is acting; only a review action reads it, and is refused without one.
 * @param action - What the author did, validated.
 * @throws A refusal, or a Zod error when a row the action comes to is not valid; nothing is written.
 *
 * @example await perform(ctx.db, open, ident?._id ?? null, { kind: 'add_question' })
 */
export async function perform(db: Writer, open: OpenQuizT, ident_id: Id<'idents'> | null, action: HuntActionT): Promise<void> {
  if (isLayoutAction(action)) {
    await Layout.performLayout(db, open, action)
    return
  }
  switch (action.kind) {
  case 'retitle_quiz':        { await Quiz.retitleQuiz(db, open, action.title); return }
  case 'relabel_quiz':        { await Quiz.relabelQuiz(db, open, action.label); return }
  case 'reversion_quiz':      { await Quiz.reversionQuiz(db, open, action.version); return }
  case 'edit_question':       { await Quiz.editQuestion(db, open, action.question_id, action.patch); return }
  case 'add_question':        { await Quiz.addQuestion(db, open); return }
  case 'delete_questions':    { await Quiz.deleteQuestions(db, open, action.question_ids); return }
  case 'sort_questions':      { await Quiz.sortQuestions(db, open, action.sortkey, action.descending); return }
  case 'renumber_qnums':      { await Quiz.renumberQnums(db, open); return }
  case 'move_question':       { await Quiz.moveQuestion(db, open, action.question_id, action.onto_idx); return }
  case 'set_chain':           { await Quiz.setChain(db, open, action.question_id, action.chains_to); return }
  case 'sort_by_chain_order': { await Quiz.sortByChainOrder(db, open, action.descending); return }
  case 'set_guess':           { await Quiz.setGuess(db, open, action.question_id, action.guess); return }
  case 'set_ishes':           { await Quiz.setIshes(db, open, action.question_id, action.textkind, action.ishes); return }
  case 'fail_guess':          { await Quiz.failGuess(db, open, action.question_id, action.err); return }
  case 'fail_ishes':          { await Quiz.failIshes(db, open, action.question_id, action.textkind, action.err); return }
  case 'apply_bulk_ishes':    { await Quiz.applyBulkIshes(db, open, action.landings, action.run); return }
  case 'replace_open_quiz':   { await Quiz.replaceOpenQuiz(db, open, action.quiz); return }
  case 'new_quiz':            { await Quiz.newQuiz(db, open, action.label); return }
  case 'delete_quiz':         { await Quiz.deleteQuizFrom(db, open, action.quiz_id); return }
  case 'set_lock':            { await Quiz.setLock(db, action.quiz_id, action.locked); return }
  case 'open_review':         { await Review.openReview(db, action.quiz_id, reviewer(ident_id)); return }
  case 'set_overall':         { await Review.setOverall(db, action.quiz_id, reviewer(ident_id), action.overall); return }
  case 'set_review_phase':    { await Review.setReviewPhase(db, action.quiz_id, reviewer(ident_id), action.phase); return }
  case 'set_reviewing':       { await Review.setReviewing(db, action.quiz_id, reviewer(ident_id), action.question_id, action.patch); return }
  case 'peek_answer':         { await Review.peekAnswer(db, action.quiz_id, reviewer(ident_id), action.question_id) }
  }
}

/** Who is reviewing, refusing a browser that has not said */
function reviewer(ident_id: Id<'idents'> | null): Id<'idents'> {
  if (! ident_id) { refuse('notIdentified') }
  return ident_id
}
