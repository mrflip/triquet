import _ from 'es-toolkit/compat'
import type * as Z from 'zod'
import type { Db } from 'jazz-tools'
import { app, type ColumnRow, type ExpressionRow, type QuestionRow, type QuizRow, type WidgetRow, type WorkspaceRow } from '../db/schema'
import * as Labelmaker from '../lib/labelmaker'
import { ColumnValidators } from '../models/column'
import { ExpressionValidators, keyOf } from '../models/expression'
import { PlayingValidators, slotkeyOf, unrecordedPlayings, type PlayingT } from '../models/playing'
import { QuestionValidators } from '../models/question'
import { QuizValidators } from '../models/quiz'
import { WidgetValidators } from '../models/widget'
import { WorkspaceValidators } from '../models/workspace'
import type { QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'
import type { WidgetT } from '../models/widget'
import type { WorkspaceT } from '../models/workspace'
import { askedAt, type QuizRows, type WorkspaceRows } from './quiz-rows'

/** What a write inside a transaction is made through */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/** Thrown to abandon a transaction that wrote nothing: Jazz refuses to commit an empty one */
class NothingWritten extends Error {}

/** The methods of a transaction that write */
const WriteMethods: ReadonlySet<PropertyKey> = new Set(['insert', 'update', 'delete', 'upsert', 'restore'])

/**
 * Run `write` in one transaction, committed only when it wrote something: all of it lands, or
 * none of it does, and an action that comes to nothing (a refusal, an edit to the same value)
 * commits nothing at all.
 *
 * @param db - The account's database.
 * @param write - Makes the writes, through the transaction it is handed.
 * @returns What `write` returned; null when it wrote nothing.
 * @throws Whatever `write` throws; nothing of the transaction is kept.
 *
 * @example await transact(db, (tx) => { updateQuiz(tx, rows.quiz, { title }) })
 */
export async function transact<TT>(db: Db, write: (tx: Tx) => TT): Promise<TT | null> {
  try {
    const { value } = await db.transaction((tx) => {
      const writes = { count: 0 }
      // Every write goes through `tx`, so watching its write methods is the whole count.
      const watched = new Proxy(tx, {
        get(target, key) {
          const member: unknown = Reflect.get(target, key)
          if (typeof member !== 'function') { return member }
          if (! WriteMethods.has(key)) { return member.bind(target) as unknown }
          return (...args: unknown[]) => {
            writes.count += 1
            return member.apply(target, args) as unknown
          }
        },
      })
      const result = write(watched)
      if (writes.count > 0) { return result }
      throw new NothingWritten()
    })
    return value
  } catch (err) {
    if (err instanceof NothingWritten) { return null }
    throw err
  }
}

/** The fields of `fields` that differ from what `held` has, for an update that writes only what changed */
export function changedFields<RT extends object>(held: RT, fields: Partial<RT>): Partial<RT> {
  return _.pickBy(fields, (val, key) => ! _.isEqual(val, held[key as keyof RT])) as Partial<RT>
}

/**
 * A playing as the tree's history of a cell gives it, as the row that records it: the row's id
 * and its time are Jazz's own, and a reply that found no spans has an empty list of them.
 */
export function playingFieldsOf(playing: PlayingT): Z.output<typeof PlayingValidators.row> {
  return PlayingValidators.row({ ..._.omit(playing, ['id', 'created_at']), items: playing.items ?? [] })
}

/** Every row of `ordered` whose position is not its place in the list, each handed to `write` with its place */
export function repositioned<RT extends { position: number }>(ordered: readonly RT[], write: (row: RT, position: number) => void): void {
  for (const [position, row] of ordered.entries()) {
    if (row.position !== position) { write(row, position) }
  }
}

// Each update below is held to its row validator whole, as the row would stand afterwards, and
// then writes only the fields that change; one that changes nothing writes nothing.

/** Revise a workspace's own row */
export function updateWorkspace(tx: Tx, held: WorkspaceRow, patch: Partial<Z.output<typeof WorkspaceValidators.row>>): void {
  const changed = changedFields(held, WorkspaceValidators.row({ ..._.omit(held, ['id']), ...patch }))
  if (! _.isEmpty(changed)) { tx.update(app.workspaces, held.id, changed) }
}

/** Revise an expression's row */
export function updateExpression(tx: Tx, held: ExpressionRow, patch: Partial<Z.output<typeof ExpressionValidators.row>>): void {
  const changed = changedFields(held, ExpressionValidators.row({ ..._.omit(held, ['id']), ...patch }))
  if (! _.isEmpty(changed)) { tx.update(app.expressions, held.id, changed) }
}

/** Revise a quiz's own row */
export function updateQuiz(tx: Tx, held: QuizRow, patch: Partial<Z.output<typeof QuizValidators.row>>): void {
  const changed = changedFields(held, QuizValidators.row({ ..._.omit(held, ['id']), ...patch }))
  if (! _.isEmpty(changed)) { tx.update(app.quizzes, held.id, changed) }
}

/** Revise a question's row */
export function updateQuestion(tx: Tx, held: QuestionRow, patch: Partial<Z.output<typeof QuestionValidators.row>>): void {
  const changed = changedFields(held, QuestionValidators.row({ ..._.omit(held, ['id']), ...patch }))
  if (! _.isEmpty(changed)) { tx.update(app.questions, held.id, changed) }
}

/** Revise a widget's row */
export function updateWidget(tx: Tx, held: WidgetRow, patch: Partial<Z.output<typeof WidgetValidators.row>>): void {
  const changed = changedFields(held, WidgetValidators.row({ ..._.omit(held, ['id']), ...patch }))
  if (! _.isEmpty(changed)) { tx.update(app.widgets, held.id, changed) }
}

/** Revise a column's row */
export function updateColumn(tx: Tx, held: ColumnRow, patch: Partial<Z.output<typeof ColumnValidators.row>>): void {
  const changed = changedFields(held, ColumnValidators.row({ ..._.omit(held, ['id']), ...patch }))
  if (! _.isEmpty(changed)) { tx.update(app.columns, held.id, changed) }
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
 * @param tx - The transaction to write through.
 * @param workspace_id - The workspace the quiz belongs to.
 * @param quiz - The quiz as it should be, every field already valid.
 * @param held - The quiz's rows as they stand; null for a quiz not yet written.
 * @returns The quiz's row id.
 * @throws When a row the quiz would come to is not valid; nothing of the transaction is kept.
 *
 * @example await transact(db, (tx) => writeQuiz(tx, workspace_id, Quiz.blank(), null))
 */
export function writeQuiz(tx: Tx, workspace_id: string, quiz: QuizT, held: QuizRows | null): string {
  const fields = QuizValidators.row({
    workspace_id,
    title:           quiz.title,
    label:           quiz.label,
    forced_label:    quiz.forced_label,
    version:         quiz.version,
    locked:          quiz.locked,
    last_sortkey:    quiz.last_sortkey,
    bulk_ishes_last: quiz.bulk_ishes_last,
  })
  const quiz_id = held ? held.quiz.id : tx.insert(app.quizzes, fields).id
  if (held) { updateQuiz(tx, held.quiz, fields) }
  writeQuestions(tx, quiz_id, quiz.questions, held)
  writeWidgets(tx, quiz_id, quiz.widgets, held)
  writeColumns(tx, quiz_id, quiz.columns, held)
  return quiz_id
}

/** The questions of a quiz, in order, with the replies they show that are not yet recorded */
function writeQuestions(tx: Tx, quiz_id: string, questions: readonly QuestionT[], held: QuizRows | null): void {
  const heldQuestions = held?.questions ?? []
  const heldPlayings = held?.playings ?? []
  const kept = new Set(questions.map((question) => question.id))
  const dropped = new Set(heldQuestions.map((row) => row.id).filter((question_id) => ! kept.has(question_id)))
  for (const playing of heldPlayings) {
    if (dropped.has(playing.question_id)) { tx.delete(app.playings, playing.id) }
  }
  for (const question_id of dropped) { tx.delete(app.questions, question_id) }
  const labelForId = new Map(questions.map((question) => [question.id, Labelmaker.effectiveLabelOf(question)]))
  const recordedAt = new Map<string, number>()
  for (const playing of heldPlayings) {
    const slotkey = slotkeyOf(playing)
    recordedAt.set(slotkey, Math.max(recordedAt.get(slotkey) ?? 0, askedAt(playing)))
  }
  for (const [position, question] of questions.entries()) {
    const fields = QuestionValidators.row({
      quiz_id,
      position,
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
    const heldQuestion = heldQuestions.find((row) => row.id === question.id)
    const question_id = heldQuestion ? heldQuestion.id : tx.insert(app.questions, fields).id
    if (heldQuestion) { updateQuestion(tx, heldQuestion, fields) }
    const unrecorded = unrecordedPlayings({ ...question, id: question_id }, recordedAt)
    for (const playing of unrecorded) { tx.insert(app.playings, playingFieldsOf(playing)) }
  }
}

/** The widgets of a quiz, in order */
function writeWidgets(tx: Tx, quiz_id: string, widgets: readonly WidgetT[], held: QuizRows | null): void {
  const heldWidgets = held?.widgets ?? []
  const kept = new Set(widgets.map((widget) => widget.label))
  for (const widget of heldWidgets) {
    if (! kept.has(widget.label)) { tx.delete(app.widgets, widget.id) }
  }
  for (const [position, widget] of widgets.entries()) {
    const fields = WidgetValidators.row({
      quiz_id,
      position,
      label:            widget.label,
      kind:             widget.kind,
      expression_label: widget.kind === 'expressing' ? widget.expression_label : null,
      player_label:     widget.kind === 'playing' ? widget.player_label : null,
      textkind:         widget.kind === 'playing' ? widget.textkind : null,
      description:      widget.description,
    })
    const heldWidget = heldWidgets.find((row) => row.label === widget.label)
    if (heldWidget) {
      updateWidget(tx, heldWidget, fields)
    } else {
      tx.insert(app.widgets, fields)
    }
  }
}

/** The columns of a quiz, in order */
function writeColumns(tx: Tx, quiz_id: string, columns: QuizT['columns'], held: QuizRows | null): void {
  const heldColumns = held?.columns ?? []
  const kept = new Set(columns.map((column) => column.label))
  for (const column of heldColumns) {
    if (! kept.has(column.label)) { tx.delete(app.columns, column.id) }
  }
  for (const [position, column] of columns.entries()) {
    const fields = ColumnValidators.row({ quiz_id, position, ...column })
    const heldColumn = heldColumns.find((row) => row.label === column.label)
    if (heldColumn) {
      updateColumn(tx, heldColumn, fields)
    } else {
      tx.insert(app.columns, fields)
    }
  }
}

/**
 * Delete a quiz and everything that hangs from it.
 *
 * @param tx - The transaction to write through.
 * @param held - The quiz's rows.
 */
export function deleteQuiz(tx: Tx, held: QuizRows): void {
  for (const playing of held.playings) { tx.delete(app.playings, playing.id) }
  for (const question of held.questions) { tx.delete(app.questions, question.id) }
  for (const widget of held.widgets) { tx.delete(app.widgets, widget.id) }
  for (const column of held.columns) { tx.delete(app.columns, column.id) }
  tx.delete(app.quizzes, held.quiz.id)
}

/**
 * Write `workspace` into rows, whole: its expressions in the order given, each of its quizzes as
 * `writeQuiz` does, and which quiz is open. The quizzes and expressions it no longer holds are
 * deleted.
 *
 * A quiz is the row with its id; one whose id is not a row of this workspace is new. An
 * expression is the row with its owner and label.
 *
 * @param tx - The transaction to write through.
 * @param workspace - The workspace as it should be, every field already valid.
 * @param held - The workspace's rows as they stand, and every one of its quizzes' rows; null for a workspace not yet written.
 * @returns The workspace's row id.
 * @throws When a row the workspace would come to is not valid; nothing of the transaction is kept.
 */
export function writeWorkspace(tx: Tx, workspace: WorkspaceT, held: { rows: WorkspaceRows, quizzes: readonly QuizRows[] } | null): string {
  const workspace_id = held ? held.rows.workspace.id : tx.insert(app.workspaces, WorkspaceValidators.row({ active_quiz_id: null })).id
  const heldExpressions = held?.rows.expressions ?? []
  const keptExpressions = new Set(workspace.expressions.map((expression) => keyOf(expression)))
  for (const expression of heldExpressions) {
    if (! keptExpressions.has(keyOf(expression))) { tx.delete(app.expressions, expression.id) }
  }
  for (const [position, expression] of workspace.expressions.entries()) {
    const fields = ExpressionValidators.row({ workspace_id, position, ...expression })
    const heldExpression = heldExpressions.find((row) => keyOf(row) === keyOf(expression))
    if (heldExpression) {
      updateExpression(tx, heldExpression, fields)
    } else {
      tx.insert(app.expressions, fields)
    }
  }

  const heldQuizzes = held?.quizzes ?? []
  const keptQuizzes = new Set(workspace.quizzes.map((quiz) => quiz.id))
  for (const quizRows of heldQuizzes) {
    if (! keptQuizzes.has(quizRows.quiz.id)) { deleteQuiz(tx, quizRows) }
  }
  const rowIdFor = new Map(workspace.quizzes.map((quiz) => [
    quiz.id,
    writeQuiz(tx, workspace_id, quiz, heldQuizzes.find((rows) => rows.quiz.id === quiz.id) ?? null),
  ]))
  const active_quiz_id = rowIdFor.get(workspace.active_quiz_id) ?? null
  if (held) {
    updateWorkspace(tx, held.rows.workspace, { active_quiz_id })
  } else {
    tx.update(app.workspaces, workspace_id, { active_quiz_id })
  }
  return workspace_id
}
