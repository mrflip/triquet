import { Question, QuestionValidators, type QuestionPatch, type QuestionT } from '../models/question'
import { Quiz } from '../models/quiz'
import { ExpressionValidators, keyOf, type ExpressionDNA, type ExpressionPatch } from '../models/expression'
import { ExpressingValidators, defaultsFor, sortkeyOf, type ExpressingDNA, type ExpressingPatch } from '../models/expressing'
import * as Expressed from '../lib/expressed'
import * as Chain from '../lib/chain'
import * as Rank from '../lib/rank'
import * as Sortings from '../lib/sortings'
import { markIshesStale } from '../models/ish'
import type { GuessT } from '../models/guess'
import type { IshesT } from '../models/ish'
import type { Textkind } from '../lib/ask/contract'
import type { BulkLanding } from '../lib/ask/bulk'
import type { BulkIshesRunT, QuizT, Sortkey } from '../models/quiz'
import type { WorkspaceT } from '../models/workspace'

/** Everything the author can do to their workspace */
export type WorkspaceAction =
  | { kind: 'replace_workspace', workspace: WorkspaceT }
  | { kind: 'retitle_quiz', title: string }
  | { kind: 'relabel_quiz', label: string }
  | { kind: 'reversion_quiz', version: string }
  | { kind: 'edit_question', question_id: string, patch: QuestionPatch }
  | { kind: 'add_question' }
  | { kind: 'sort_questions', sortkey: Sortkey, descending: boolean }
  | { kind: 'renumber_qnums' }
  | { kind: 'drag_question', question_id: string, onto_idx: number }
  | { kind: 'set_chain', question_id: string, chains_to: string | null }
  | { kind: 'sort_by_chain_order', descending: boolean }
  | { kind: 'set_guess', question_id: string, guess: GuessT }
  | { kind: 'set_ishes', question_id: string, textkind: Textkind, ishes: IshesT }
  | { kind: 'apply_bulk_ishes', landings: readonly BulkLanding[], run: BulkIshesRunT }
  | { kind: 'open_quiz', quiz_id: string }
  | { kind: 'new_quiz', label?: string }
  | { kind: 'delete_quiz', quiz_id: string }
  | { kind: 'set_lock', quiz_id: string, locked: boolean }
  | { kind: 'replace_open_quiz', quiz: QuizT }
  | { kind: 'add_expressing', expressing: ExpressingDNA }
  | { kind: 'edit_expressing', label: string, patch: ExpressingPatch }
  | { kind: 'delete_expressing', label: string }
  | { kind: 'add_expression', expression: ExpressionDNA }
  | { kind: 'edit_expression', label: string, patch: ExpressionPatch }
  | { kind: 'delete_expression', label: string }

/**
 * The workspace as it stands after `action`.
 *
 * Actions that revise the open quiz are refused outright while that quiz is locked -- the
 * freeze is a property of the quiz, not of whether a button happened to be greyed out.
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
  case 'relabel_quiz': {
    // The label itself, and uniqueness against sibling quizzes, are the caller's job to check
    // before dispatching -- this just applies the override, same as retitle_quiz applies a title.
    return reviseOpenQuiz(workspace, (quiz) => ({ ...quiz, forced_label: action.label }))
  }
  case 'reversion_quiz': {
    // Naming a version the quiz's history has not seen starts a branch rather than erroring;
    // that happens where the history lives, not here. The shape of the name is the caller's job.
    return reviseOpenQuiz(workspace, (quiz) => ({ ...quiz, version: action.version }))
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
    // A sort commits: the new arrangement is written into the quiz, not draped over it.
    return reviseOpenQuiz(workspace, (quiz) => ({
      ...quiz,
      questions:    Sortings.sortQuestions(quiz.questions, Sortings.sortValueFor(action.sortkey, quiz.questions, Expressed.forQuiz(quiz, workspace.expressions)), action.descending),
      last_sortkey: action.sortkey,
    }))
  }
  case 'renumber_qnums': {
    // Deliberately leaves `last_sortkey` alone. Claiming the quiz is now in Q# order would
    // flip the grid into a mode that immediately re-sorts, undoing the promise that nothing moved.
    return reviseOpenQuiz(workspace, (quiz) => ({ ...quiz, questions: Rank.renumberByRank(quiz.questions) }))
  }
  case 'set_ishes': {
    return reviseOpenQuiz(workspace, (quiz) => ({
      ...quiz,
      questions: quiz.questions.map((question) => {
        if (question.id !== action.question_id) { return question }
        const slot = action.textkind === 'clueing' ? 'clueing_ishes' : 'hint_ishes'
        return { ...question, [slot]: action.ishes }
      }),
    }))
  }
  // These four are about the workspace rather than about a quiz's contents, so a locked quiz
  // does not refuse them. Locking must never be a trap: you can always switch away, make
  // another quiz, delete one, or unlock.
  case 'open_quiz': {
    return workspace.quizzes.some((quiz) => quiz.id === action.quiz_id)
      ? { ...workspace, active_quiz_id: action.quiz_id }
      : workspace
  }
  case 'new_quiz': {
    // A label named here, like a relabel, is the caller's job to have checked for uniqueness.
    const fresh = { ...Quiz.blank('', action.label), expressings: defaultsFor(workspace.expressions) }
    return { ...workspace, quizzes: [...workspace.quizzes, fresh], active_quiz_id: fresh.id }
  }
  case 'delete_quiz': {
    return withoutQuiz(workspace, action.quiz_id)
  }
  case 'set_lock': {
    return {
      ...workspace,
      quizzes: workspace.quizzes.map((quiz) => (quiz.id === action.quiz_id ? { ...quiz, locked: action.locked } : quiz)),
    }
  }
  case 'replace_open_quiz': {
    return reviseOpenQuiz(workspace, () => action.quiz)
  }
  case 'apply_bulk_ishes': {
    // One run, one cost figure. The results replace whatever was in those cells.
    return reviseOpenQuiz(workspace, (quiz) => ({
      ...quiz,
      questions:       quiz.questions.map((question) => {
        const mine = action.landings.filter((landing) => landing.question_id === question.id)
        if (mine.length === 0) { return question }
        const clueing = mine.find((landing) => landing.textkind === 'clueing')
        const hint    = mine.find((landing) => landing.textkind === 'hint')
        return {
          ...question,
          clueing_ishes: clueing ? clueing.ishes : question.clueing_ishes,
          hint_ishes:    hint ? hint.ishes : question.hint_ishes,
        }
      }),
      bulk_ishes_last: action.run,
    }))
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
      questions: Chain.clearDanglingChains(quiz.questions.map((question) => (
        question.id === action.question_id ? { ...question, chains_to: action.chains_to } : question
      ))),
    }))
  }
  case 'sort_by_chain_order': {
    return reviseOpenQuiz(workspace, (quiz) => ({
      ...quiz,
      questions:    Chain.chainOrder(quiz.questions, action.descending),
      last_sortkey: 'chain_order',
    }))
  }
  case 'add_expressing': {
    const expressing = ExpressingValidators.expressing(action.expressing)
    return reviseOpenQuiz(workspace, (quiz) => (
      quiz.expressings.some((other) => other.label === expressing.label)
        ? quiz
        : { ...quiz, expressings: [...quiz.expressings, expressing] }
    ))
  }
  case 'edit_expressing': {
    const patch = ExpressingValidators.expressingPatch(action.patch)
    return reviseOpenQuiz(workspace, (quiz) => reviseExpressing(quiz, action.label, patch))
  }
  case 'delete_expressing': {
    return reviseOpenQuiz(workspace, (quiz) => ({
      ...quiz,
      expressings:  quiz.expressings.filter((expressing) => expressing.label !== action.label),
      last_sortkey: quiz.last_sortkey === sortkeyOf({ label: action.label }) ? null : quiz.last_sortkey,
    }))
  }
  // The expressions belong to the workspace rather than to a quiz, so a locked quiz does not
  // refuse them either: a column's numbers change with its formula, but the quiz itself does not.
  case 'add_expression': {
    const expression = ExpressionValidators.expression(action.expression)
    const taken = workspace.expressions.some((other) => keyOf(other) === keyOf(expression))
    return taken ? workspace : { ...workspace, expressions: [...workspace.expressions, expression] }
  }
  case 'edit_expression': {
    const patch = ExpressionValidators.expressionPatch(action.patch)
    return {
      ...workspace,
      expressions: workspace.expressions.map((expression) => (expression.label === action.label ? { ...expression, ...patch } : expression)),
    }
  }
  case 'delete_expression': {
    // Refused while a column works it: deleting it would leave that column with nothing to show.
    if (expressionUsage(workspace, action.label) > 0) { return workspace }
    return { ...workspace, expressions: workspace.expressions.filter((expression) => expression.label !== action.label) }
  }
  case 'drag_question': {
    return reviseOpenQuiz(workspace, (quiz) => ({
      ...quiz,
      questions:    Rank.renumberByPosition(Rank.moveQuestion(quiz.questions, action.question_id, action.onto_idx)),
      last_sortkey: 'qnum',
    }))
  }
  }
}

/**
 * `workspace` with its open quiz put through `revise`, unless that quiz is locked.
 *
 * @param workspace - The workspace as it stands.
 * @param revise - How to rewrite the open quiz.
 * @returns The workspace afterwards; the same object when the quiz is locked or absent.
 */
export function reviseOpenQuiz(workspace: WorkspaceT, revise: (quiz: QuizT) => QuizT): WorkspaceT {
  const openQuiz = workspace.quizzes.find((quiz) => quiz.id === workspace.active_quiz_id)
  if (! openQuiz || openQuiz.locked) { return workspace }
  const revised = revise(openQuiz)
  if (revised === openQuiz) { return workspace }
  return {
    ...workspace,
    quizzes: workspace.quizzes.map((quiz) => (quiz.id === openQuiz.id ? revised : quiz)),
  }
}

/**
 * `workspace` without the quiz named, with a neighbour opened in its place.
 *
 * The last remaining quiz cannot be deleted: a workspace with nothing in it would leave the
 * author staring at an empty screen with no way back.
 *
 * @param workspace - The workspace as it stands.
 * @param quiz_id - The quiz to remove.
 * @returns The workspace afterwards; the same one when the quiz is the last, or is not here.
 */
function withoutQuiz(workspace: WorkspaceT, quiz_id: string): WorkspaceT {
  if (workspace.quizzes.length <= 1) { return workspace }
  const idx = workspace.quizzes.findIndex((quiz) => quiz.id === quiz_id)
  if (idx === -1) { return workspace }
  const quizzes = workspace.quizzes.filter((quiz) => quiz.id !== quiz_id)
  const neighbour = quizzes[Math.min(idx, quizzes.length - 1)]
  return {
    ...workspace,
    quizzes,
    active_quiz_id: workspace.active_quiz_id === quiz_id ? neighbour?.id ?? workspace.active_quiz_id : workspace.active_quiz_id,
  }
}

/**
 * How many columns, across every quiz, work the expression labelled `label`.
 *
 * @param workspace - The workspace as it stands.
 * @param label - An expression's label.
 * @returns How many expressings name it; an expression is only deletable at zero.
 *
 * @example expressionUsage(workspace, 'clueing_full')  // => 1
 */
export function expressionUsage(workspace: WorkspaceT, label: string): number {
  return workspace.quizzes.reduce((total, quiz) => total + quiz.expressings.filter((expressing) => expressing.expression_label === label).length, 0)
}

/**
 * `quiz` with the column labelled `label` revised. A rename onto a label a sibling already has
 * is refused, and a rename carries the sort memory with it.
 */
function reviseExpressing(quiz: QuizT, label: string, patch: ExpressingPatch): QuizT {
  const renamedOnto = patch.label ?? label
  const clash = renamedOnto !== label && quiz.expressings.some((other) => other.label === renamedOnto)
  if (clash || quiz.expressings.every((expressing) => expressing.label !== label)) { return quiz }
  return {
    ...quiz,
    expressings:  quiz.expressings.map((expressing) => (expressing.label === label ? { ...expressing, ...patch } : expressing)),
    last_sortkey: quiz.last_sortkey === sortkeyOf({ label }) ? sortkeyOf({ label: renamedOnto }) : quiz.last_sortkey,
  }
}

/** The open quiz, or null when the workspace names one it does not hold */
export function openQuizOf(workspace: WorkspaceT): QuizT | null {
  return workspace.quizzes.find((quiz) => quiz.id === workspace.active_quiz_id) ?? null
}

/**
 * `questions`, with the one named rewritten by a validated patch.
 *
 * Editing a clueing or a hint marks its extraction stale rather than discarding it: an edit
 * never silently throws away a computed result, it just stops vouching for it.
 */
function reviseQuestion(questions: QuestionT[], question_id: string, patch: QuestionPatch): QuestionT[] {
  const clean = QuestionValidators.questionPatch(patch)
  return questions.map((question) => {
    if (question.id !== question_id) { return question }
    const clueingEdited = clean.clueing !== undefined && clean.clueing !== question.clueing
    const hintEdited    = clean.hint !== undefined && clean.hint !== question.hint
    // Staleness first, so a patch that carries its own extraction still wins over it.
    return {
      ...question,
      clueing_ishes: clueingEdited ? markIshesStale(question.clueing_ishes) : question.clueing_ishes,
      hint_ishes:    hintEdited ? markIshesStale(question.hint_ishes) : question.hint_ishes,
      ...clean,
    }
  })
}
