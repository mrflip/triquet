import _ from 'es-toolkit/compat'
import type { Db } from 'jazz-tools'
import { app, type ColumnRow, type ExpressionRow, type BottingRow, type QuestionRow, type QuizRow, type WidgetRow, type WorkspaceRow } from '../db/schema'
import * as Labelmaker from '../lib/labelmaker'
import { latestBySlot, resultsFor } from '../models/botting'
import type { ExpressionT } from '../models/expression'
import type { QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'
import type { WidgetT } from '../models/widget'
import type { WorkspaceT } from '../models/workspace'

/** Reads come from what this browser holds, so everything built on them works with the network off */
export const LocalFirst = { tier: 'local-first' } as const

/**
 * A botting as read back, with when it was asked. Jazz stamps `$createdAt` a moment after a write
 * lands, so a botting read back at once may not have it yet.
 */
export type HeldBotting = BottingRow & { $createdAt?: Date }

/** When a botting was asked, in epoch milliseconds; one not stamped yet was asked just now */
export function askedAt(botting: HeldBotting): number {
  return botting.$createdAt?.getTime() ?? Date.now()
}

/**
 * Every row an account holds, table by table, each in any order: what its subscriptions deliver,
 * and what every action reads before it writes. An account's rows are its own, so this is small.
 */
export type AccountRows = {
  workspaces:  readonly WorkspaceRow[]
  quizzes:     readonly QuizRow[]
  expressions: readonly ExpressionRow[]
  questions:   readonly QuestionRow[]
  widgets:     readonly WidgetRow[]
  columns:     readonly ColumnRow[]
  bottings:    readonly HeldBotting[]
}

/** One quiz's rows: its own, and its children's, each list in its committed order */
export type QuizRows = {
  quiz:      QuizRow
  questions: readonly QuestionRow[]
  widgets:   readonly WidgetRow[]
  columns:   readonly ColumnRow[]
  bottings:  readonly HeldBotting[]
}

/** One workspace's rows: its own, its quizzes' own in the order they were made, and its expressions in order */
export type WorkspaceRows = {
  workspace:   WorkspaceRow
  quizzes:     readonly QuizRow[]
  expressions: readonly ExpressionRow[]
}

/**
 * Every row this account holds, as this browser holds them.
 *
 * One flat query per table: in this Jazz release, a query that includes two relations, or nests
 * one include in another, can block the page for good.
 *
 * @param db - The account's database.
 * @returns Its rows.
 *
 * @example const held = await loadAccountRows(db)
 */
export async function loadAccountRows(db: Db): Promise<AccountRows> {
  const [workspaces, quizzes, expressions, questions, widgets, columns, bottings] = await Promise.all([
    db.all(app.workspaces, LocalFirst),
    db.all(app.quizzes.orderBy('$createdAt'), LocalFirst),
    db.all(app.expressions, LocalFirst),
    db.all(app.questions, LocalFirst),
    db.all(app.widgets, LocalFirst),
    db.all(app.columns, LocalFirst),
    db.all(app.bottings.select('*', '$createdAt'), LocalFirst),
  ])
  return { workspaces, quizzes, expressions, questions, widgets, columns, bottings }
}

/** `held` in their committed order */
function byPosition<RT extends { position: number }>(held: readonly RT[]): RT[] {
  return held.toSorted((aa, bb) => aa.position - bb.position)
}

/**
 * One quiz's rows, out of everything the account holds.
 *
 * @param held - Everything the account holds.
 * @param quiz_id - Which quiz.
 * @returns Its rows, or null when the account holds no such quiz.
 *
 * @example quizRowsOf(held, open.quiz_id)?.questions.length
 */
export function quizRowsOf(held: AccountRows, quiz_id: string): QuizRows | null {
  const quiz = held.quizzes.find((row) => row.id === quiz_id)
  if (! quiz) { return null }
  const questions = byPosition(held.questions.filter((row) => row.quiz_id === quiz_id))
  const question_ids = new Set(questions.map((row) => row.id))
  return {
    quiz,
    questions,
    widgets:  byPosition(held.widgets.filter((row) => row.quiz_id === quiz_id)),
    columns:  byPosition(held.columns.filter((row) => row.quiz_id === quiz_id)),
    bottings: held.bottings.filter((row) => question_ids.has(row.question_id)),
  }
}

/**
 * One workspace's own rows, out of everything the account holds.
 *
 * @param held - Everything the account holds.
 * @param workspace_id - Which workspace.
 * @returns Its rows, or null when the account holds no such workspace.
 */
export function workspaceRowsOf(held: AccountRows, workspace_id: string): WorkspaceRows | null {
  const workspace = held.workspaces.find((row) => row.id === workspace_id)
  if (! workspace) { return null }
  return {
    workspace,
    quizzes:     held.quizzes.filter((row) => row.workspace_id === workspace_id),
    expressions: byPosition(held.expressions.filter((row) => row.workspace_id === workspace_id)),
  }
}

/** One quiz's rows, as this browser holds them; null when this account holds no such quiz */
export async function loadQuizRows(db: Db, quiz_id: string): Promise<QuizRows | null> {
  return quizRowsOf(await loadAccountRows(db), quiz_id)
}

/** One workspace's own rows, as this browser holds them; null when this account holds no such workspace */
export async function loadWorkspaceRows(db: Db, workspace_id: string): Promise<WorkspaceRows | null> {
  return workspaceRowsOf(await loadAccountRows(db), workspace_id)
}

/**
 * The quiz its rows make up, as the tree the rest of the tool reads: each question showing the
 * newest reply from each of its bots, and its chain naming the question it points at.
 *
 * The tree's ids are the rows' ids. A chain is held as a label, and here names the sibling that
 * answers to it; a chain to a label no sibling answers to reads as no chain.
 *
 * @param rows - One quiz's rows.
 * @returns The quiz.
 *
 * @example quizFrom(quizRowsOf(held, quiz_id)).questions.length
 */
export function quizFrom(rows: QuizRows): QuizT {
  const latest = latestBySlot(rows.bottings.map((botting) => ({ ...botting, created_at: askedAt(botting) })))
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
 * The workspace an account's rows make up: its quizzes in the order they were made, each whole,
 * and its expressions in order. An open quiz the workspace no longer holds (deleted in another
 * tab, say) falls back to the first.
 *
 * @param held - Everything the account holds.
 * @param workspace_id - Which workspace.
 * @returns The workspace; null when the account holds no such workspace, or none of its quizzes
 *   has arrived yet (each table arrives on its own, and a workspace is never without a quiz).
 *
 * @example workspaceFrom(held, workspace_id)?.quizzes.length
 */
export function workspaceFrom(held: AccountRows, workspace_id: string): WorkspaceT | null {
  const rows = workspaceRowsOf(held, workspace_id)
  if (! rows || rows.quizzes.length === 0) { return null }
  const quizzes = rows.quizzes.map((quiz) => quizRowsOf(held, quiz.id)).filter((each) => each !== null)
  const { active_quiz_id } = rows.workspace
  return {
    quizzes:        quizzes.map((each) => quizFrom(each)),
    active_quiz_id: rows.quizzes.some((quiz) => quiz.id === active_quiz_id) ? active_quiz_id ?? '' : rows.quizzes[0]?.id ?? '',
    expressions:    rows.expressions.map((row) => expressionFrom(row)),
  }
}

/**
 * The workspace its rows make up, every quiz whole, as this browser holds them.
 *
 * @param db - The account's database.
 * @param workspace_id - Which workspace.
 * @returns The workspace, or null when this account holds no such workspace or it holds no quizzes.
 */
export async function loadWorkspace(db: Db, workspace_id: string): Promise<WorkspaceT | null> {
  return workspaceFrom(await loadAccountRows(db), workspace_id)
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
  const { kind, label, description, expression_label, bot_label, textkind } = row
  if (kind === 'expressing' && expression_label !== null) { return { kind, label, description, expression_label } }
  if (kind === 'botting' && bot_label !== null && textkind !== null) { return { kind, label, description, bot_label, textkind } }
  throw new Error(`The widget ${label} lacks the fields a ${kind} widget has`)
}
