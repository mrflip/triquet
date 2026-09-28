import * as PA from '../../src/lib/vv/patterns'
import { refuse } from '../../src/lib/refusals'
import type { Doc } from '../_generated/dataModel'
import type { LayoutRows } from '../../src/lib/rows'
import { ColumnValidators, sortkeyOf, sourceOf, type ColumnPatch, type ColumnT } from '../../src/models/column'
import { ExpressionValidators, keyOf, type ExpressionPatch, type ExpressionT } from '../../src/models/expression'
import { QuestionWidgetLabel, WidgetValidators, type BottingPatch, type ExpressingPatch, type WidgetT } from '../../src/models/widget'
import type { LayoutActionT, OpenQuizT } from '../../src/models/actions'
import { expressionUsageOf, expressionsOf, realmsOf } from '../reading'
import { repositioned, updateColumn, updateExpression, updateQuiz, updateWidget, type Writer } from './quiz_writing'
import { reviseOpenLayout } from './quiz_actions'

/** A widget's patch as an action carries it: the fields of either kind, checked against the widget it revises */
export type WidgetPatchDNA = ExpressingPatch & BottingPatch

/** The widget of the quiz labelled `label`, refusing when there is none */
function widgetIn(rows: LayoutRows, label: string): Doc<'widgets'> {
  const held = rows.widgets.find((widget) => widget.label === label)
  if (! held) { refuse('widgetGone') }
  return held
}

/** The column of the quiz labelled `label`, refusing when there is none */
function columnIn(rows: LayoutRows, label: string): Doc<'columns'> {
  const held = rows.columns.find((column) => column.label === label)
  if (! held) { refuse('columnGone') }
  return held
}

/** Whether a widget of the quiz already has this label, or it is the questions' own */
function labelTaken(rows: LayoutRows, label: string): boolean {
  return label === QuestionWidgetLabel || rows.widgets.some((widget) => widget.label === label)
}

/** Whether `source` names something the quiz can show */
function showable(rows: LayoutRows, source: string): boolean {
  const named = sourceOf(source)
  return named.kind !== 'widget' || rows.widgets.some((widget) => widget.label === named.label)
}

/** `items` with the one labelled `label` lifted out and dropped at `onto_idx`; `label` names one of them */
function movedTo<RT extends { label: string }>(items: readonly RT[], label: string, onto_idx: number): RT[] {
  const fromIdx = items.findIndex((item) => item.label === label)
  const lifted = [...items]
  const [moved] = lifted.splice(fromIdx, 1)
  if (moved) { lifted.splice(Math.max(0, Math.min(onto_idx, lifted.length)), 0, moved) }
  return lifted
}

/**
 * Put a widget at the end of the open quiz's widgets. A label a sibling has, or the questions'
 * own, is refused, as is one widget more than a quiz may hold.
 */
export async function addWidget(db: Writer, open: OpenQuizT, widget: WidgetT): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    if (labelTaken(rows, widget.label)) { refuse('labelTaken') }
    if (rows.widgets.length >= PA.WidgetsPerQuiz.max) { refuse('widgetsFull') }
    await db.insert('widgets', WidgetValidators.row({ ...widget, quiz_id: rows.quiz._id, position: rows.widgets.length }))
  })
}

/**
 * Revise a widget of the open quiz, its patch validated for the kind of widget it is. A rename
 * onto a label a sibling has is refused, and carries the columns that show the widget with it.
 *
 * @throws When the patch is not valid for the widget's kind; nothing is written.
 */
export async function editWidget(db: Writer, open: OpenQuizT, label: string, patch: WidgetPatchDNA): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    const held = widgetIn(rows, label)
    const clean = held.kind === 'expressing' ? WidgetValidators.expressingPatch(patch) : WidgetValidators.bottingPatch(patch)
    const renamedOnto = clean.label ?? label
    if (renamedOnto !== label && labelTaken(rows, renamedOnto)) { refuse('labelTaken') }
    await updateWidget(db, held, { ...clean })
    for (const column of rows.columns) {
      if (column.source === label) { await updateColumn(db, column, { source: renamedOnto }) }
    }
  })
}

/**
 * The open quiz's columns that `doomed` picks, deleted, and a sort memory that named one of them
 * forgotten.
 */
async function deleteColumns(db: Writer, rows: LayoutRows, doomed: (column: Doc<'columns'>) => boolean): Promise<void> {
  const gone = rows.columns.filter((column) => doomed(column))
  for (const column of gone) { await db.delete('columns', column._id) }
  if (gone.some((column) => sortkeyOf(column) === rows.quiz.last_sortkey)) { await updateQuiz(db, rows.quiz, { last_sortkey: null }) }
}

/** Delete a widget of the open quiz, and the columns that showed it: a column with nothing to show is not a column */
export async function deleteWidget(db: Writer, open: OpenQuizT, label: string): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    const held = rows.widgets.find((widget) => widget.label === label)
    if (! held) { return }
    await db.delete('widgets', held._id)
    await deleteColumns(db, rows, (column) => column.source === label)
  })
}

/** Move a widget of the open quiz to `onto_idx` among its siblings */
export async function moveWidget(db: Writer, open: OpenQuizT, label: string, onto_idx: number): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    widgetIn(rows, label)
    await repositioned(movedTo(rows.widgets, label, onto_idx), async (row, position) => { await updateWidget(db, row, { position }) })
  })
}

/**
 * Put a column into the open quiz at `onto_idx`, or at the end. A label a sibling has, a source
 * the quiz cannot show, or one column more than a quiz may hold, is refused.
 */
export async function addColumn(db: Writer, open: OpenQuizT, column: ColumnT, onto_idx?: number): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    if (rows.columns.some((other) => other.label === column.label)) { refuse('labelTaken') }
    if (! showable(rows, column.source)) { refuse('sourceUnshowable') }
    if (rows.columns.length >= PA.ColumnsPerQuiz.max) { refuse('columnsFull') }
    const at = onto_idx === undefined ? rows.columns.length : Math.max(0, Math.min(onto_idx, rows.columns.length))
    for (const [idx, held] of rows.columns.entries()) {
      const position = idx < at ? idx : idx + 1
      if (held.position !== position) { await updateColumn(db, held, { position }) }
    }
    await db.insert('columns', ColumnValidators.row({ ...column, quiz_id: rows.quiz._id, position: at }))
  })
}

/**
 * Revise a column of the open quiz. A rename onto a sibling's label, or a source the quiz cannot
 * show, is refused; a rename carries the sort memory with it.
 */
export async function editColumn(db: Writer, open: OpenQuizT, label: string, patch: ColumnPatch): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    const held = columnIn(rows, label)
    const renamedOnto = patch.label ?? label
    if (renamedOnto !== label && rows.columns.some((other) => other.label === renamedOnto)) { refuse('labelTaken') }
    if (patch.source !== undefined && ! showable(rows, patch.source)) { refuse('sourceUnshowable') }
    await updateColumn(db, held, { ...patch })
    if (rows.quiz.last_sortkey === sortkeyOf({ label })) { await updateQuiz(db, rows.quiz, { last_sortkey: sortkeyOf({ label: renamedOnto }) }) }
  })
}

/** Delete a column of the open quiz, forgetting a sort memory that named it */
export async function deleteColumn(db: Writer, open: OpenQuizT, label: string): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => { await deleteColumns(db, rows, (column) => column.label === label) })
}

/** Move a column of the open quiz to `onto_idx` among its siblings */
export async function moveColumn(db: Writer, open: OpenQuizT, label: string, onto_idx: number): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    columnIn(rows, label)
    await repositioned(movedTo(rows.columns, label, onto_idx), async (row, position) => { await updateColumn(db, row, { position }) })
  })
}

// The expressions belong to the hunt rather than to a quiz, so a locked quiz refuses none of
// them: a column's numbers change with its formula, but the quiz itself does not.

/**
 * Add an expression to the end of the hunt's. One whose owner and label another has is refused,
 * as is one expression more than a hunt may hold.
 */
export async function addExpression(db: Writer, open: OpenQuizT, expression: ExpressionT): Promise<void> {
  const [hunt, held] = await Promise.all([db.get('hunts', open.hunt_id), expressionsOf(db, open.hunt_id)])
  if (! hunt) { refuse('huntGone') }
  if (held.some((other) => keyOf(other) === keyOf(expression))) { refuse('labelTaken') }
  if (held.length >= PA.ExpressionsPerHunt.max) { refuse('expressionsFull') }
  await db.insert('expressions', ExpressionValidators.row({ ...expression, hunt_id: open.hunt_id, position: held.length }))
}

/** Revise the hunt's expression labelled `label`; refused when the hunt has none */
export async function editExpression(db: Writer, open: OpenQuizT, label: string, patch: ExpressionPatch): Promise<void> {
  const expressions = await expressionsOf(db, open.hunt_id)
  const labelled = expressions.filter((expression) => expression.label === label)
  if (labelled.length === 0) { refuse('expressionGone') }
  for (const expression of labelled) { await updateExpression(db, expression, { ...patch }) }
}

/** Delete the hunt's expression labelled `label`. Refused while a widget works it: that widget would have nothing to show. */
export async function deleteExpression(db: Writer, open: OpenQuizT, label: string): Promise<void> {
  const usage = await expressionUsageOf(db, await realmsOf(db, open.hunt_id))
  if ((usage.get(label) ?? 0) > 0) { refuse('expressionInUse') }
  const expressions = await expressionsOf(db, open.hunt_id)
  for (const expression of expressions) {
    if (expression.label === label) { await db.delete('expressions', expression._id) }
  }
}

/**
 * Carry out an action on the open quiz's widgets or columns, or on the hunt's expressions,
 * writing the rows it comes to. See `perform`.
 */
export async function performLayout(db: Writer, open: OpenQuizT, action: LayoutActionT): Promise<void> {
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
