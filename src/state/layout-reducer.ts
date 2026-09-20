import { ColumnValidators, sortkeyOf, sourceOf, type ColumnDNA, type ColumnPatch } from '../models/column'
import { ExpressionValidators, keyOf, type ExpressionDNA, type ExpressionPatch } from '../models/expression'
import { QuestionWidgetLabel, WidgetValidators, type ExpressingPatch, type PlayingPatch, type WidgetDNA } from '../models/widget'
import { reviseOpenQuiz } from './revise-quiz'
import type { QuizT } from '../models/quiz'
import type { WorkspaceT } from '../models/workspace'

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

/** Whether `action` is one for `layoutReducer` */
export function isLayoutAction(action: { kind: string }): action is LayoutAction {
  return LayoutKinds.has(action.kind)
}

/**
 * The workspace as it stands after an action on a quiz's widgets or columns, or on the
 * workspace's expressions.
 *
 * Widget and column actions are refused outright while the open quiz is locked. Expressions
 * belong to the workspace rather than to a quiz, so a locked quiz does not refuse them: a
 * column's numbers change with its formula, but the quiz itself does not.
 *
 * @param workspace - The workspace as it stands.
 * @param action - What the author did.
 * @returns The workspace afterwards; the same object when nothing changed.
 *
 * @example layoutReducer(workspace, { kind: 'delete_column', label: 'notes' })
 */
export function layoutReducer(workspace: WorkspaceT, action: LayoutAction): WorkspaceT {
  switch (action.kind) {
  case 'add_widget': {
    const widget = WidgetValidators.widget(action.widget)
    return reviseOpenQuiz(workspace, (quiz) => (labelTaken(quiz, widget.label) ? quiz : { ...quiz, widgets: [...quiz.widgets, widget] }))
  }
  case 'edit_widget': {
    return reviseOpenQuiz(workspace, (quiz) => reviseWidget(quiz, action.label, action.patch))
  }
  case 'delete_widget': {
    // The columns that showed it go with it: a column with nothing to show is not a column.
    return reviseOpenQuiz(workspace, (quiz) => withoutColumns({ ...quiz, widgets: quiz.widgets.filter((widget) => widget.label !== action.label) }, (column) => column.source === action.label))
  }
  case 'move_widget': {
    return reviseOpenQuiz(workspace, (quiz) => ({ ...quiz, widgets: movedTo(quiz.widgets, action.label, action.onto_idx) }))
  }
  case 'add_column': {
    const column = ColumnValidators.column(action.column)
    return reviseOpenQuiz(workspace, (quiz) => (
      quiz.columns.some((other) => other.label === column.label) || ! showable(quiz, column.source)
        ? quiz
        : { ...quiz, columns: insertedAt(quiz.columns, column, action.onto_idx) }
    ))
  }
  case 'edit_column': {
    const patch = ColumnValidators.columnPatch(action.patch)
    return reviseOpenQuiz(workspace, (quiz) => reviseColumn(quiz, action.label, patch))
  }
  case 'delete_column': {
    return reviseOpenQuiz(workspace, (quiz) => withoutColumns(quiz, (column) => column.label === action.label))
  }
  case 'move_column': {
    return reviseOpenQuiz(workspace, (quiz) => ({ ...quiz, columns: movedTo(quiz.columns, action.label, action.onto_idx) }))
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
  }
}

/**
 * How many widgets, across every quiz, work the expression labelled `label`.
 *
 * @param workspace - The workspace as it stands.
 * @param label - An expression's label.
 * @returns How many expressing widgets name it; an expression is only deletable at zero.
 *
 * @example expressionUsage(workspace, 'clueing_full')  // => 1
 */
export function expressionUsage(workspace: WorkspaceT, label: string): number {
  return workspace.quizzes.reduce((total, quiz) => total + quiz.widgets.filter((widget) => widget.kind === 'expressing' && widget.expression_label === label).length, 0)
}

/** Whether a widget of `quiz` already has this label, or it is the questions' own */
function labelTaken(quiz: QuizT, label: string): boolean {
  return label === QuestionWidgetLabel || quiz.widgets.some((widget) => widget.label === label)
}

/** Whether `source` names something `quiz` can show */
function showable(quiz: QuizT, source: string): boolean {
  const named = sourceOf(source)
  return named.kind !== 'widget' || quiz.widgets.some((widget) => widget.label === named.label)
}

/** `items` with `item` put in at `idx`, or at the end when there is none */
function insertedAt<TT>(items: readonly TT[], item: TT, idx: number | undefined): TT[] {
  const placed = [...items]
  placed.splice(idx === undefined ? placed.length : Math.max(0, Math.min(idx, placed.length)), 0, item)
  return placed
}

/** `items` with the one labelled `label` lifted out and dropped at `onto_idx` */
function movedTo<TT extends { label: string }>(items: readonly TT[], label: string, onto_idx: number): TT[] {
  const from_idx = items.findIndex((item) => item.label === label)
  const lifted = [...items]
  const [moved] = lifted.splice(from_idx, 1)
  if (from_idx === -1 || ! moved) { return [...items] }
  lifted.splice(Math.max(0, Math.min(onto_idx, lifted.length)), 0, moved)
  return lifted
}

/**
 * `quiz` without the columns `doomed` picks, and without a sort memory that named one of them.
 * The same quiz when none is picked.
 */
function withoutColumns(quiz: QuizT, doomed: (column: QuizT['columns'][number]) => boolean): QuizT {
  const gone = quiz.columns.filter((column) => doomed(column))
  const forgotten = quiz.last_sortkey !== null && gone.some((column) => sortkeyOf(column) === quiz.last_sortkey)
  return { ...quiz, columns: quiz.columns.filter((column) => ! doomed(column)), last_sortkey: forgotten ? null : quiz.last_sortkey }
}

/**
 * `quiz` with the widget labelled `label` revised, its patch validated for the kind of widget it is.
 * A rename onto a label a sibling has is refused, and carries the columns that show the widget with it.
 */
function reviseWidget(quiz: QuizT, label: string, patch: ExpressingPatch | PlayingPatch): QuizT {
  const held = quiz.widgets.find((widget) => widget.label === label)
  if (! held) { return quiz }
  const clean = held.kind === 'expressing' ? WidgetValidators.expressingPatch(patch) : WidgetValidators.playingPatch(patch)
  const renamedOnto = clean.label ?? label
  if (renamedOnto !== label && labelTaken(quiz, renamedOnto)) { return quiz }
  const revised = WidgetValidators.widget({ ...held, ...clean })
  return {
    ...quiz,
    widgets: quiz.widgets.map((widget) => (widget.label === label ? revised : widget)),
    columns: quiz.columns.map((column) => (column.source === label ? { ...column, source: renamedOnto } : column)),
  }
}

/**
 * `quiz` with the column labelled `label` revised. A rename onto a sibling's label, or a source
 * the quiz cannot show, is refused; a rename carries the sort memory with it.
 */
function reviseColumn(quiz: QuizT, label: string, patch: ColumnPatch): QuizT {
  const renamedOnto = patch.label ?? label
  const clash = renamedOnto !== label && quiz.columns.some((other) => other.label === renamedOnto)
  const unshowable = patch.source !== undefined && ! showable(quiz, patch.source)
  if (clash || unshowable || quiz.columns.every((column) => column.label !== label)) { return quiz }
  return {
    ...quiz,
    columns:      quiz.columns.map((column) => (column.label === label ? { ...column, ...patch } : column)),
    last_sortkey: quiz.last_sortkey === sortkeyOf({ label }) ? sortkeyOf({ label: renamedOnto }) : quiz.last_sortkey,
  }
}

