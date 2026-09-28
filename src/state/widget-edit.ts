import * as Labelmaker from '../lib/labelmaker'
import { Column } from '../models/column'
import { DefaultOwner, ExpressionValidators, type ExpressionT } from '../models/expression'
import { QuestionWidgetLabel, WidgetValidators, type ExpressingPatch, type ExpressingT, type BottingPatch, type BottingWidgetT } from '../models/widget'
import type { QuizT } from '../models/quiz'
import type { HuntActionDNA } from '../models/actions'

/** What the expression select says for "write a new one", which no expression is labelled */
export const NewExpression = ''

/** How wide the column a new widget brings with it is: a number's, or a list's */
export const NewExpressingWidthPx = 78
export const NewBottingWidthPx = 170

/** Everything the expressing editor holds while it is open */
export type ExpressingEdit = {
  /** The widget being edited, or null for a new one */
  widget:          ExpressingT | null
  label:           string
  description:     string
  /** The expression the widget works, or `NewExpression` to write one now */
  expressionLabel: string
  expression:      Pick<ExpressionT, 'label' | 'description' | 'formula'>
}

/** What applying an edit comes to: the actions to dispatch, or what to tell the author is wrong */
export type WidgetPlan =
  | { ok: true, actions: HuntActionDNA[] }
  | { ok: false, issue: string, labelIssue: string | null }

/**
 * The actions that applying `edit` of an expressing widget comes to, or the reason it cannot be.
 *
 * A new expression is added before the widget that works it. An existing expression is revised
 * only if its formula or description changed. A new widget brings a column to show it, just
 * before Alt Text. On a locked quiz the widget is left alone and only the expression -- which
 * belongs to the hunt -- can be revised.
 *
 * @param edit - The editor's state.
 * @param hunt - The hunt as it stands.
 * @param quiz - The quiz the widget belongs to.
 * @returns The plan.
 *
 * @example planExpressingEdit(edit, hunt, quiz)  // => { ok: true, actions: [{ kind: 'add_expression', ... }, { kind: 'add_widget', ... }, { kind: 'add_column', ... }] }
 */
export function planExpressingEdit(edit: Readonly<ExpressingEdit>, hunt: Readonly<{ expressions: readonly ExpressionT[] }>, quiz: QuizT): WidgetPlan {
  const isNew = edit.expressionLabel === NewExpression
  const expression_label = isNew ? Labelmaker.normalize(edit.expression.label) : edit.expressionLabel
  if (isNew && expression_label === '') { return refused('Give the new expression a label.', true) }
  if (isNew && hunt.expressions.some((other) => other.label === expression_label)) { return refused('Another expression already has that label.', true) }
  const expression = ExpressionValidators.expression.safeParse({ owner: DefaultOwner, label: expression_label, formula: edit.expression.formula, description: edit.expression.description })
  if (! expression.success) { return refused(expression.error.issues[0]?.message ?? 'That formula will not do.') }

  const expressionActions = expressionActionsFor(hunt, expression.data, isNew)
  if (quiz.locked) { return { ok: true, actions: expressionActions } }

  const siblings = new Set(quiz.widgets.filter((other) => other.label !== edit.widget?.label).map((other) => other.label))
  const typed = Labelmaker.normalize(edit.label)
  const fallback = expression_label === QuestionWidgetLabel || siblings.has(expression_label) ? Labelmaker.appendFallback(expression_label) : expression_label
  const label = typed === '' ? fallback : typed
  if (label === QuestionWidgetLabel || siblings.has(label)) { return refused('Another widget in this quiz already has that label.') }
  const checked = WidgetValidators.expressing.safeParse({ kind: 'expressing', label, expression_label, description: edit.description })
  if (! checked.success) { return refused(checked.error.issues[0]?.message ?? 'That widget will not do.') }

  const widgetActions: HuntActionDNA[] = edit.widget === null
    ? [{ kind: 'add_widget', widget: checked.data }, newColumnFor(quiz, checked.data.label, NewExpressingWidthPx)]
    : editWidgetActions(edit.widget, checked.data)
  return { ok: true, actions: [...expressionActions, ...widgetActions] }
}

/** What the botting editor holds while it is open */
export type BottingEdit = Pick<BottingWidgetT, 'label' | 'bot_label' | 'textkind' | 'description'> & {
  /** The widget being edited, or null for a new one */
  widget: BottingWidgetT | null
}

/**
 * The actions that applying `edit` of a botting widget comes to, or the reason it cannot be.
 * A new widget brings a column to show it, just before Alt Text.
 *
 * @param edit - The editor's state.
 * @param quiz - The quiz the widget belongs to.
 * @returns The plan.
 */
export function planBottingEdit(edit: Readonly<BottingEdit>, quiz: QuizT): WidgetPlan {
  const label = Labelmaker.normalize(edit.label)
  if (label === '') { return refused('Give the widget a label.', true) }
  const siblings = new Set(quiz.widgets.filter((other) => other.label !== edit.widget?.label).map((other) => other.label))
  if (label === QuestionWidgetLabel || siblings.has(label)) { return refused('Another widget in this quiz already has that label.', true) }
  const checked = WidgetValidators.botting.safeParse({ kind: 'botting', label, bot_label: edit.bot_label, textkind: edit.textkind, description: edit.description })
  if (! checked.success) { return refused(checked.error.issues[0]?.message ?? 'That widget will not do.') }
  if (quiz.locked) { return { ok: true, actions: [] } }
  return {
    ok:      true,
    actions: edit.widget === null
      ? [{ kind: 'add_widget', widget: checked.data }, newColumnFor(quiz, checked.data.label, NewBottingWidthPx)]
      : editWidgetActions(edit.widget, checked.data),
  }
}

/** A refusal */
function refused(issue: string, labelIssue = false): WidgetPlan {
  return { ok: false, issue, labelIssue: labelIssue ? issue : null }
}

/** Adding the expression when it is new, revising it when it changed, and nothing otherwise */
function expressionActionsFor(hunt: Readonly<{ expressions: readonly ExpressionT[] }>, expression: ExpressionT, isNew: boolean): HuntActionDNA[] {
  if (isNew) { return [{ kind: 'add_expression', expression }] }
  const held = hunt.expressions.find((other) => other.label === expression.label)
  if (held?.formula === expression.formula && held.description === expression.description) { return [] }
  return [{ kind: 'edit_expression', label: expression.label, patch: { formula: expression.formula, description: expression.description } }]
}

/** A column showing the widget labelled `label`, titled after it, for a new widget to bring with it */
function newColumnFor(quiz: QuizT, label: string, width_px: number): HuntActionDNA {
  const taken = new Set(quiz.columns.map((column) => column.label))
  const columnLabel = taken.has(label) ? Labelmaker.appendFallback(label) : label
  const column = Column.fill({ label: columnLabel, title: Labelmaker.titleize(label), source: label, width_px })
  const before = quiz.columns.findIndex((each) => each.source === 'question.alt_text')
  return before === -1 ? { kind: 'add_column', column } : { kind: 'add_column', column, onto_idx: before }
}

/** Revising only what changed in an existing widget */
function editWidgetActions(held: ExpressingT | BottingWidgetT, next: ExpressingT | BottingWidgetT): HuntActionDNA[] {
  const changed = Object.entries(next).filter(([key, val]) => key !== 'kind' && (held as Record<string, unknown>)[key] !== val)
  if (changed.length === 0) { return [] }
  const patch: ExpressingPatch | BottingPatch = Object.fromEntries(changed)
  return [{ kind: 'edit_widget', label: held.label, patch }]
}
