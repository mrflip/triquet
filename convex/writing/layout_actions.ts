import * as PA from '../../src/lib/vv/patterns'
import { refuse } from '../../src/lib/refusals'
import type { Doc } from '../_generated/dataModel'
import { QuizFallbacks, widgetFrom, widgetingFrom, type LayoutRows } from '../../src/lib/rows'
import * as Estimates from '../../src/lib/estimates'
import * as RunOrder from '../../src/lib/run-order'
import { Quiz } from '../../src/models/quiz'
import { ColumnValidators, sortkeyOf, sourceOf, widgetingLabelOf, widgetingSourceOf, type ColumnPatch, type ColumnT } from '../../src/models/column'
import { Widgeting, WidgetingValidators, type WidgetingPatch, type WidgetingT, type WidgetingTier } from '../../src/models/widgeting'
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

/** Which level a widgeting's row runs at; one written before widgetings had tiers runs for each question */
function tierOf(row: Doc<'widgetings'>): WidgetingTier {
  return widgetingFrom(row).tier
}

/** Refuse a label a widgeting at `tier` cannot take beside the quiz's own fields: one the quiz answers to in the bag, for a widgeting run once for the whole quiz */
function refuseQuizReserved(tier: WidgetingTier, label: string): void {
  if (tier === 'quiz' && ! Quiz.mayLabelQuizTier(label)) { refuse('labelTaken') }
}

/** Write each of `ordered`'s positions as its place in the list, where it has moved */
async function writeRunOrder(db: Writer, ordered: readonly Doc<'widgetings'>[]): Promise<void> {
  await repositioned(ordered, async (row, position) => { await updateWidgeting(db, row, { position }) })
}

/**
 * Refuse a column `source` that names nothing the quiz can show: a widgeting it does not have, or
 * runs once for the whole quiz (with no cell for any question), or a part of a widgeting whose
 * widget offers none.
 */
async function refuseUnshowable(db: Writer, rows: LayoutRows, source: string): Promise<void> {
  const named = sourceOf(source)
  if (named.kind !== 'widgeting') { return }
  const widgeting = rows.widgetings.find((each) => each.label === named.label)
  if (! widgeting) { refuse('sourceUnshowable') }
  if (tierOf(widgeting) !== 'question') { refuse('wrongTier') }
  if (named.part !== null && ! Estimates.isEstimating(await widgetForLabel(db, widgeting.widget_label))) { refuse('partUnoffered') }
}

/**
 * Put a widgeting into the open quiz's run order (`RunOrder.withAdded`): one for each question at
 * the end of the question widgetings; an entry for the whole quiz just above the questions pivot,
 * where every formula can read it; any other for the whole quiz at the very end. A label a sibling
 * has (or, for one for the whole quiz, the quiz itself answers to), a widget the library does not
 * hold or that cannot run at its tier (`Widgeting.runsAt`), or one widgeting more than a quiz may
 * hold, is refused.
 */
export async function addWidgeting(db: Writer, open: OpenQuizT, widgeting: WidgetingT): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    if (labelTaken(rows, widgeting.label)) { refuse('labelTaken') }
    refuseQuizReserved(widgeting.tier, widgeting.label)
    if (rows.widgetings.length >= PA.WidgetingsPerQuiz.max) { refuse('widgetingsFull') }
    const row = await widgetForLabel(db, widgeting.widget_label)
    if (! row) { refuse('widgetGone') }
    const widget = widgetFrom(row)
    if (! Widgeting.runsAt(widget, widgeting.tier)) { refuse('tierUnoffered') }
    const placed = RunOrder.withAdded<Doc<'widgetings'> | WidgetingT>(rows.widgetings, widgeting, widget.formulary !== 'entry', (item) => ('_id' in item ? tierOf(item) : item.tier))
    const position = placed.indexOf(widgeting)
    for (const [idx, item] of placed.entries()) {
      if ('_id' in item && item.position !== idx) { await updateWidgeting(db, item, { position: idx }) }
    }
    await db.insert('widgetings', WidgetingValidators.row({ ...widgeting, hunt_id: open.hunt_id, quiz_id: rows.quiz._id, position }))
  })
}

/**
 * Revise a widgeting of the open quiz. A rename onto a label a sibling has is refused, and
 * carries the columns that show the widgeting, whole or a part of it, with it, and its place
 * among the sources the quiz templates; what it stored stays with it.
 */
export async function editWidgeting(db: Writer, open: OpenQuizT, label: string, patch: WidgetingPatch): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    const held = widgetingIn(rows, label)
    const renamedOnto = patch.label ?? label
    if (renamedOnto !== label && labelTaken(rows, renamedOnto)) { refuse('labelTaken') }
    refuseQuizReserved(tierOf(held), renamedOnto)
    await updateWidgeting(db, held, { ...patch })
    for (const column of rows.columns) {
      const named = sourceOf(column.source)
      if (named.kind === 'widgeting' && named.label === label) { await updateColumn(db, column, { source: widgetingSourceOf(renamedOnto, named.part) }) }
    }
    const templated = templatedOf(rows)
    if (renamedOnto !== label && templated.includes(label)) {
      await updateQuiz(db, rows.quiz, { templated: templated.map((source) => (source === label ? renamedOnto : source)) })
    }
  })
}

/** The sources the open quiz templates, one written before it had any templating none */
function templatedOf(rows: LayoutRows): string[] {
  return rows.quiz.templated ?? QuizFallbacks.templated
}

/**
 * Nominate the sources the open quiz templates, replacing those it did: its questions' own fields
 * and its widgetings, each named as a column names what it shows. A widgeting the quiz does not
 * have is refused, and so is one run once for the whole quiz, which has no question's cell to fill.
 */
export async function setTemplated(db: Writer, open: OpenQuizT, templated: readonly string[]): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    const held = new Set(rows.widgetings.map((widgeting) => widgeting.label))
    const quizWide = new Set(rows.widgetings.filter((widgeting) => tierOf(widgeting) === 'quiz').map((widgeting) => widgeting.label))
    const named = templated.flatMap((source) => widgetingLabelOf(source) ?? [])
    if (named.some((widgetingLabel) => ! held.has(widgetingLabel))) { refuse('untemplatable') }
    if (named.some((widgetingLabel) => quizWide.has(widgetingLabel))) { refuse('wrongTier') }
    await updateQuiz(db, rows.quiz, { templated: [...templated] })
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
 * column with nothing to show is not a column. It leaves the sources the quiz templates too. The
 * widget it worked stays in the library.
 */
export async function deleteWidgeting(db: Writer, open: OpenQuizT, label: string): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    const held = rows.widgetings.find((widgeting) => widgeting.label === label)
    if (! held) { return }
    await deleteWidgetingRows(db, held._id)
    await deleteColumns(db, rows, (column) => widgetingLabelOf(column.source) === label)
    const templated = templatedOf(rows)
    if (templated.includes(label)) { await updateQuiz(db, rows.quiz, { templated: templated.filter((source) => source !== label) }) }
    await writeRunOrder(db, RunOrder.runOrderOf(rows.widgetings.filter((widgeting) => widgeting._id !== held._id), tierOf))
  })
}

/**
 * Move a widgeting of the open quiz to `onto_idx` of its own tier's list, as the gear lists it
 * (`RunOrder.movedWithin`): among the question widgetings, for one that runs for each question;
 * among the quiz's own widgetings and the questions pivot, for one that runs once for the whole
 * quiz, which a drop across the pivot runs before the question widgetings or after them.
 */
export async function moveWidgeting(db: Writer, open: OpenQuizT, label: string, onto_idx: number): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    widgetingIn(rows, label)
    await writeRunOrder(db, RunOrder.movedWithin(rows.widgetings, label, onto_idx, tierOf))
  })
}

/**
 * Put a column into the open quiz at `onto_idx`, or at the end. A label a sibling has, a source
 * the quiz cannot show, or one column more than a quiz may hold, is refused.
 */
export async function addColumn(db: Writer, open: OpenQuizT, column: ColumnT, onto_idx?: number): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    if (rows.columns.some((other) => other.label === column.label)) { refuse('labelTaken') }
    await refuseUnshowable(db, rows, column.source)
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
    if (patch.source !== undefined) { await refuseUnshowable(db, rows, patch.source) }
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
  case 'move_column':         { await moveColumn(db, open, action.label, action.onto_idx); return }
  case 'set_templated':       { await setTemplated(db, open, action.templated) }
  }
}
