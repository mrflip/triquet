import _ from 'es-toolkit/compat'
import type { Db } from 'jazz-tools'
import { app, type ColumnRow, type ExpressionRow, type PlayingRow, type QuestionRow, type QuizRow, type WidgetRow, type WorkspaceRow } from '../db/schema'
import * as Labelmaker from '../lib/labelmaker'
import { latestBySlot, resultsFor } from '../models/playing'
import type { WidgetT } from '../models/widget'
import type { ExpressionT } from '../models/expression'
import type { QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'
import type { WorkspaceT } from '../models/workspace'

/** Reads come from what this browser holds, so everything built on them works with the network off */
export const LocalFirst = { tier: 'local-first' } as const

/**
 * A playing as read back, with when it was asked. Jazz stamps `$createdAt` a moment after a write
 * lands, so a playing read back at once may not have it yet.
 */
export type HeldPlaying = PlayingRow & { $createdAt?: Date }

/** When a playing was asked, in epoch milliseconds; one not stamped yet was asked just now */
export function askedAt(playing: HeldPlaying): number {
  return playing.$createdAt?.getTime() ?? Date.now()
}

/** One quiz's rows: its own, and its children's, each list in its committed order */
export type QuizRows = {
  quiz:      QuizRow
  questions: QuestionRow[]
  widgets:   WidgetRow[]
  columns:   ColumnRow[]
  playings:  HeldPlaying[]
}

/** One workspace's rows: its own, its quizzes' own in the order they were made, and its expressions in order */
export type WorkspaceRows = {
  workspace:   WorkspaceRow
  quizzes:     QuizRow[]
  expressions: ExpressionRow[]
}

/**
 * Every row of one quiz, as this browser holds them.
 *
 * @param db - The account's database.
 * @param quiz_id - Which quiz.
 * @returns Its rows, or null when this account holds no such quiz.
 *
 * @example const rows = await loadQuizRows(db, quiz_id)
 */
export async function loadQuizRows(db: Db, quiz_id: string): Promise<QuizRows | null> {
  // One flat query per table: in this Jazz release, a query that includes two of a quiz's
  // relations, or nests one include in another, can block the page for good.
  const [quiz, questions, widgets, columns] = await Promise.all([
    db.one(app.quizzes.where({ id: quiz_id }), LocalFirst),
    db.all(app.questions.where({ quiz_id }).orderBy('position'), LocalFirst),
    db.all(app.widgets.where({ quiz_id }).orderBy('position'), LocalFirst),
    db.all(app.columns.where({ quiz_id }).orderBy('position'), LocalFirst),
  ])
  if (! quiz) { return null }
  const question_ids = questions.map((question) => question.id)
  const playings = question_ids.length === 0 ? [] : await db.all(app.playings.where({ question_id: { in: question_ids } }).select('*', '$createdAt'), LocalFirst)
  return { quiz, questions, widgets, columns, playings }
}

/**
 * One workspace's own row, its quizzes' own rows and its expressions, as this browser holds them.
 *
 * @param db - The account's database.
 * @param workspace_id - Which workspace.
 * @returns Its rows, or null when this account holds no such workspace.
 */
export async function loadWorkspaceRows(db: Db, workspace_id: string): Promise<WorkspaceRows | null> {
  const [workspace, quizzes, expressions] = await Promise.all([
    db.one(app.workspaces.where({ id: workspace_id }), LocalFirst),
    db.all(app.quizzes.where({ workspace_id }).orderBy('$createdAt'), LocalFirst),
    db.all(app.expressions.where({ workspace_id }).orderBy('position'), LocalFirst),
  ])
  return workspace ? { workspace, quizzes, expressions } : null
}

/**
 * The quiz its rows make up, as the tree the rest of the tool reads: each question showing the
 * newest reply from each of its players, and its chain naming the question it points at.
 *
 * The tree's ids are the rows' ids. A chain is held as a label, and here names the sibling that
 * answers to it; a chain to a label no sibling answers to reads as no chain.
 *
 * @param rows - One quiz's rows.
 * @returns The quiz.
 *
 * @example quizFrom(await loadQuizRows(db, quiz_id)).questions.length
 */
export function quizFrom(rows: QuizRows): QuizT {
  const latest = latestBySlot(rows.playings.map((playing) => ({ ...playing, created_at: askedAt(playing) })))
  const idForLabel = new Map(rows.questions.map((question) => [Labelmaker.effectiveLabelOf(question), question.id]))
  const questions = rows.questions.map((row): QuestionT => {
    const target = row.chains_to === null ? null : idForLabel.get(row.chains_to) ?? null
    return { ..._.omit(row, ['quiz_id', 'position']), chains_to: target === row.id ? null : target, ...resultsFor(row, latest) }
  })
  return {
    ..._.omit(rows.quiz, ['workspace_id']),
    questions,
    widgets: rows.widgets.map((row) => widgetFrom(row)),
    columns: rows.columns.map(({ label, title, source, width_px }) => ({ label, title, source, width_px })),
  }
}

/**
 * The workspace its rows make up, every quiz whole.
 *
 * @param db - The account's database.
 * @param workspace_id - Which workspace.
 * @returns The workspace, or null when this account holds no such workspace or it holds no quizzes.
 */
export async function loadWorkspace(db: Db, workspace_id: string): Promise<WorkspaceT | null> {
  const held = await loadWorkspaceRows(db, workspace_id)
  if (! held || held.quizzes.length === 0) { return null }
  const quizzes = await Promise.all(held.quizzes.map(async (quiz) => await loadQuizRows(db, quiz.id)))
  return {
    quizzes:        quizzes.filter((rows) => rows !== null).map((rows) => quizFrom(rows)),
    active_quiz_id: held.workspace.active_quiz_id ?? held.quizzes[0]?.id ?? '',
    expressions:    held.expressions.map((row) => expressionFrom(row)),
  }
}

/** An expression, from its row */
export function expressionFrom(row: ExpressionRow): ExpressionT {
  return { owner: row.owner, label: row.label, formula: row.formula, description: row.description }
}

/**
 * A widget, from its row: the fields of its own kind, and none of the other's. Its row validator
 * saw to it that its kind's fields are there.
 */
function widgetFrom(row: WidgetRow): WidgetT {
  const { kind, label, description, expression_label, player_label, textkind } = row
  if (kind === 'expressing' && expression_label !== null) { return { kind, label, description, expression_label } }
  if (kind === 'playing' && player_label !== null && textkind !== null) { return { kind, label, description, player_label, textkind } }
  throw new Error(`The widget ${label} lacks the fields a ${kind} widget has`)
}
