import * as PA from '../../src/lib/vv/patterns'
import { refuse } from '../../src/lib/refusals'
import type { Doc } from '../_generated/dataModel'
import { templateableOf, widgetFrom, widgetingFrom, type LayoutRows } from '../../src/lib/rows'
import { widgetingRemovalRefusal } from '../../src/lib/columns'
import { Quiz, isTemplatableField } from '../../src/models/quiz'
import { ColumnValidators, plainOf, refOf, sortkeyOf, widgetingSourceOf, type ColumnPatch, type ColumnT } from '../../src/models/column'
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
 * Refuse a column `source` that names nothing the quiz can show: a widgeting it does not have at
 * the tier the source names (`<label>` for each question, `quiz.<label>` for the whole quiz). A
 * word of the bag, which a quiz from before October 2026 may also hold a widgeting under, is
 * always showable.
 */
function refuseUnshowable(rows: LayoutRows, source: string): void {
  const ref = refOf(source)
  if (ref.kind !== 'widgeting') { return }
  const widgeting = rows.widgetings.find((each) => each.label === ref.label)
  if (! widgeting) { refuse('sourceUnshowable') }
  if (tierOf(widgeting) !== ref.tier) { refuse('wrongTier') }
}

/**
 * Put a widgeting at the end of the open quiz's run order, whichever tier it runs at, so it reads
 * every widgeting before it. A label a sibling has (or, for one for the whole quiz, the quiz
 * itself answers to), a widget the library does not hold or that cannot run at its tier
 * (`Widgeting.runsAt`), or one widgeting more than a quiz may hold, is refused.
 */
export async function addWidgeting(db: Writer, open: OpenQuizT, widgeting: WidgetingT): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    if (labelTaken(rows, widgeting.label)) { refuse('labelTaken') }
    refuseQuizReserved(widgeting.tier, widgeting.label)
    if (rows.widgetings.length >= PA.WidgetingsPerQuiz.max) { refuse('widgetingsFull') }
    const row = await widgetForLabel(db, widgeting.widget_label)
    if (! row) { refuse('widgetGone') }
    if (! Widgeting.runsAt(widgetFrom(row), widgeting.tier)) { refuse('tierUnoffered') }
    await db.insert('widgetings', WidgetingValidators.row({ ...widgeting, hunt_id: open.hunt_id, quiz_id: rows.quiz._id, position: rows.widgetings.length }))
  })
}

/**
 * Revise a widgeting of the open quiz. A rename onto a label a sibling has is refused, and
 * carries the columns that show the widgeting with it, and its place among the sources the quiz
 * nominates as templateable; what it stored stays with it.
 */
export async function editWidgeting(db: Writer, open: OpenQuizT, label: string, patch: WidgetingPatch): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    const held = widgetingIn(rows, label)
    const renamedOnto = patch.label ?? label
    if (renamedOnto !== label && labelTaken(rows, renamedOnto)) { refuse('labelTaken') }
    refuseQuizReserved(tierOf(held), renamedOnto)
    await updateWidgeting(db, held, { ...patch })
    if (renamedOnto === label) { return }
    for (const column of rows.columns) {
      const ref = refOf(column.source)
      if (ref.kind === 'widgeting' && ref.label === label) { await updateColumn(db, column, { ...plainOf(column), source: widgetingSourceOf(renamedOnto, ref.tier) }) }
    }
    const templateable = templateableOf(rows.quiz)
    if (templateable.includes(label)) {
      await updateQuiz(db, rows.quiz, { templateable: templateable.map((source) => (source === label ? renamedOnto : source)) })
    }
  })
}

/**
 * Nominate the sources the open quiz holds templateable, replacing those it did: its questions'
 * own fields and its widgetings, each named as a column's ref names it. A widgeting the quiz does
 * not have is refused, and so is one run once for the whole quiz, which has no question's cell to
 * fill.
 */
export async function setTemplateable(db: Writer, open: OpenQuizT, templateable: readonly string[]): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    const held = new Set(rows.widgetings.map((widgeting) => widgeting.label))
    const quizWide = new Set(rows.widgetings.filter((widgeting) => tierOf(widgeting) === 'quiz').map((widgeting) => widgeting.label))
    const named = templateable.filter((source) => ! isTemplatableField(source))
    if (named.some((widgetingLabel) => ! held.has(widgetingLabel))) { refuse('untemplatable') }
    if (named.some((widgetingLabel) => quizWide.has(widgetingLabel))) { refuse('wrongTier') }
    await updateQuiz(db, rows.quiz, { templateable: [...templateable] })
  })
}

/**
 * Delete a widgeting of the open quiz and everything it stored, refusing while a column shows it,
 * whole or a part of it (`widgetingRemovalRefusal`, the sentence naming the columns): a widgeting
 * goes only once nothing shows it, and the author removes the columns first. A formula or template
 * naming it does not hold it back, and reads nothing afterwards. It leaves the sources the quiz
 * templates; the widget it worked stays in the library.
 */
export async function deleteWidgeting(db: Writer, open: OpenQuizT, label: string): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    const held = rows.widgetings.find((widgeting) => widgeting.label === label)
    if (! held) { return }
    const refusal = widgetingRemovalRefusal({ columns: rows.columns, widgetings: rows.widgetings.map((row) => widgetingFrom(row)) }, label)
    if (refusal !== null) { refuse('widgetingShown', refusal) }
    await deleteWidgetingRows(db, held._id)
    const templateable = templateableOf(rows.quiz)
    if (templateable.includes(label)) { await updateQuiz(db, rows.quiz, { templateable: templateable.filter((source) => source !== label) }) }
    await writeRunOrder(db, rows.widgetings.filter((widgeting) => widgeting._id !== held._id))
  })
}

/**
 * Move a widgeting of the open quiz to `onto_idx` of its run order: the one list of its
 * widgetings, both tiers, as the gear lists them.
 */
export async function moveWidgeting(db: Writer, open: OpenQuizT, label: string, onto_idx: number): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    widgetingIn(rows, label)
    await writeRunOrder(db, movedTo(rows.widgetings, label, onto_idx))
  })
}

/**
 * Put a column into the open quiz at `onto_idx`, or at the end. A label a sibling has, a source
 * the quiz cannot show, or one column more than a quiz may hold, is refused.
 */
export async function addColumn(db: Writer, open: OpenQuizT, column: ColumnT, onto_idx?: number): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    if (rows.columns.some((other) => other.label === column.label)) { refuse('labelTaken') }
    refuseUnshowable(rows, column.source)
    if (rows.columns.length >= PA.ColumnsPerQuiz.max) { refuse('columnsFull') }
    const at = onto_idx === undefined ? rows.columns.length : Math.max(0, Math.min(onto_idx, rows.columns.length))
    for (const [idx, held] of rows.columns.entries()) {
      const position = idx < at ? idx : idx + 1
      if (held.position !== position) { await updateColumn(db, held, { position }) }
    }
    await db.insert('columns', ColumnValidators.row({ ...column, ...plainOf(column), hunt_id: open.hunt_id, quiz_id: rows.quiz._id, position: at }))
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
    if (patch.source !== undefined) { refuseUnshowable(rows, patch.source) }
    await updateColumn(db, held, { ...patch })
    if (rows.quiz.last_sortkey === sortkeyOf({ label })) { await updateQuiz(db, rows.quiz, { last_sortkey: sortkeyOf({ label: renamedOnto }) }) }
  })
}

/** Delete a column of the open quiz, forgetting a sort memory that named it; nothing for a column already gone */
export async function deleteColumn(db: Writer, open: OpenQuizT, label: string): Promise<void> {
  await reviseOpenLayout(db, open, async (rows) => {
    const held = rows.columns.find((column) => column.label === label)
    if (! held) { return }
    await db.delete('columns', held._id)
    if (sortkeyOf(held) === rows.quiz.last_sortkey) { await updateQuiz(db, rows.quiz, { last_sortkey: null }) }
  })
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
  case 'set_templateable':    { await setTemplateable(db, open, action.templateable) }
  }
}
