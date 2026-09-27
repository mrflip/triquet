import type { ColumnDNA, ColumnPatch } from '../models/column'
import type { ExpressionDNA, ExpressionPatch } from '../models/expression'
import type { ExpressingPatch, BottingPatch, WidgetDNA } from '../models/widget'
import type { QuestionPatch } from '../models/question'
import type { LastErrT } from '../models/ask'
import type { GuessT } from '../models/guess'
import type { IshesT } from '../models/ish'
import type { ReviewPhase } from '../models/review'
import type { Textkind } from '../lib/ask/contract'
import type { BulkLanding } from '../lib/ask/bulk'
import type { BulkIshesRunT, QuizT, Sortkey } from '../models/quiz'

// The vocabulary of what an author can do. A view says which of these happened, and `perform`
// writes the rows it comes to.

/** Everything the author can do to a quiz's widgets and columns, and to the hunt's expressions */
export type LayoutAction =
  | { kind: 'add_widget', widget: WidgetDNA }
  | { kind: 'edit_widget', label: string, patch: ExpressingPatch | BottingPatch }
  | { kind: 'delete_widget', label: string }
  | { kind: 'move_widget', label: string, onto_idx: number }
  | { kind: 'add_column', column: ColumnDNA, onto_idx?: number }
  | { kind: 'edit_column', label: string, patch: ColumnPatch }
  | { kind: 'delete_column', label: string }
  | { kind: 'move_column', label: string, onto_idx: number }
  | { kind: 'add_expression', expression: ExpressionDNA }
  | { kind: 'edit_expression', label: string, patch: ExpressionPatch }
  | { kind: 'delete_expression', label: string }

const LayoutKinds: ReadonlySet<string> = new Set([
  'add_widget', 'edit_widget', 'delete_widget', 'move_widget',
  'add_column', 'edit_column', 'delete_column', 'move_column',
  'add_expression', 'edit_expression', 'delete_expression',
])

/** Whether `action` is one `performLayout` carries out */
export function isLayoutAction(action: { kind: string }): action is LayoutAction {
  return LayoutKinds.has(action.kind)
}

/** Everything the author can do from inside a quiz: to it, to its realm's quizzes, and to its hunt's expressions */
export type HuntAction =
  | LayoutAction
  | { kind: 'retitle_quiz', title: string }
  | { kind: 'relabel_quiz', label: string }
  | { kind: 'reversion_quiz', version: string }
  | { kind: 'edit_question', question_id: string, patch: QuestionPatch }
  | { kind: 'add_question' }
  | { kind: 'delete_questions', question_ids: readonly string[] }
  | { kind: 'sort_questions', sortkey: Sortkey, descending: boolean }
  | { kind: 'renumber_qnums' }
  | { kind: 'move_question', question_id: string, onto_idx: number }
  | { kind: 'set_chain', question_id: string, chains_to: string | null }
  | { kind: 'sort_by_chain_order', descending: boolean }
  | { kind: 'set_guess', question_id: string, guess: GuessT }
  | { kind: 'set_ishes', question_id: string, textkind: Textkind, ishes: IshesT }
  | { kind: 'fail_guess', question_id: string, err: LastErrT }
  | { kind: 'fail_ishes', question_id: string, textkind: Textkind, err: LastErrT }
  | { kind: 'apply_bulk_ishes', landings: readonly BulkLanding[], run: BulkIshesRunT }
  | { kind: 'new_quiz', label?: string }
  | { kind: 'delete_quiz', quiz_id: string }
  | { kind: 'set_lock', quiz_id: string, locked: boolean }
  | { kind: 'replace_open_quiz', quiz: QuizT }
  | { kind: 'open_review', quiz_id: string }
  | { kind: 'set_overall', quiz_id: string, overall: string }
  | { kind: 'set_review_phase', quiz_id: string, phase: Exclude<ReviewPhase, 'empty'> }


/** What a visitor can do before any quiz is open: become an ident, and make a hunt */
export type AccountAction =
  | { kind: 'assume_ident', label: string, title: string }
  | { kind: 'new_hunt', label: string }
