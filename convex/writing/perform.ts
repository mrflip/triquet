import * as Hunt from './hunt_actions'
import * as Hunting from './hunting_actions'
import * as Layout from './layout_actions'
import * as Quiz from './quiz_actions'
import * as Review from './review_actions'
import { isLayoutAction, type HuntActionT } from '../../src/models/actions'
import type { PerformClaimsT } from '../authorize'
import type { CensusT } from '../reading'
import type { Writer } from './quiz_writing'

/**
 * Carry out what the author did, writing the rows it comes to, all in one transaction.
 *
 * Whether the actor may take the action at all, and whether the quiz, realm and hunt they affirm
 * are as they say, is `authorize`'s to settle first: the claims it hands on are trusted here, and
 * carry the rows it read, so an action does not read its quiz again. `db` sees only the claims'
 * hunt (`policy_rules.ts`); what a write must know across every hunt it asks `census`. A refused
 * action writes nothing and throws a refusal saying why (`lib/refusals`). Each action reads
 * whatever else it needs as it stands, inside the transaction.
 *
 * @param db - The mutation's database, scoped to the claims' hunt.
 * @param census - What spans every hunt: whose a hunt label is.
 * @param claims - Who is acting, and the quiz on their screen, its realm and hunt, as `affirmPerform` checked them.
 * @param action - What the author did, validated.
 * @throws A refusal, or a Zod error when a row the action comes to is not valid; nothing is written.
 *
 * @example await perform(ctx.db, ctx.census, ctx.claims, action)
 */
export async function perform(db: Writer, census: CensusT, claims: PerformClaimsT, action: HuntActionT): Promise<void> {
  const { hunt_id, ident_id, named } = claims
  if (isLayoutAction(action)) {
    await Layout.performLayout(db, claims, action)
    return
  }
  switch (action.kind) {
  case 'retitle_quiz':        { await Quiz.retitleQuiz(db, claims, action.title); return }
  case 'relabel_quiz':        { await Quiz.relabelQuiz(db, claims, action.label); return }
  case 'set_smiths_note':
  case 'set_q1_preamble':
  case 'set_recap_head':
  case 'set_recap_tail':      { await Quiz.setQuizNote(db, claims, action); return }
  case 'set_recap_template':  { await Quiz.setRecapTemplate(db, claims, action.recap_template); return }
  case 'edit_question':       { await Quiz.editQuestion(db, claims, action.question_id, action.patch); return }
  case 'add_question':        { await Quiz.addQuestion(db, claims); return }
  case 'delete_questions':    { await Quiz.deleteQuestions(db, claims, action.question_ids); return }
  case 'set_viz':             { await Quiz.setViz(db, claims, action.question_ids, action.viz); return }
  case 'sort_questions':      { await Quiz.sortQuestions(db, claims, action.sortkey, action.question_ids); return }
  case 'renumber_qnums':      { await Quiz.renumberQnums(db, claims); return }
  case 'move_question':       { await Quiz.moveQuestion(db, claims, action.question_id, action.onto_idx); return }
  case 'set_chain':           { await Quiz.setChain(db, claims, action.question_id, action.chains_to); return }
  case 'sort_by_chain_order': { await Quiz.sortByChainOrder(db, claims, action.descending); return }
  case 'record_widgeted':     { await Quiz.recordWidgeted(db, claims, action.widgeted); return }
  case 'enter_widgeted':      { await Quiz.enterWidgeted(db, claims, action.entered); return }
  case 'enter_quiz_widgeted': { await Quiz.enterQuizWidgeted(db, claims, action.entered); return }
  case 'import_questions':    { await Quiz.importQuestions(db, claims, action.questions, action.last_sortkey); return }
  case 'new_quiz':            { await Quiz.newQuiz(db, claims, action.label); return }
  case 'delete_quiz':         { await Quiz.deleteQuizFrom(db, claims, named); return }
  case 'set_lock':            { await Quiz.setLock(db, named, action.locked); return }
  case 'open_review':         { await Review.openReview(db, hunt_id, named, ident_id); return }
  case 'set_overall':         { await Review.setOverall(db, action.quiz_id, ident_id, action.overall); return }
  case 'set_review_phase':    { await Review.setReviewPhase(db, action.quiz_id, ident_id, action.phase); return }
  case 'set_reviewing':       { await Review.setReviewing(db, action.quiz_id, ident_id, action.question_id, action.patch); return }
  case 'peek_answer':         { await Review.peekAnswer(db, action.quiz_id, ident_id, action.question_id); return }
  case 'add_hunting':         { await Hunting.addHunting(db, hunt_id, action.ident_label, action.role); return }
  case 'remove_hunting':      { await Hunting.removeHunting(db, hunt_id, action.ident_id); return }
  case 'retitle_hunt':        { await Hunt.retitleHunt(db, hunt_id, action.title); return }
  case 'relabel_hunt':        { await Hunt.relabelHunt(db, census, hunt_id, action.label); return }
  case 'delete_hunt':         { await Hunt.deleteHunt(db, hunt_id) }
  }
}
