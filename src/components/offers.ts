import type * as Actor from '../lib/actor'
import * as Approve from '../lib/approve'

/**
 * What the smith's screen offers its author beyond reading, each decided by the policy of the
 * action it sends (`Approve`), so the screen offers exactly what the server would accept. Changing
 * the hunt and its quizzes is not here: the screen is shown only to whoever may (`Hunting.mayOpen`).
 * Who may be put on or taken off the hunt turns on who, and the members panel asks of each.
 */
export type WorkbenchOffersT = {
  /** Retitle the quiz and write its smith's note (the header); relabel it (the gear); write its Q1 preamble (LL Export) */
  reviseQuiz:      boolean
  /** Edit, add, delete, move, sort, renumber and chain its questions, and ask the bots of them (the grid and the toolbar) */
  reviseQuestions: boolean
  /** Bring questions in from a paste (the Import tab) */
  importQuestions: boolean
  /** Add, edit, move and remove its columns and widgetings (the gear) */
  reviseLayout:    boolean
  /** Write to the library every hunt shares (the library editor, and the Library tab's import) */
  changeLibrary:   boolean
  /** Read the hunt whole, for the Raw Export */
  exportHunt:      boolean
}

/**
 * What the smith's screen offers the holder of `claims`: see `WorkbenchOffersT`.
 *
 * @param claims - What the browser holds of itself on the hunt, with the quiz on screen (`useHunt`).
 * @returns Whether each is offered.
 *
 * @example workbenchOffers(claims).reviseQuestions  // => false, for a smith of a locked quiz
 * @example workbenchOffers(claims).changeLibrary    // => true, for a smith of a locked quiz
 */
export function workbenchOffers(claims: Actor.QuizClaimsT): WorkbenchOffersT {
  return {
    reviseQuiz:      Approve.mayOffer('retitle_quiz', claims),
    reviseQuestions: Approve.mayOffer('edit_question', claims),
    importQuestions: Approve.mayOffer('import_questions', claims),
    reviseLayout:    Approve.mayOffer('edit_column', claims),
    changeLibrary:   Approve.may('change_library', claims),
    exportHunt:      Approve.may('export_hunt', claims),
  }
}
