import type { ColumnDNA, ColumnPatch } from '../models/column'
import type { ExpressionDNA, ExpressionPatch } from '../models/expression'
import type { ExpressingPatch, PlayingPatch, WidgetDNA } from '../models/widget'
import type { QuestionPatch } from '../models/question'
import type { LastErrT } from '../models/ask'
import type { GuessT } from '../models/guess'
import type { IshesT } from '../models/ish'
import type { Textkind } from '../lib/ask/contract'
import type { BulkLanding } from '../lib/ask/bulk'
import type { BulkIshesRunT, QuizT, Sortkey } from '../models/quiz'
import type { WorkspaceT } from '../models/workspace'

// The vocabulary of what an author can do. A view says which of these happened, and `perform`
// writes the rows it comes to.

/** Everything the author can do to a quiz's widgets and columns, and to the workspace's expressions */
export type LayoutAction =
  | { kind: 'add_widget', widget: WidgetDNA }
  | { kind: 'edit_widget', label: string, patch: ExpressingPatch | PlayingPatch }
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

/** Everything the author can do to their workspace */
export type WorkspaceAction =
  | LayoutAction
  | { kind: 'replace_workspace', workspace: WorkspaceT }
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
  | { kind: 'open_quiz', quiz_id: string }
  | { kind: 'new_quiz', label?: string }
  | { kind: 'delete_quiz', quiz_id: string }
  | { kind: 'set_lock', quiz_id: string, locked: boolean }
  | { kind: 'replace_open_quiz', quiz: QuizT }

