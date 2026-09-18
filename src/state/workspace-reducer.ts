import { Question, QuestionValidators, type QuestionPatch, type QuestionT } from '../models/question'
import { chainOrder, clearDanglingChains } from '../lib/chain'
import { moveQuestion, renumberByPosition, renumberByRank } from '../lib/rank'
import { sortQuestions, sortValueFor } from '../lib/sortings'
import type { GuessT } from '../models/guess'
import type { QuizT, Sortkey } from '../models/quiz'
import type { WorkspaceT } from '../models/workspace'

/** Everything the author can do to their workspace */
export type WorkspaceAction =
  | { kind: 'replace_workspace', workspace: WorkspaceT }
  | { kind: 'retitle_quiz', title: string }
  | { kind: 'edit_question', question_id: string, patch: QuestionPatch }
  | { kind: 'add_question' }
  | { kind: 'sort_questions', sortkey: Sortkey, descending: boolean }
  | { kind: 'renumber_qnums' }
  | { kind: 'drag_question', question_id: string, onto_idx: number }
  | { kind: 'set_chain', question_id: string, chains_to: string | null }
  | { kind: 'sort_by_chain_order', descending: boolean }
  | { kind: 'set_guess', question_id: string, guess: GuessT }

/**
 * The workspace as it stands after `action`.
 *
 * Actions that revise the open round are refused outright while that round is locked -- the
 * freeze is a property of the round, not of whether a button happened to be greyed out.
 *
 * @param workspace - The workspace as it stands.
 * @param action - What the author did.
 * @returns The workspace afterwards; the same object when nothing changed.
 *
 * @example workspaceReducer(workspace, { kind: 'add_question' })
 */
export function workspaceReducer(workspace: WorkspaceT, action: WorkspaceAction): WorkspaceT {
  switch (action.kind) {
  case 'replace_workspace': {
    return action.workspace
  }
  case 'retitle_quiz': {
    return reviseOpenQuiz(workspace, (quiz) => ({ ...quiz, title: action.title }))
  }
  case 'edit_question': {
    return reviseOpenQuiz(workspace, (quiz) => ({
      ...quiz,
      questions: reviseQuestion(quiz.questions, action.question_id, action.patch),
    }))
  }
  case 'add_question': {
    return reviseOpenQuiz(workspace, (quiz) => ({ ...quiz, questions: [...quiz.questions, Question.blank()] }))
  }
  case 'sort_questions': {
    // A sort commits: the new arrangement is written into the round, not draped over it.
    return reviseOpenQuiz(workspace, (quiz) => ({
      ...quiz,
      questions:    sortQuestions(quiz.questions, sortValueFor(action.sortkey, quiz.questions), action.descending),
      last_sortkey: action.sortkey,
    }))
  }
  case 'renumber_qnums': {
    // Deliberately leaves `last_sortkey` alone. Claiming the round is now in Q# order would
    // flip the grid into a mode that immediately re-sorts, undoing the promise that nothing moved.
    return reviseOpenQuiz(workspace, (quiz) => ({ ...quiz, questions: renumberByRank(quiz.questions) }))
  }
  case 'set_guess': {
    return reviseOpenQuiz(workspace, (quiz) => ({
      ...quiz,
      questions: quiz.questions.map((question) => (
        question.id === action.question_id ? { ...question, guess: action.guess } : question
      )),
    }))
  }
  case 'set_chain': {
    return reviseOpenQuiz(workspace, (quiz) => ({
      ...quiz,
      questions: clearDanglingChains(quiz.questions.map((question) => (
        question.id === action.question_id ? { ...question, chains_to: action.chains_to } : question
      ))),
    }))
  }
  case 'sort_by_chain_order': {
    return reviseOpenQuiz(workspace, (quiz) => ({
      ...quiz,
      questions:    chainOrder(quiz.questions, action.descending),
      last_sortkey: 'chain_order',
    }))
  }
  case 'drag_question': {
    return reviseOpenQuiz(workspace, (quiz) => ({
      ...quiz,
      questions:    renumberByPosition(moveQuestion(quiz.questions, action.question_id, action.onto_idx)),
      last_sortkey: 'qnum',
    }))
  }
  }
}

/**
 * `workspace` with its open round put through `revise`, unless that round is locked.
 *
 * @param workspace - The workspace as it stands.
 * @param revise - How to rewrite the open round.
 * @returns The workspace afterwards; the same object when the round is locked or absent.
 */
export function reviseOpenQuiz(workspace: WorkspaceT, revise: (quiz: QuizT) => QuizT): WorkspaceT {
  const openQuiz = workspace.quizzes.find((quiz) => quiz.id === workspace.active_quiz_id)
  if (! openQuiz || openQuiz.locked) { return workspace }
  const revised = revise(openQuiz)
  return {
    ...workspace,
    quizzes: workspace.quizzes.map((quiz) => (quiz.id === openQuiz.id ? revised : quiz)),
  }
}

/** The open round, or null when the workspace names one it does not hold */
export function openQuizOf(workspace: WorkspaceT): QuizT | null {
  return workspace.quizzes.find((quiz) => quiz.id === workspace.active_quiz_id) ?? null
}

/** `questions`, with the one named rewritten by a validated patch */
function reviseQuestion(questions: QuestionT[], question_id: string, patch: QuestionPatch): QuestionT[] {
  const clean = QuestionValidators.questionPatch(patch)
  return questions.map((question) => (question.id === question_id ? { ...question, ...clean } : question))
}
