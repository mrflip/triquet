import _ from 'es-toolkit/compat'
import type * as Z from 'zod'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import * as Labelmaker from '../../src/lib/labelmaker'
import { recordedAtOf, type QuizRows } from '../../src/lib/rows'
import { ColumnValidators } from '../../src/models/column'
import { ExpressionValidators } from '../../src/models/expression'
import { BottingValidators, unrecordedBottings, type BottingT } from '../../src/models/botting'
import { HuntValidators, type HuntT } from '../../src/models/hunt'
import { QuestionValidators, type QuestionT } from '../../src/models/question'
import { QuizValidators, type QuizT } from '../../src/models/quiz'
import { RealmValidators } from '../../src/models/realm'
import { ReviewValidators } from '../../src/models/review'
import { WidgetValidators, type BottingPatch, type ExpressingPatch, type WidgetT } from '../../src/models/widget'
import { reviewsOf } from '../reading'

/** What a mutation writes through */
export type Writer = MutationCtx['db']

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

/** Revise a question's row */
export async function updateQuestion(db: Writer, held: Doc<'questions'>, patch: Partial<Z.output<typeof QuestionValidators.row>>): Promise<void> {
  const changed = changedFields(held, QuestionValidators.row({ ..._.omit(held, SystemFields), ...patch }))
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

/** Revise a review's row */
export async function updateReview(db: Writer, held: Doc<'reviews'>, patch: Partial<Z.output<typeof ReviewValidators.row>>): Promise<void> {
  const changed = changedFields(held, ReviewValidators.row({ ..._.omit(held, SystemFields), ...patch }))
  if (! _.isEmpty(changed)) { await db.patch('reviews', held._id, changed) }
}

/** Record each botting of `bottings` as a row of its own */
export async function insertBottings(db: Writer, bottings: readonly BottingT[]): Promise<void> {
  for (const botting of bottings) { await db.insert('bottings', BottingValidators.row(botting)) }
}

/** Delete a question and every botting it was ever asked */
export async function deleteQuestion(db: Writer, question_id: Id<'questions'>): Promise<void> {
  const bottings = db.query('bottings').withIndex('by_question_id_and_bot_label_and_textkind', (qq) => qq.eq('question_id', question_id))
  for await (const botting of bottings) { await db.delete('bottings', botting._id) }
  await db.delete('questions', question_id)
}

/**
 * Write `quiz` into rows, whole: its own row, its questions in the order given, its widgets and
 * columns in the order given, and every reply it shows that is newer than the newest recorded
 * for its cell. What the quiz no longer holds is deleted.
 *
 * A question is the row with its id; one whose id is not a row of this quiz is new. A widget or
 * a column is the row with its label. Only what changed is written. A chain is written as the
 * label of the question it names.
 *
 * @param db - The mutation's database.
 * @param realm_id - The realm the quiz belongs to.
 * @param quiz - The quiz as it should be, every field already valid.
 * @param held - The quiz's rows as they stand; null for a quiz not yet written.
 * @returns The quiz's row id.
 * @throws When a row the quiz would come to is not valid; the mutation writes nothing.
 *
 * @example await writeQuiz(ctx.db, realm_id, Quiz.blank(), null)
 */
export async function writeQuiz(db: Writer, realm_id: Id<'realms'>, quiz: QuizT, held: QuizRows | null): Promise<Id<'quizzes'>> {
  const fields = QuizValidators.row({
    realm_id,
    title:           quiz.title,
    label:           quiz.label,
    forced_label:    quiz.forced_label,
    version:         quiz.version,
    locked:          quiz.locked,
    last_sortkey:    quiz.last_sortkey,
    bulk_ishes_last: quiz.bulk_ishes_last,
    row_ordering:    [],
  })
  // A new quiz is written before its questions, which need its id, and takes their order after.
  const quiz_id = held ? held.quiz._id : await db.insert('quizzes', fields)
  const row_ordering = await writeQuestions(db, quiz_id, quiz.questions, held)
  if (held) {
    await updateQuiz(db, held.quiz, { ...fields, row_ordering })
  } else {
    await db.patch('quizzes', quiz_id, QuizValidators.row({ ...fields, row_ordering }))
  }
  await writeWidgets(db, quiz_id, quiz.widgets, held?.widgets ?? [])
  await writeColumns(db, quiz_id, quiz.columns, held?.columns ?? [])
  return quiz_id
}

/**
 * The questions of a quiz, with the replies they show that are not yet recorded.
 *
 * @returns Their row ids, in the order given: the quiz's `row_ordering`.
 */
async function writeQuestions(db: Writer, quiz_id: Id<'quizzes'>, questions: readonly QuestionT[], held: QuizRows | null): Promise<Id<'questions'>[]> {
  const heldQuestions = held?.questions ?? []
  const kept = new Set(questions.map((question) => question._id))
  for (const row of heldQuestions) {
    if (! kept.has(row._id)) { await deleteQuestion(db, row._id) }
  }
  const labelForId = new Map(questions.map((question) => [question._id, Labelmaker.effectiveLabelOf(question)]))
  const recordedAt = recordedAtOf(held?.slots ?? new Map())
  const ordering: Id<'questions'>[] = []
  for (const question of questions) {
    const fields = QuestionValidators.row({
      quiz_id,
      label:        question.label,
      forced_label: question.forced_label,
      title:        question.title,
      qnum:         question.qnum,
      clueing:      question.clueing,
      hint:         question.hint,
      chains_to:    question.chains_to === null ? null : labelForId.get(question.chains_to) ?? null,
      full_answer:  question.full_answer,
      alt_text:     question.alt_text,
      notes:        question.notes,
    })
    const heldQuestion = heldQuestions.find((row) => row._id === question._id)
    const question_id = heldQuestion ? heldQuestion._id : await db.insert('questions', fields)
    if (heldQuestion) { await updateQuestion(db, heldQuestion, fields) }
    await insertBottings(db, unrecordedBottings({ ...question, _id: question_id }, recordedAt))
    ordering.push(question_id)
  }
  return ordering
}

/** The widgets of a quiz, in order */
async function writeWidgets(db: Writer, quiz_id: Id<'quizzes'>, widgets: readonly WidgetT[], heldWidgets: readonly Doc<'widgets'>[]): Promise<void> {
  const kept = new Set(widgets.map((widget) => widget.label))
  for (const widget of heldWidgets) {
    if (! kept.has(widget.label)) { await db.delete('widgets', widget._id) }
  }
  for (const [position, widget] of widgets.entries()) {
    const fields = WidgetValidators.row({ ...widget, quiz_id, position })
    const heldWidget = heldWidgets.find((row) => row.label === widget.label)
    if (! heldWidget) {
      await db.insert('widgets', fields)
    } else if (heldWidget.kind === fields.kind) {
      await updateWidget(db, heldWidget, fields)
    } else {
      await db.replace('widgets', heldWidget._id, fields)
    }
  }
}

/** The columns of a quiz, in order */
async function writeColumns(db: Writer, quiz_id: Id<'quizzes'>, columns: QuizT['columns'], heldColumns: readonly Doc<'columns'>[]): Promise<void> {
  const kept = new Set(columns.map((column) => column.label))
  for (const column of heldColumns) {
    if (! kept.has(column.label)) { await db.delete('columns', column._id) }
  }
  for (const [position, column] of columns.entries()) {
    const fields = ColumnValidators.row({ quiz_id, position, ...column })
    const heldColumn = heldColumns.find((row) => row.label === column.label)
    if (heldColumn) {
      await updateColumn(db, heldColumn, fields)
    } else {
      await db.insert('columns', fields)
    }
  }
}

/**
 * Delete a quiz and everything that hangs from it: its questions and their bottings, its widgets
 * and columns, and its reviews.
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
 * Write a new hunt into rows, whole: its own row, its realms in order, each realm's quizzes as
 * `writeQuiz` writes them, and its expressions in order.
 *
 * @param db - The mutation's database.
 * @param hunt - The hunt as it should be, every field already valid.
 * @returns The hunt's row id.
 * @throws When a row the hunt would come to is not valid; the mutation writes nothing.
 *
 * @example await writeHunt(ctx.db, Hunt.blank('quiet_otter'))
 */
export async function writeHunt(db: Writer, hunt: HuntT): Promise<Id<'hunts'>> {
  const hunt_id = await db.insert('hunts', HuntValidators.row({ label: hunt.label, forced_label: hunt.forced_label, title: hunt.title }))
  for (const [position, expression] of hunt.expressions.entries()) {
    await db.insert('expressions', ExpressionValidators.row({ hunt_id, position, ...expression }))
  }
  for (const [position, realm] of hunt.realms.entries()) {
    const realm_id = await db.insert('realms', RealmValidators.row({ hunt_id, position, label: realm.label, title: realm.title }))
    for (const quiz of realm.quizzes) { await writeQuiz(db, realm_id, quiz, null) }
  }
  return hunt_id
}
