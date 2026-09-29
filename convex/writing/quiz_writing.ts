import _ from 'es-toolkit/compat'
import type * as Z from 'zod'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import * as Labelmaker from '../../src/lib/labelmaker'
import type { QuizRows } from '../../src/lib/rows'
import type { OpenQuizT } from '../../src/models/actions'
import { ColumnValidators } from '../../src/models/column'
import { ExpressionValidators, SeedExpressions, type ExpressionT } from '../../src/models/expression'
import { BottingValidators, type BottingT } from '../../src/models/botting'
import { HuntValidators } from '../../src/models/hunt'
import { defaultLayoutFor, type Layout } from '../../src/models/layout'
import { Question, QuestionValidators } from '../../src/models/question'
import { BlankQuestionQty, Quiz, QuizValidators } from '../../src/models/quiz'
import { HomeRealmLabel, RealmValidators } from '../../src/models/realm'
import { ReviewValidators } from '../../src/models/review'
import { ReviewingValidators } from '../../src/models/reviewing'
import { WidgetValidators, type BottingPatch, type ExpressingPatch } from '../../src/models/widget'
import { refuse } from '../../src/lib/refusals'
import { huntIdOfRow, reviewsOf } from '../reading'

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

// Each update below is held to its row validator whole, as the row would stand afterwards, and
// then writes only the fields that change; one that changes nothing writes nothing.

/** Revise an expression's row */
export async function updateExpression(db: Writer, held: Doc<'expressions'>, patch: Partial<Z.output<typeof ExpressionValidators.row>>): Promise<void> {
  const changed = changedFields(held, ExpressionValidators.row({ ..._.omit(held, SystemFields), ...patch }))
  if (! _.isEmpty(changed)) { await db.patch('expressions', held._id, changed) }
}

/** Revise a quiz's own row */
export async function updateQuiz(db: Writer, held: Doc<'quizzes'>, patch: Partial<Z.output<typeof QuizValidators.row>>): Promise<void> {
  const changed = changedFields(held, QuizValidators.row({ ..._.omit(held, SystemFields), ...patch }))
  if (! _.isEmpty(changed)) { await db.patch('quizzes', held._id, changed) }
}

/** Revise a question's row, giving it its hunt's id if it was written before it named one */
export async function updateQuestion(db: Writer, held: Doc<'questions'>, patch: Partial<Z.output<typeof QuestionValidators.row>>): Promise<void> {
  const hunt_id = await huntIdOfRow(db, held) ?? refuse('realmGone')
  const changed = changedFields(held, QuestionValidators.row({ ..._.omit(held, SystemFields), hunt_id, ...patch }))
  if (! _.isEmpty(changed)) { await db.patch('questions', held._id, changed) }
}

/** Revise a widget's row, keeping its kind: a widget that changes kind is replaced whole */
export async function updateWidget(db: Writer, held: Doc<'widgets'>, patch: ExpressingPatch & BottingPatch & { position?: number }): Promise<void> {
  const changed = changedFields(held, WidgetValidators.row({ ...held, ...patch }))
  if (! _.isEmpty(changed)) { await db.patch('widgets', held._id, changed) }
}

/** Revise a column's row */
export async function updateColumn(db: Writer, held: Doc<'columns'>, patch: Partial<Z.output<typeof ColumnValidators.row>>): Promise<void> {
  const changed = changedFields(held, ColumnValidators.row({ ..._.omit(held, SystemFields), ...patch }))
  if (! _.isEmpty(changed)) { await db.patch('columns', held._id, changed) }
}

/** Revise a review's row, giving it its hunt's id if it was written before it named one */
export async function updateReview(db: Writer, held: Doc<'reviews'>, patch: Partial<Z.output<typeof ReviewValidators.row>>): Promise<void> {
  const hunt_id = await huntIdOfRow(db, held) ?? refuse('realmGone')
  const changed = changedFields(held, ReviewValidators.row({ ..._.omit(held, SystemFields), hunt_id, ...patch }))
  if (! _.isEmpty(changed)) { await db.patch('reviews', held._id, changed) }
}

/** Revise a reviewing's row */
export async function updateReviewing(db: Writer, held: Doc<'reviewings'>, patch: Partial<Z.output<typeof ReviewingValidators.row>>): Promise<void> {
  const changed = changedFields(held, ReviewingValidators.row({ ..._.omit(held, SystemFields), ...patch }))
  if (! _.isEmpty(changed)) { await db.patch('reviewings', held._id, changed) }
}

/** Record each botting of `bottings` as a row of its own */
export async function insertBottings(db: Writer, bottings: readonly BottingT[]): Promise<void> {
  for (const botting of bottings) { await db.insert('bottings', BottingValidators.row(botting)) }
}

/** Delete a question, every botting it was ever asked, and every reviewer's verdict on it */
export async function deleteQuestion(db: Writer, question_id: Id<'questions'>): Promise<void> {
  const bottings = db.query('bottings').withIndex('by_question_id_and_bot_label_and_textkind', (cvx) => cvx.eq('question_id', question_id))
  for await (const botting of bottings) { await db.delete('bottings', botting._id) }
  const reviewings = db.query('reviewings').withIndex('by_question_id', (cvx) => cvx.eq('question_id', question_id))
  for await (const reviewing of reviewings) { await db.delete('reviewings', reviewing._id) }
  await db.delete('questions', question_id)
}

/**
 * Insert a quiz's widgets and columns, in the order given.
 *
 * @param db - The mutation's database.
 * @param quiz_id - The quiz they belong to.
 * @param layout - Its widgets and columns.
 * @throws When a row is not valid; the mutation writes nothing.
 */
export async function insertLayout(db: Writer, quiz_id: Id<'quizzes'>, layout: Layout): Promise<void> {
  for (const [position, widget] of layout.widgets.entries()) {
    await db.insert('widgets', WidgetValidators.row({ ...widget, quiz_id, position }))
  }
  for (const [position, column] of layout.columns.entries()) {
    await db.insert('columns', ColumnValidators.row({ quiz_id, position, ...column }))
  }
}

/**
 * Insert a blank quiz into the realm `place` names: its own row, `BlankQuestionQty` blank
 * questions, and the standard widgets and columns for `expressions`.
 *
 * @param db - The mutation's database.
 * @param place - The hunt and realm it belongs to.
 * @param title - What to call it; blank means its label, titleized.
 * @param label - The label it starts under; one is generated when omitted.
 * @param expressions - The hunt's expressions, which the standard layout is drawn for.
 * @returns The quiz's row id.
 * @throws When a row is not valid; the mutation writes nothing.
 *
 * @example await insertQuiz(ctx.db, { hunt_id, realm_id }, '', 'quiet_otter', SeedExpressions)
 */
export async function insertQuiz(db: Writer, place: QuizPlace, title: string, label: string | undefined, expressions: readonly ExpressionT[]): Promise<Id<'quizzes'>> {
  const quiz_id = await db.insert('quizzes', Quiz.blankRow(place.realm_id, title, label))
  const row_ordering: Id<'questions'>[] = []
  for (let ii = 0; ii < BlankQuestionQty; ii += 1) {
    row_ordering.push(await db.insert('questions', Question.blankRow({ hunt_id: place.hunt_id, quiz_id })))
  }
  await db.patch('quizzes', quiz_id, { row_ordering })
  await insertLayout(db, quiz_id, defaultLayoutFor(expressions))
  return quiz_id
}

/**
 * Delete a quiz and everything that hangs from it: its questions with their bottings and
 * reviewings, its widgets and columns, and its reviews.
 *
 * @param db - The mutation's database.
 * @param held - The quiz's rows.
 */
export async function deleteQuiz(db: Writer, held: QuizRows): Promise<void> {
  for (const question of held.questions) { await deleteQuestion(db, question._id) }
  for (const widget of held.widgets) { await db.delete('widgets', widget._id) }
  for (const column of held.columns) { await db.delete('columns', column._id) }
  const reviews = await reviewsOf(db, held.quiz._id)
  for (const review of reviews) { await db.delete('reviews', review._id) }
  await db.delete('quizzes', held.quiz._id)
}

/**
 * Insert a fresh hunt under `label`: its own row, the seed expressions, its home realm, and one
 * blank quiz of the same label there.
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
  for (const [position, expression] of SeedExpressions.entries()) {
    await db.insert('expressions', ExpressionValidators.row({ hunt_id, position, ...expression }))
  }
  const realm_id = await db.insert('realms', RealmValidators.row({ hunt_id, position: 0, label: HomeRealmLabel, title: Labelmaker.titleize(HomeRealmLabel) }))
  await insertQuiz(db, { hunt_id, realm_id }, '', label, SeedExpressions)
  return hunt_id
}
