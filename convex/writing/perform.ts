import type { Id } from '../_generated/dataModel'
import * as Hunt from './hunt_actions'
import * as Hunting from './hunting_actions'
import * as Layout from './layout_actions'
import * as Library from './library_actions'
import * as Quiz from './quiz_actions'
import * as Review from './review_actions'
import { isLayoutAction, isLibraryAction, type HuntActionT, type OpenQuizT } from '../../src/models/actions'
import type { Writer } from './quiz_writing'

/**
 * Carry out what the author did, writing the rows it comes to, all in one transaction.
 *
 * Actions that revise the quiz on screen are refused outright while it is locked; actions about
 * its realm and hunt (making, deleting and locking quizzes, who is on the hunt, and relabelling or
 * deleting the hunt), about the library, and reviews, are not -- a locked quiz is exactly what a
 * finished draft sent out for playtesting looks like.
 * A refused action writes nothing and throws a refusal saying why (`lib/refusals`). Each action
 * reads the rows it needs as they stand, inside the transaction. Whether the actor may take the
 * action at all, and whether `open` is truly of its hunt, is `authorize`'s to settle first.
 *
 * @param db - The mutation's database.
 * @param open - The quiz on the author's screen, where an action on "the quiz" lands.
 * @param ident_id - Who is acting; only a review or hunting action reads it.
 * @param action - What the author did, validated.
 * @throws A refusal, or a Zod error when a row the action comes to is not valid; nothing is written.
 *
 * @example await perform(ctx.db, open, ident._id, { kind: 'add_question' })
 */
export async function perform(db: Writer, open: OpenQuizT, ident_id: Id<'idents'>, action: HuntActionT): Promise<void> {
  if (isLayoutAction(action)) {
    await Layout.performLayout(db, open, action)
    return
  }
  if (isLibraryAction(action)) {
    await Library.performLibrary(db, action)
    return
  }
  switch (action.kind) {
  case 'retitle_quiz':        { await Quiz.retitleQuiz(db, open, action.title); return }
  case 'relabel_quiz':        { await Quiz.relabelQuiz(db, open, action.label); return }
  case 'reversion_quiz':      { await Quiz.reversionQuiz(db, open, action.version); return }
  case 'set_smiths_note':     { await Quiz.setSmithsNote(db, open, action.smiths_note); return }
  case 'edit_question':       { await Quiz.editQuestion(db, open, action.question_id, action.patch); return }
  case 'add_question':        { await Quiz.addQuestion(db, open); return }
  case 'delete_questions':    { await Quiz.deleteQuestions(db, open, action.question_ids); return }
  case 'sort_questions':      { await Quiz.sortQuestions(db, open, action.sortkey, action.descending); return }
  case 'renumber_qnums':      { await Quiz.renumberQnums(db, open); return }
  case 'move_question':       { await Quiz.moveQuestion(db, open, action.question_id, action.onto_idx); return }
  case 'set_chain':           { await Quiz.setChain(db, open, action.question_id, action.chains_to); return }
  case 'sort_by_chain_order': { await Quiz.sortByChainOrder(db, open, action.descending); return }
  case 'record_widgeted':     { await Quiz.recordWidgeted(db, open, action.widgeted); return }
  case 'enter_widgeted':      { await Quiz.enterWidgeted(db, open, action.entered); return }
  case 'import_questions':    { await Quiz.importQuestions(db, open, action.questions); return }
  case 'new_quiz':            { await Quiz.newQuiz(db, open, action.label); return }
  case 'delete_quiz':         { await Quiz.deleteQuizFrom(db, open, action.quiz_id); return }
  case 'set_lock':            { await Quiz.setLock(db, action.quiz_id, action.locked); return }
  case 'open_review':         { await Review.openReview(db, open.hunt_id, action.quiz_id, ident_id); return }
  case 'set_overall':         { await Review.setOverall(db, action.quiz_id, ident_id, action.overall); return }
  case 'set_review_phase':    { await Review.setReviewPhase(db, action.quiz_id, ident_id, action.phase); return }
  case 'set_reviewing':       { await Review.setReviewing(db, action.quiz_id, ident_id, action.question_id, action.patch); return }
  case 'peek_answer':         { await Review.peekAnswer(db, action.quiz_id, ident_id, action.question_id); return }
  case 'add_hunting':         { await Hunting.addHunting(db, open.hunt_id, ident_id, action.ident_label, action.role); return }
  case 'remove_hunting':      { await Hunting.removeHunting(db, open.hunt_id, ident_id, action.ident_id); return }
  case 'retitle_hunt':        { await Hunt.retitleHunt(db, open.hunt_id, action.title); return }
  case 'relabel_hunt':        { await Hunt.relabelHunt(db, open.hunt_id, action.label); return }
  case 'delete_hunt':         { await Hunt.deleteHunt(db, open.hunt_id) }
  }
}
