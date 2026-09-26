import type { Db } from 'jazz-tools'
import * as Layout from './layout-actions'
import * as Quiz from './quiz-actions'
import type { OpenQuiz } from './quiz-actions'
import { isLayoutAction } from './layout-reducer'
import type { WorkspaceAction } from './workspace-reducer'

export type { OpenQuiz } from './quiz-actions'

/**
 * Carry out what the author did, writing rows: the row-writing successor of `workspaceReducer`,
 * over the same actions.
 *
 * Actions that revise the quiz on screen are refused outright while it is locked; actions about
 * the workspace (opening, making, deleting and locking quizzes, and the expressions) are not.
 * A refused action writes nothing and says nothing.
 *
 * @param db - The account's database.
 * @param open - The quiz on the author's screen, where an action on "the quiz" lands.
 * @param action - What the author did.
 * @throws When the action carries something invalid; nothing is written.
 *
 * @example await perform(db, open, { kind: 'add_question' })
 */
export async function perform(db: Db, open: OpenQuiz, action: WorkspaceAction): Promise<void> {
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
  case 'open_quiz':           { await Quiz.openQuiz(db, open, action.quiz_id); return }
  case 'new_quiz':            { await Quiz.newQuiz(db, open, action.label); return }
  case 'delete_quiz':         { await Quiz.deleteQuizFrom(db, open, action.quiz_id); return }
  case 'set_lock':            { await Quiz.setLock(db, action.quiz_id, action.locked); return }
  case 'replace_workspace':   { await Quiz.replaceWorkspace(db, open, action.workspace) }
  }
}
