import * as PA from '../../src/lib/vv/patterns'
import { refuse } from '../../src/lib/refusals'
import type { Doc } from '../_generated/dataModel'
import type { LayoutRows } from '../../src/lib/rows'
import { ColumnValidators, sortkeyOf, sourceOf, type ColumnPatch, type ColumnT } from '../../src/models/column'
import { WidgetingValidators, type WidgetingPatch, type WidgetingT } from '../../src/models/widgeting'
import type { LayoutActionT } from '../../src/models/actions'
import { widgetForLabel } from '../reading'
import { deleteWidgeting as deleteWidgetingRows, movedTo, repositioned, updateColumn, updateQuiz, updateWidgeting, type OpenQuizT, type Writer } from './quiz_writing'
import { reviseOpenLayout } from './quiz_actions'

/** The widgeting of the quiz labelled `label`, refusing when there is none */
function widgetingIn(rows: LayoutRows, label: string): Doc<'widgetings'> {
  const held = rows.widgetings.find((widgeting) => widgeting.label === label)
  if (! held) { refuse('widgetingGone') }
  return held
}

/** The column of the quiz labelled `label`, refusing when there is none */
function columnIn(rows: LayoutRows, label: string): Doc<'columns'> {
  const held = rows.columns.find((column) => column.label === label)
  if (! held) { refuse('columnGone') }
  return held
}

/** Whether a widgeting of the quiz already has this label */
function labelTaken(rows: LayoutRows, label: string): boolean {
  return rows.widgetings.some((widgeting) => widgeting.label === label)
}

/** Whether `source` names something the quiz can show */
function showable(rows: LayoutRows, source: string): boolean {
  const named = sourceOf(source)
  return named.kind !== 'widgeting' || rows.widgetings.some((widgeting) => widgeting.label === named.label)
}

/**
 * Put a widgeting at the end of the open quiz's run order. A label a sibling has, a widget the
 * library does not hold, or one widgeting more than a quiz may hold, is refused.
 */
export async function addWidgeting(db: Writer, open: OpenQuizT, widgeting: WidgetingT): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    if (labelTaken(rows, widgeting.label)) { refuse('labelTaken') }
    if (rows.widgetings.length >= PA.WidgetingsPerQuiz.max) { refuse('widgetingsFull') }
    if (! await widgetForLabel(db, widgeting.widget_label)) { refuse('widgetGone') }
    await db.insert('widgetings', WidgetingValidators.row({ ...widgeting, hunt_id: open.hunt_id, quiz_id: rows.quiz._id, position: rows.widgetings.length }))
  })
}

/**
 * Revise a widgeting of the open quiz. A rename onto a label a sibling has is refused, and
 * carries the columns that show the widgeting with it; what it stored stays with it.
 */
export async function editWidgeting(db: Writer, open: OpenQuizT, label: string, patch: WidgetingPatch): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    const held = widgetingIn(rows, label)
    const renamedOnto = patch.label ?? label
    if (renamedOnto !== label && labelTaken(rows, renamedOnto)) { refuse('labelTaken') }
    await updateWidgeting(db, held, { ...patch })
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

/**
 * Delete a widgeting of the open quiz, everything it stored, and the columns that showed it: a
 * column with nothing to show is not a column. The widget it worked stays in the library.
 */
export async function deleteWidgeting(db: Writer, open: OpenQuizT, label: string): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    const held = rows.widgetings.find((widgeting) => widgeting.label === label)
    if (! held) { return }
    await deleteWidgetingRows(db, held._id)
    await deleteColumns(db, rows, (column) => column.source === label)
    await repositioned(rows.widgetings.filter((widgeting) => widgeting._id !== held._id), async (row, position) => { await updateWidgeting(db, row, { position }) })
  })
}

/** Move a widgeting of the open quiz to `onto_idx` in its run order */
export async function moveWidgeting(db: Writer, open: OpenQuizT, label: string, onto_idx: number): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    widgetingIn(rows, label)
    await repositioned(movedTo(rows.widgetings, label, onto_idx), async (row, position) => { await updateWidgeting(db, row, { position }) })
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
    await db.insert('columns', ColumnValidators.row({ ...column, hunt_id: open.hunt_id, quiz_id: rows.quiz._id, position: at }))
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

/** Carry out an action on the open quiz's widgetings or columns, writing the rows it comes to. See `perform`. */
export async function performLayout(db: Writer, open: OpenQuizT, action: LayoutActionT): Promise<void> {
  switch (action.kind) {
  case 'add_widgeting':       { await addWidgeting(db, open, action.widgeting); return }
  case 'edit_widgeting':      { await editWidgeting(db, open, action.label, action.patch); return }
  case 'delete_widgeting':    { await deleteWidgeting(db, open, action.label); return }
  case 'move_widgeting':      { await moveWidgeting(db, open, action.label, action.onto_idx); return }
  case 'add_column':          { await addColumn(db, open, action.column, action.onto_idx); return }
  case 'edit_column':         { await editColumn(db, open, action.label, action.patch); return }
  case 'delete_column':       { await deleteColumn(db, open, action.label); return }
  case 'move_column':         { await moveColumn(db, open, action.label, action.onto_idx) }
  }
}
