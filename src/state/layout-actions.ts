import type { Db } from 'jazz-tools'
import { app, type ColumnRow, type WidgetRow } from '../db/schema'
import { ColumnValidators, sortkeyOf, sourceOf, type ColumnDNA, type ColumnPatch } from '../models/column'
import { ExpressionValidators, keyOf, type ExpressionDNA, type ExpressionPatch } from '../models/expression'
import { QuestionWidgetLabel, WidgetValidators, type ExpressingPatch, type PlayingPatch, type WidgetDNA, type WidgetT } from '../models/widget'
import { loadWorkspaceRows, type QuizRows } from './quiz-rows'
import { repositioned, transact, updateColumn, updateExpression, updateQuiz, updateWidget, type Tx } from './quiz-writing'
import { reviseOpenQuiz, type OpenQuiz } from './quiz-actions'
import type { LayoutAction } from './layout-reducer'

/** Whether a widget of the quiz already has this label, or it is the questions' own */
function labelTaken(rows: QuizRows, label: string): boolean {
  return label === QuestionWidgetLabel || rows.widgets.some((widget) => widget.label === label)
}

/** Whether `source` names something the quiz can show */
function showable(rows: QuizRows, source: string): boolean {
  const named = sourceOf(source)
  return named.kind !== 'widget' || rows.widgets.some((widget) => widget.label === named.label)
}

/** `items` with the one labelled `label` lifted out and dropped at `onto_idx` */
function movedTo<RT extends { label: string }>(items: readonly RT[], label: string, onto_idx: number): RT[] {
  const from_idx = items.findIndex((item) => item.label === label)
  if (from_idx === -1) { return [...items] }
  const lifted = [...items]
  const [moved] = lifted.splice(from_idx, 1)
  if (moved) { lifted.splice(Math.max(0, Math.min(onto_idx, lifted.length)), 0, moved) }
  return lifted
}

/** The row fields of `widget`, the other kind's left null */
function widgetFields(widget: WidgetT) {
  return {
    label:            widget.label,
    kind:             widget.kind,
    expression_label: widget.kind === 'expressing' ? widget.expression_label : null,
    player_label:     widget.kind === 'playing' ? widget.player_label : null,
    textkind:         widget.kind === 'playing' ? widget.textkind : null,
    description:      widget.description,
  }
}

/** Put a widget at the end of the open quiz's widgets. A label a sibling has, or the questions' own, is refused. */
export async function addWidget(db: Db, open: OpenQuiz, dna: WidgetDNA): Promise<void> {
  const widget = WidgetValidators.widget(dna)
  await reviseOpenQuiz(db, open, (tx, rows) => {
    if (labelTaken(rows, widget.label)) { return }
    tx.insert(app.widgets, WidgetValidators.row({ ...widgetFields(widget), quiz_id: rows.quiz.id, position: rows.widgets.length }))
  })
}

/**
 * Revise a widget of the open quiz, its patch validated for the kind of widget it is. A rename
 * onto a label a sibling has is refused, and carries the columns that show the widget with it.
 */
export async function editWidget(db: Db, open: OpenQuiz, label: string, patch: ExpressingPatch | PlayingPatch): Promise<void> {
  await reviseOpenQuiz(db, open, (tx, rows) => {
    const held = rows.widgets.find((widget) => widget.label === label)
    if (! held) { return }
    const clean = held.kind === 'expressing' ? WidgetValidators.expressingPatch(patch) : WidgetValidators.playingPatch(patch)
    const renamedOnto = clean.label ?? label
    if (renamedOnto !== label && labelTaken(rows, renamedOnto)) { return }
    updateWidget(tx, held, { ...clean })
    for (const column of rows.columns) {
      if (column.source === label) { updateColumn(tx, column, { source: renamedOnto }) }
    }
  })
}

/**
 * The open quiz's columns that `doomed` picks, deleted, and a sort memory that named one of them
 * forgotten.
 */
function deleteColumns(tx: Tx, rows: QuizRows, doomed: (column: ColumnRow) => boolean): void {
  const gone = rows.columns.filter((column) => doomed(column))
  for (const column of gone) { tx.delete(app.columns, column.id) }
  if (gone.some((column) => sortkeyOf(column) === rows.quiz.last_sortkey)) { updateQuiz(tx, rows.quiz, { last_sortkey: null }) }
}

/** Delete a widget of the open quiz, and the columns that showed it: a column with nothing to show is not a column */
export async function deleteWidget(db: Db, open: OpenQuiz, label: string): Promise<void> {
  await reviseOpenQuiz(db, open, (tx, rows) => {
    const held = rows.widgets.find((widget) => widget.label === label)
    if (! held) { return }
    tx.delete(app.widgets, held.id)
    deleteColumns(tx, rows, (column) => column.source === label)
  })
}

/** Move a widget of the open quiz to `onto_idx` among its siblings */
export async function moveWidget(db: Db, open: OpenQuiz, label: string, onto_idx: number): Promise<void> {
  await reviseOpenQuiz(db, open, (tx, rows) => {
    repositioned(movedTo(rows.widgets, label, onto_idx), (row: WidgetRow, position) => { updateWidget(tx, row, { position }) })
  })
}

/**
 * Put a column into the open quiz at `onto_idx`, or at the end. A label a sibling has, or a
 * source the quiz cannot show, is refused.
 */
export async function addColumn(db: Db, open: OpenQuiz, dna: ColumnDNA, onto_idx?: number): Promise<void> {
  const column = ColumnValidators.column(dna)
  await reviseOpenQuiz(db, open, (tx, rows) => {
    if (rows.columns.some((other) => other.label === column.label) || ! showable(rows, column.source)) { return }
    const at = onto_idx === undefined ? rows.columns.length : Math.max(0, Math.min(onto_idx, rows.columns.length))
    for (const [idx, held] of rows.columns.entries()) {
      const position = idx < at ? idx : idx + 1
      if (held.position !== position) { updateColumn(tx, held, { position }) }
    }
    tx.insert(app.columns, ColumnValidators.row({ ...column, quiz_id: rows.quiz.id, position: at }))
  })
}

/**
 * Revise a column of the open quiz. A rename onto a sibling's label, or a source the quiz cannot
 * show, is refused; a rename carries the sort memory with it.
 */
export async function editColumn(db: Db, open: OpenQuiz, label: string, patch: ColumnPatch): Promise<void> {
  const clean = ColumnValidators.columnPatch(patch)
  await reviseOpenQuiz(db, open, (tx, rows) => {
    const held = rows.columns.find((column) => column.label === label)
    const renamedOnto = clean.label ?? label
    const clash = renamedOnto !== label && rows.columns.some((other) => other.label === renamedOnto)
    const unshowable = clean.source !== undefined && ! showable(rows, clean.source)
    if (! held || clash || unshowable) { return }
    updateColumn(tx, held, { ...clean })
    if (rows.quiz.last_sortkey === sortkeyOf({ label })) { updateQuiz(tx, rows.quiz, { last_sortkey: sortkeyOf({ label: renamedOnto }) }) }
  })
}

/** Delete a column of the open quiz, forgetting a sort memory that named it */
export async function deleteColumn(db: Db, open: OpenQuiz, label: string): Promise<void> {
  await reviseOpenQuiz(db, open, (tx, rows) => { deleteColumns(tx, rows, (column) => column.label === label) })
}

/** Move a column of the open quiz to `onto_idx` among its siblings */
export async function moveColumn(db: Db, open: OpenQuiz, label: string, onto_idx: number): Promise<void> {
  await reviseOpenQuiz(db, open, (tx, rows) => {
    repositioned(movedTo(rows.columns, label, onto_idx), (row: ColumnRow, position) => { updateColumn(tx, row, { position }) })
  })
}

// The expressions belong to the workspace rather than to a quiz, so a locked quiz refuses none of
// them: a column's numbers change with its formula, but the quiz itself does not.

/** Add an expression to the end of the workspace's. One whose owner and label another has is refused. */
export async function addExpression(db: Db, open: OpenQuiz, dna: ExpressionDNA): Promise<void> {
  const expression = ExpressionValidators.expression(dna)
  const held = await loadWorkspaceRows(db, open.workspace_id)
  if (! held || held.expressions.some((other) => keyOf(other) === keyOf(expression))) { return }
  await transact(db, (tx) => {
    tx.insert(app.expressions, ExpressionValidators.row({ ...expression, workspace_id: held.workspace.id, position: held.expressions.length }))
  })
}

/** Revise the workspace's expression labelled `label` */
export async function editExpression(db: Db, open: OpenQuiz, label: string, patch: ExpressionPatch): Promise<void> {
  const clean = ExpressionValidators.expressionPatch(patch)
  const held = await loadWorkspaceRows(db, open.workspace_id)
  if (! held) { return }
  await transact(db, (tx) => {
    for (const expression of held.expressions) {
      if (expression.label === label) { updateExpression(tx, expression, { ...clean }) }
    }
  })
}

/**
 * How many widgets, across every quiz of the workspace, work the expression labelled `label`.
 *
 * @param db - The account's database.
 * @param workspace_id - Which workspace.
 * @param label - An expression's label.
 * @returns How many expressing widgets name it; an expression is only deletable at zero.
 *
 * @example await expressionUsage(db, workspace_id, 'clueing_full')  // => 1
 */
export async function expressionUsage(db: Db, workspace_id: string, label: string): Promise<number> {
  const held = await loadWorkspaceRows(db, workspace_id)
  const quiz_ids = held?.quizzes.map((quiz) => quiz.id) ?? []
  if (quiz_ids.length === 0) { return 0 }
  const using = await db.all(app.widgets.where({ quiz_id: { in: quiz_ids }, kind: 'expressing', expression_label: label }), { tier: 'local-first' })
  return using.length
}

/** Delete the workspace's expression labelled `label`. Refused while a widget works it: that widget would have nothing to show. */
export async function deleteExpression(db: Db, open: OpenQuiz, label: string): Promise<void> {
  if (await expressionUsage(db, open.workspace_id, label) > 0) { return }
  const held = await loadWorkspaceRows(db, open.workspace_id)
  if (! held) { return }
  await transact(db, (tx) => {
    for (const expression of held.expressions) {
      if (expression.label === label) { tx.delete(app.expressions, expression.id) }
    }
  })
}

/**
 * Carry out an action on the open quiz's widgets or columns, or on the workspace's expressions,
 * writing rows: the row-writing successor of `layoutReducer`. See `perform`.
 */
export async function performLayout(db: Db, open: OpenQuiz, action: LayoutAction): Promise<void> {
  switch (action.kind) {
  case 'add_widget':          { await addWidget(db, open, action.widget); return }
  case 'edit_widget':         { await editWidget(db, open, action.label, action.patch); return }
  case 'delete_widget':       { await deleteWidget(db, open, action.label); return }
  case 'move_widget':         { await moveWidget(db, open, action.label, action.onto_idx); return }
  case 'add_column':          { await addColumn(db, open, action.column, action.onto_idx); return }
  case 'edit_column':         { await editColumn(db, open, action.label, action.patch); return }
  case 'delete_column':       { await deleteColumn(db, open, action.label); return }
  case 'move_column':         { await moveColumn(db, open, action.label, action.onto_idx); return }
  case 'add_expression':      { await addExpression(db, open, action.expression); return }
  case 'edit_expression':     { await editExpression(db, open, action.label, action.patch); return }
  case 'delete_expression':   { await deleteExpression(db, open, action.label) }
  }
}
