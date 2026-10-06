import _ from 'es-toolkit/compat'
import type * as Z from 'zod'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import * as Labelmaker from '../../src/lib/labelmaker'
import type { AffirmsT } from '../../src/models/actions'
import { ColumnValidators } from '../../src/models/column'
import { DefaultBranch, HuntValidators } from '../../src/models/hunt'
import { defaultLayout, type Layout } from '../../src/models/layout'
import { Question, QuestionValidators } from '../../src/models/question'
import { BlankQuestionQty, Quiz, QuizValidators } from '../../src/models/quiz'
import { HomeRealmLabel, RealmValidators } from '../../src/models/realm'
import { ReviewValidators } from '../../src/models/review'
import { ReviewingValidators } from '../../src/models/reviewing'
import { refuse } from '../../src/lib/refusals'
import { Widget, WidgetValidators, type EntryValueT, type WidgetPatch, type WidgetT } from '../../src/models/widget'
import { WidgetedValidators, type WidgetedRecordT } from '../../src/models/widgeted'
import { WidgetingValidators } from '../../src/models/widgeting'
import { libraryOf } from '../reading'

/** What a mutation writes through */
export type Writer = MutationCtx['db']

/** Where a quiz belongs: its hunt, and the realm of it that holds the quiz */
export type QuizPlace = Pick<AffirmsT, 'hunt_id' | 'realm_id'>

/**
 * The quiz on the author's screen, where an action on "the quiz" lands, as `authorize` checked it:
 * its id and its realm's and hunt's, and its own row and its realm's as read in that check, each
 * null when it is gone.
 */
export type OpenQuizT = Pick<AffirmsT, 'hunt_id' | 'realm_id' | 'quiz_id'> & { quiz: Doc<'quizzes'> | null, realm: Doc<'realms'> | null }

/** Where a quiz's widgetings and columns belong: the quiz, and its hunt */
export type LayoutPlace = Pick<AffirmsT, 'hunt_id' | 'quiz_id'>

/** The question a stored cell is in, as far as its rows copy it: its id, its quiz and its hunt */
export type CellQuestion = Pick<Doc<'questions'>, '_id' | 'hunt_id' | 'quiz_id'>

/** The fields of a document the database owns */
const SystemFields = ['_id', '_creationTime'] as const

/** The fields of `fields` that differ from what `held` has, for an update that writes only what changed */
export function changedFields<RT extends object>(held: RT, fields: Partial<RT>): Partial<RT> {
  return _.pickBy(fields, (val, key) => ! _.isEqual(val, held[key as keyof RT])) as Partial<RT>
}

/** Every row of `ordered` whose position is not its place in the list, each handed to `write` with its place */
export async function repositioned<RT extends { position: number }>(ordered: readonly RT[], write: (row: RT, position: number) => Promise<void>): Promise<void> {
  for (const [position, row] of ordered.entries()) {
    if (row.position !== position) { await write(row, position) }
  }
}

/** `items` with the one labelled `label` lifted out and dropped at `onto_idx`; `label` names one of them */
export function movedTo<RT extends { label: string }>(items: readonly RT[], label: string, onto_idx: number): RT[] {
  const fromIdx = items.findIndex((item) => item.label === label)
  const lifted = [...items]
  const [moved] = lifted.splice(fromIdx, 1)
  if (moved) { lifted.splice(Math.max(0, Math.min(onto_idx, lifted.length)), 0, moved) }
  return lifted
}

// Each update below is held to its row validator whole, as the row would stand afterwards, and
// then writes only the fields that change; one that changes nothing writes nothing.

/** Revise a hunt's own row */
export async function updateHunt(db: Writer, held: Doc<'hunts'>, patch: Partial<Z.output<typeof HuntValidators.row>>): Promise<void> {
  const changed = changedFields(held, HuntValidators.row({ ..._.omit(held, SystemFields), ...patch }))
  if (! _.isEmpty(changed)) { await db.patch('hunts', held._id, changed) }
}

/** Revise a quiz's own row */
export async function updateQuiz(db: Writer, held: Doc<'quizzes'>, patch: Partial<Z.output<typeof QuizValidators.row>>): Promise<void> {
  const changed = changedFields(held, QuizValidators.row({ ..._.omit(held, SystemFields), ...patch }))
  if (! _.isEmpty(changed)) { await db.patch('quizzes', held._id, changed) }
}

/** Revise a question's row */
export async function updateQuestion(db: Writer, held: Doc<'questions'>, patch: Partial<Z.output<typeof QuestionValidators.row>>): Promise<void> {
  const changed = changedFields(held, QuestionValidators.row({ ..._.omit(held, SystemFields), ...patch }))
  if (! _.isEmpty(changed)) { await db.patch('questions', held._id, changed) }
}

/**
 * Revise a widget's row, keeping its formulary: the patch is held to its formulary's arm of the
 * row. An entry keeps its kind too, since the values typed into its cells hang on it.
 *
 * @throws A refusal (`entryKindFixed`), or a Zod error when the patch does not fit the widget's formulary; nothing is written.
 */
export async function updateWidget(db: Writer, held: Doc<'widgets'>, patch: WidgetPatch & { position?: number }): Promise<void> {
  // Parsed from the merge whole: which arm of the row it is held to is the held row's formulary.
  const revised = WidgetValidators.row.parse({ ..._.omit(held, SystemFields), ...patch })
  if (Widget.flavorOf(revised) !== Widget.flavorOf(held)) { refuse('entryKindFixed') }
  const changed = changedFields(held, revised)
  if (! _.isEmpty(changed)) { await db.patch('widgets', held._id, changed) }
}

/** Revise a widgeting's row */
export async function updateWidgeting(db: Writer, held: Doc<'widgetings'>, patch: Partial<Z.output<typeof WidgetingValidators.row>>): Promise<void> {
  const changed = changedFields(held, WidgetingValidators.row({ ..._.omit(held, SystemFields), ...patch }))
  if (! _.isEmpty(changed)) { await db.patch('widgetings', held._id, changed) }
}

/** Revise a column's row */
export async function updateColumn(db: Writer, held: Doc<'columns'>, patch: Partial<Z.output<typeof ColumnValidators.row>>): Promise<void> {
  const changed = changedFields(held, ColumnValidators.row({ ..._.omit(held, SystemFields), ...patch }))
  if (! _.isEmpty(changed)) { await db.patch('columns', held._id, changed) }
}

/** Revise a review's row */
export async function updateReview(db: Writer, held: Doc<'reviews'>, patch: Partial<Z.output<typeof ReviewValidators.row>>): Promise<void> {
  const changed = changedFields(held, ReviewValidators.row({ ..._.omit(held, SystemFields), ...patch }))
  if (! _.isEmpty(changed)) { await db.patch('reviews', held._id, changed) }
}

/** Revise a reviewing's row */
export async function updateReviewing(db: Writer, held: Doc<'reviewings'>, patch: Partial<Z.output<typeof ReviewingValidators.row>>): Promise<void> {
  const changed = changedFields(held, ReviewingValidators.row({ ..._.omit(held, SystemFields), ...patch }))
  if (! _.isEmpty(changed)) { await db.patch('reviewings', held._id, changed) }
}

/** Record what one widgeting came to for `question`, as the newest row in its cell */
export async function insertWidgeted(db: Writer, question: CellQuestion, widgeting_id: Id<'widgetings'>, widgeted: WidgetedRecordT): Promise<void> {
  const { status, value, message, result_meta } = widgeted
  const { _id: question_id, hunt_id, quiz_id } = question
  await db.insert('widgeteds', WidgetedValidators.row({ hunt_id, quiz_id, question_id, widgeting_id, status, value, message, result_meta }))
}

/**
 * Put `value` in one entry cell, as its one row: the row it holds revised, or one made; an
 * emptied cell (null) holds no row at all, and reads as `missing`. The cell's index makes it one
 * read. Should a cell somehow hold two rows, the newest is revised, as the newest is what it shows.
 *
 * @param db - The mutation's database.
 * @param question - The question the cell is in.
 * @param widgeting_id - The entry widgeting whose cell it is.
 * @param value - What was typed, already held to the widget's entry kind; null for nothing.
 * @throws A Zod error when the row it comes to is not valid; nothing is written.
 */
export async function upsertWidgeted(db: Writer, question: CellQuestion, widgeting_id: Id<'widgetings'>, value: EntryValueT | null): Promise<void> {
  const { _id: question_id, hunt_id, quiz_id } = question
  const held = await db.query('widgeteds')
    .withIndex('by_question_id_and_widgeting_id', (cvx) => cvx.eq('question_id', question_id).eq('widgeting_id', widgeting_id))
    .order('desc')
    .first()
  if (value === null) {
    if (held) { await db.delete('widgeteds', held._id) }
    return
  }
  const row = WidgetedValidators.row({ hunt_id, quiz_id, question_id, widgeting_id, status: 'ok', value, message: null, result_meta: {} })
  if (held) {
    await db.replace('widgeteds', held._id, row)
  } else {
    await db.insert('widgeteds', row)
  }
}

/** Delete a question, everything its widgetings stored for it, and every reviewer's verdict on it */
export async function deleteQuestion(db: Writer, question_id: Id<'questions'>): Promise<void> {
  const widgeteds = db.query('widgeteds').withIndex('by_question_id_and_widgeting_id', (cvx) => cvx.eq('question_id', question_id))
  for await (const widgeted of widgeteds) { await db.delete('widgeteds', widgeted._id) }
  const reviewings = db.query('reviewings').withIndex('by_question_id', (cvx) => cvx.eq('question_id', question_id))
  for await (const reviewing of reviewings) { await db.delete('reviewings', reviewing._id) }
  await db.delete('questions', question_id)
}

/** Delete a widgeting, and everything it stored */
export async function deleteWidgeting(db: Writer, widgeting_id: Id<'widgetings'>): Promise<void> {
  const widgeteds = db.query('widgeteds').withIndex('by_widgeting_id', (cvx) => cvx.eq('widgeting_id', widgeting_id))
  for await (const widgeted of widgeteds) { await db.delete('widgeteds', widgeted._id) }
  await db.delete('widgetings', widgeting_id)
}

/**
 * Put each of `widgets` whose label the library lacks at its end, in the order given, the first
 * of any label named twice; leave every widget the library holds as it is.
 *
 * @param db - The mutation's database.
 * @param widgets - The widgets wanted.
 * @returns The labels of the widgets added.
 * @throws When a row is not valid; the mutation writes nothing.
 */
export async function insertAbsentWidgets(db: Writer, widgets: readonly WidgetT[]): Promise<string[]> {
  const held = await libraryOf(db)
  const taken = new Set(held.map((widget) => widget.label))
  const absent = _.uniqBy(widgets, 'label').filter((widget) => ! taken.has(widget.label))
  for (const [idx, widget] of absent.entries()) {
    await db.insert('widgets', WidgetValidators.row({ ...widget, position: held.length + idx }))
  }
  return absent.map((widget) => widget.label)
}

/**
 * Insert a quiz's widgetings and columns, in the order given.
 *
 * @param db - The mutation's database.
 * @param place - The quiz they belong to, and its hunt.
 * @param layout - Its widgetings and columns.
 * @throws When a row is not valid; the mutation writes nothing.
 */
export async function insertLayout(db: Writer, { hunt_id, quiz_id }: LayoutPlace, layout: Layout): Promise<void> {
  for (const [position, widgeting] of layout.widgetings.entries()) {
    await db.insert('widgetings', WidgetingValidators.row({ ...widgeting, hunt_id, quiz_id, position }))
  }
  for (const [position, column] of layout.columns.entries()) {
    await db.insert('columns', ColumnValidators.row({ hunt_id, quiz_id, position, ...column }))
  }
}

/**
 * Insert a blank quiz into the realm `place` names: its own row, `BlankQuestionQty` blank
 * questions, and the starter columns (`defaultLayout`), with no widgetings. The library is
 * left alone: it is every hunt's, seeded once.
 *
 * @param db - The mutation's database.
 * @param place - The hunt and realm it belongs to.
 * @param title - What to call it; blank means its label, titleized.
 * @param label - The label it starts under; one is generated when omitted.
 * @returns The quiz's row id.
 * @throws When a row is not valid; the mutation writes nothing.
 *
 * @example await insertQuiz(ctx.db, { hunt_id, realm_id }, '', 'quiet_otter')
 */
export async function insertQuiz(db: Writer, place: QuizPlace, title: string, label: string | undefined): Promise<Id<'quizzes'>> {
  const quiz_id = await db.insert('quizzes', Quiz.blankRow(place, title, label))
  const row_ordering: Id<'questions'>[] = []
  for (let ii = 0; ii < BlankQuestionQty; ii += 1) {
    row_ordering.push(await db.insert('questions', Question.blankRow({ hunt_id: place.hunt_id, quiz_id })))
  }
  await db.patch('quizzes', quiz_id, { row_ordering })
  await insertLayout(db, { hunt_id: place.hunt_id, quiz_id }, defaultLayout())
  return quiz_id
}

/**
 * Delete a quiz and everything that hangs from it: every question naming it, whether or not the
 * quiz lists it, with what their widgetings stored and their reviewings; its widgetings with what
 * they stored; its columns; and its reviews. Each is found through its quiz's index.
 *
 * @param db - The mutation's database.
 * @param quiz_id - Which quiz.
 */
export async function deleteQuiz(db: Writer, quiz_id: Id<'quizzes'>): Promise<void> {
  const questions = db.query('questions').withIndex('by_quiz_id', (cvx) => cvx.eq('quiz_id', quiz_id))
  for await (const question of questions) { await deleteQuestion(db, question._id) }
  const widgetings = db.query('widgetings').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz_id))
  for await (const widgeting of widgetings) { await deleteWidgeting(db, widgeting._id) }
  const columns = db.query('columns').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz_id))
  for await (const column of columns) { await db.delete('columns', column._id) }
  const reviews = db.query('reviews').withIndex('by_quiz_id', (cvx) => cvx.eq('quiz_id', quiz_id))
  for await (const review of reviews) { await db.delete('reviews', review._id) }
  await db.delete('quizzes', quiz_id)
}

/**
 * Insert a fresh hunt under `label`: its own row, its home realm, and one blank quiz of the same
 * label there. It seeds nothing: the library is every hunt's, and seeded once.
 *
 * @param db - The mutation's database.
 * @param label - The hunt's label, already validated.
 * @returns The hunt's row id.
 * @throws When a row is not valid; the mutation writes nothing.
 *
 * @example await insertHunt(ctx.db, 'quiet_otter')
 */
export async function insertHunt(db: Writer, label: string): Promise<Id<'hunts'>> {
  const hunt_id = await db.insert('hunts', HuntValidators.row({ label, title: Labelmaker.titleize(label), branch: DefaultBranch }))
  const realm_id = await db.insert('realms', RealmValidators.row({ hunt_id, position: 0, label: HomeRealmLabel, title: Labelmaker.titleize(HomeRealmLabel) }))
  await insertQuiz(db, { hunt_id, realm_id }, '', label)
  return hunt_id
}
