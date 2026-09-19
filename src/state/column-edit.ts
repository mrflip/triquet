import * as Labelmaker from '../lib/labelmaker'
import { DefaultOwner, ExpressionValidators, type ExpressionT } from '../models/expression'
import { Expressing, ExpressingValidators, type ExpressingPatch, type ExpressingShape, type ExpressingT } from '../models/expressing'
import type { QuizT } from '../models/quiz'
import type { WorkspaceT } from '../models/workspace'
import type { WorkspaceAction } from './workspace-reducer'

/** What the expression select says for "write a new one", which no expression is labelled */
export const NewExpression = ''

/** Everything the column editor holds while it is open */
export type ColumnEdit = {
  /** The column being edited, or null for a new one */
  expressing:      ExpressingT | null
  title:           string
  label:           string
  description:     string
  shape:           ExpressingShape
  /** The expression the column works, or `NewExpression` to write one now */
  expressionLabel: string
  expression:      Pick<ExpressionT, 'label' | 'description' | 'formula'>
}

/** What applying an edit comes to: the actions to dispatch, or what to tell the author is wrong */
export type ColumnPlan =
  | { ok: true, actions: WorkspaceAction[] }
  | { ok: false, issue: string, labelIssue: string | null }

/**
 * The actions that applying `edit` comes to, or the reason it cannot be applied.
 *
 * A new expression is added before the column that works it. An existing expression is revised
 * only if its formula or description changed. On a locked quiz the column itself is left alone
 * and only the expression -- which belongs to the workspace -- can be revised.
 *
 * @param edit - The editor's state.
 * @param workspace - The workspace as it stands.
 * @param quiz - The quiz the column belongs to.
 * @returns The plan.
 *
 * @example planColumnEdit(edit, workspace, quiz)  // => { ok: true, actions: [{ kind: 'add_expression', ... }, { kind: 'add_expressing', ... }] }
 */
export function planColumnEdit(edit: Readonly<ColumnEdit>, workspace: WorkspaceT, quiz: QuizT): ColumnPlan {
  const isNew = edit.expressionLabel === NewExpression
  const expression_label = isNew ? Labelmaker.normalize(edit.expression.label) : edit.expressionLabel
  if (isNew && expression_label === '') { return refused('Give the new expression a label.', true) }
  if (isNew && workspace.expressions.some((other) => other.label === expression_label)) { return refused('Another expression already has that label.', true) }
  const expression = ExpressionValidators.expression.safeParse({ owner: DefaultOwner, label: expression_label, formula: edit.expression.formula, description: edit.expression.description })
  if (! expression.success) { return refused(expression.error.issues[0]?.message ?? 'That formula will not do.') }

  const expressionActions = expressionActionsFor(workspace, expression.data, isNew)
  if (quiz.locked) { return { ok: true, actions: expressionActions } }

  const siblings = new Set(quiz.expressings.filter((other) => other.label !== edit.expressing?.label).map((other) => other.label))
  const column = columnFor(edit, expression_label, siblings)
  if (siblings.has(column.label)) { return refused('Another column in this quiz already has that label.') }
  const checked = ExpressingValidators.expressing.safeParse(column)
  if (! checked.success) { return refused(checked.error.issues[0]?.message ?? 'That column will not do.') }
  return { ok: true, actions: [...expressionActions, ...columnActionsFor(edit.expressing, checked.data)] }
}

/** A refusal */
function refused(issue: string, labelIssue = false): ColumnPlan {
  return { ok: false, issue, labelIssue: labelIssue ? issue : null }
}

/** Adding the expression when it is new, revising it when it changed, and nothing otherwise */
function expressionActionsFor(workspace: WorkspaceT, expression: ExpressionT, isNew: boolean): WorkspaceAction[] {
  if (isNew) { return [{ kind: 'add_expression', expression }] }
  const held = workspace.expressions.find((other) => other.label === expression.label)
  if (held?.formula === expression.formula && held.description === expression.description) { return [] }
  return [{ kind: 'edit_expression', label: expression.label, patch: { formula: expression.formula, description: expression.description } }]
}

/** The column as the editor describes it: its label falls back to the expression's, made unique among its siblings */
function columnFor(edit: Readonly<ColumnEdit>, expression_label: string, siblings: ReadonlySet<string>) {
  const typed = Labelmaker.normalize(edit.label)
  const fallback = siblings.has(expression_label) ? Labelmaker.appendFallback(expression_label) : expression_label
  const label = typed === '' ? fallback : typed
  return {
    label,
    expression_label,
    title:       edit.title.trim() === '' ? Labelmaker.titleize(label) : edit.title.trim(),
    description: edit.description,
    shape:       edit.shape,
  }
}

/** Adding a new column, or revising only what changed in an existing one */
function columnActionsFor(held: ExpressingT | null, next: ExpressingT): WorkspaceAction[] {
  if (held === null) { return [{ kind: 'add_expressing', expressing: Expressing.fill(next) }] }
  const patch: ExpressingPatch = {
    ...(next.label !== held.label && { label: next.label }),
    ...(next.expression_label !== held.expression_label && { expression_label: next.expression_label }),
    ...(next.title !== held.title && { title: next.title }),
    ...(next.description !== held.description && { description: next.description }),
    ...(next.shape !== held.shape && { shape: next.shape }),
  }
  return Object.keys(patch).length === 0 ? [] : [{ kind: 'edit_expressing', label: held.label, patch }]
}
