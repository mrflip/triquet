import _ from 'es-toolkit/compat'
import type * as Z from 'zod'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import * as Labelmaker from '../../src/lib/labelmaker'
import type { QuizRows } from '../../src/lib/rows'
import type { OpenQuizT } from '../../src/models/actions'
import { ColumnValidators } from '../../src/models/column'
import { HuntValidators } from '../../src/models/hunt'
import { defaultLayout, type Layout } from '../../src/models/layout'
import { Question, QuestionValidators } from '../../src/models/question'
import { BlankQuestionQty, Quiz, QuizValidators } from '../../src/models/quiz'
import { HomeRealmLabel, RealmValidators } from '../../src/models/realm'
import { ReviewValidators } from '../../src/models/review'
import { ReviewingValidators } from '../../src/models/reviewing'
import { SeedWidgets } from '../../src/models/seeds'
import { WidgetValidators, type WidgetPatch, type WidgetT } from '../../src/models/widget'
import { WidgetedValidators, type WidgetedRecordT } from '../../src/models/widgeted'
import { WidgetingValidators } from '../../src/models/widgeting'
import { libraryOf, reviewsOf } from '../reading'

/** What a mutation writes through */
export type Writer = MutationCtx['db']

/** Where a quiz belongs: its hunt, and the realm of it that holds the quiz */
export type QuizPlace = Pick<OpenQuizT, 'hunt_id' | 'realm_id'>

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

/** Revise a widget's row, keeping its formulary: the patch is held to its formulary's arm of the row */
export async function updateWidget(db: Writer, held: Doc<'widgets'>, patch: WidgetPatch & { position?: number }): Promise<void> {
  // Parsed from the merge whole: which arm of the row it is held to is the held row's formulary.
  const changed = changedFields(held, WidgetValidators.row.parse({ ..._.omit(held, SystemFields), ...patch }))
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

/** Record what one widgeting came to for one question, as the newest row in its cell */
export async function insertWidgeted(db: Writer, question_id: Id<'questions'>, widgeting_id: Id<'widgetings'>, widgeted: WidgetedRecordT): Promise<void> {
  const { status, value, message, result_meta } = widgeted
  await db.insert('widgeteds', WidgetedValidators.row({ question_id, widgeting_id, status, value, message, result_meta }))
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
 * @param quiz_id - The quiz they belong to.
 * @param layout - Its widgetings and columns.
 * @throws When a row is not valid; the mutation writes nothing.
 */
export async function insertLayout(db: Writer, quiz_id: Id<'quizzes'>, layout: Layout): Promise<void> {
  for (const [position, widgeting] of layout.widgetings.entries()) {
    await db.insert('widgetings', WidgetingValidators.row({ ...widgeting, quiz_id, position }))
  }
  for (const [position, column] of layout.columns.entries()) {
    await db.insert('columns', ColumnValidators.row({ quiz_id, position, ...column }))
  }
}

/**
 * Insert a blank quiz into the realm `place` names: its own row, `BlankQuestionQty` blank
 * questions, and the standard widgetings and columns. The library is given whichever of the
 * standard widgetings' widgets it lacks, so every widgeting works something.
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
  const quiz_id = await db.insert('quizzes', Quiz.blankRow(place.realm_id, title, label))
  const row_ordering: Id<'questions'>[] = []
  for (let ii = 0; ii < BlankQuestionQty; ii += 1) {
    row_ordering.push(await db.insert('questions', Question.blankRow({ hunt_id: place.hunt_id, quiz_id })))
  }
  await db.patch('quizzes', quiz_id, { row_ordering })
  const layout = defaultLayout()
  const worked = new Set(layout.widgetings.map((widgeting) => widgeting.widget_label))
  await insertAbsentWidgets(db, SeedWidgets.filter((widget) => worked.has(widget.label)))
  await insertLayout(db, quiz_id, layout)
  return quiz_id
}

/**
 * Delete a quiz and everything that hangs from it: its questions with what their widgetings
 * stored and their reviewings, its widgetings and columns, and its reviews.
 *
 * @param db - The mutation's database.
 * @param held - The quiz's rows.
 */
export async function deleteQuiz(db: Writer, held: QuizRows): Promise<void> {
  for (const question of held.questions) { await deleteQuestion(db, question._id) }
  for (const widgeting of held.widgetings) { await db.delete('widgetings', widgeting._id) }
  for (const column of held.columns) { await db.delete('columns', column._id) }
  const reviews = await reviewsOf(db, held.quiz._id)
  for (const review of reviews) { await db.delete('reviews', review._id) }
  await db.delete('quizzes', held.quiz._id)
}

/**
 * Insert a fresh hunt under `label`: its own row, its home realm, and one blank quiz of the same
 * label there.
 *
 * @param db - The mutation's database.
 * @param label - The hunt's label, already validated.
 * @returns The hunt's row id.
 * @throws When a row is not valid; the mutation writes nothing.
 *
 * @example await insertHunt(ctx.db, 'quiet_otter')
 */
export async function insertHunt(db: Writer, label: string): Promise<Id<'hunts'>> {
  const hunt_id = await db.insert('hunts', HuntValidators.row({ label, forced_label: null, title: Labelmaker.titleize(label) }))
  const realm_id = await db.insert('realms', RealmValidators.row({ hunt_id, position: 0, label: HomeRealmLabel, title: Labelmaker.titleize(HomeRealmLabel) }))
  await insertQuiz(db, { hunt_id, realm_id }, '', label)
  return hunt_id
}
