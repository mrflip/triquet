import _ from 'es-toolkit/compat'
import type { Db } from 'jazz-tools'
import { app, type BottingRow, type ColumnRow, type ExpressionRow, type HuntRow, type QuestionRow, type QuizRow, type RealmRow, type ReviewRow, type WidgetRow } from '../db/schema'
import * as Labelmaker from '../lib/labelmaker'
import { latestBySlot, resultsFor } from '../models/botting'
import type { ExpressionT } from '../models/expression'
import type { HuntT } from '../models/hunt'
import type { QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'
import type { RealmT } from '../models/realm'
import type { WidgetT } from '../models/widget'

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
 * The rows one hunt is read from, table by table: what the subscriptions deliver, and what every
 * action reads before it writes. The hunts, realms and quizzes are the directory, every hunt's,
 * so that any label can be looked up; the rest are the open hunt's own. The hunts and quizzes
 * come in the order they were made; the rest in any order.
 */
export type HeldRows = Directory & HuntContents

/** Every hunt, realm and quiz row this browser can read: enough to list them and resolve any address */
export type Directory = {
  hunts:       readonly HuntRow[]
  realms:      readonly RealmRow[]
  quizzes:     readonly QuizRow[]
}

/** One hunt's rows below its quizzes, and its expressions */
export type HuntContents = {
  expressions: readonly ExpressionRow[]
  questions:   readonly QuestionRow[]
  widgets:     readonly WidgetRow[]
  columns:     readonly ColumnRow[]
  bottings:    readonly HeldBotting[]
  reviews:     readonly ReviewRow[]
}

/** One quiz's rows: its own, and its children's, each list in its committed order */
export type QuizRows = {
  quiz:      QuizRow
  questions: readonly QuestionRow[]
  widgets:   readonly WidgetRow[]
  columns:   readonly ColumnRow[]
  bottings:  readonly HeldBotting[]
  /** This quiz's reviews, oldest first: the order two idents' duplicate reviews are settled by */
  reviews:   readonly ReviewRow[]
}

/** One hunt's own rows: the hunt's, its realms' in order, its quizzes' in the order they were made, and its expressions in order */
export type HuntRows = {
  hunt:        HuntRow
  realms:      readonly RealmRow[]
  quizzes:     readonly QuizRow[]
  expressions: readonly ExpressionRow[]
}

/** The queries behind `Directory`, one flat query per table, as both a load and a subscription make them */
export const DirectoryQueries = {
  hunts:   app.hunts.orderBy('$createdAt'),
  realms:  app.realms,
  quizzes: app.quizzes.orderBy('$createdAt'),
} as const

/**
 * The ids of `rows`, as one piece of text in a settled order: the same text for as long as the
 * rows are the same ones, so a query built from it is the same query. `idsIn` reads it back.
 */
export function idsKey(rows: readonly { id: string }[]): string {
  return rows.map((row) => row.id).toSorted((aa, bb) => aa.localeCompare(bb)).join(' ')
}

/** The ids an `idsKey` holds */
export function idsIn(key: string): string[] {
  return key === '' ? [] : key.split(' ')
}

/** The quiz rows of the hunt `hunt_id`, out of the directory */
export function quizzesOf(directory: Directory, hunt_id: string): QuizRow[] {
  const realm_ids = new Set(directory.realms.filter((realm) => realm.hunt_id === hunt_id).map((realm) => realm.id))
  return directory.quizzes.filter((quiz) => realm_ids.has(quiz.realm_id))
}

/**
 * The queries behind one hunt's `HuntContents`, bar its bottings: one flat query per table, each
 * matching only that hunt's rows, so a browser holds and hears about only the hunt it has open.
 *
 * @param hunt_id - Which hunt.
 * @param quiz_ids - Its quizzes' ids.
 */
export function huntQueries(hunt_id: string, quiz_ids: readonly string[]) {
  const ofQuizzes = { quiz_id: { in: [...quiz_ids] } }
  return {
    expressions: app.expressions.where({ hunt_id }),
    questions:   app.questions.where(ofQuizzes),
    widgets:     app.widgets.where(ofQuizzes),
    columns:     app.columns.where(ofQuizzes),
    reviews:     app.reviews.where(ofQuizzes).orderBy('$createdAt'),
  } as const
}

/**
 * The bottings of the questions `question_ids`, and when each was asked.
 *
 * @param question_ids - Which questions.
 */
export function bottingsQuery(question_ids: readonly string[]) {
  return app.bottings.where({ question_id: { in: [...question_ids] } }).select('*', '$createdAt')
}

/** Every hunt, realm and quiz row this browser holds */
export async function loadDirectory(db: Db): Promise<Directory> {
  const [hunts, realms, quizzes] = await Promise.all([
    db.all(DirectoryQueries.hunts, LocalFirst),
    db.all(DirectoryQueries.realms, LocalFirst),
    db.all(DirectoryQueries.quizzes, LocalFirst),
  ])
  return { hunts, realms, quizzes }
}

/**
 * The directory, and one hunt's rows, as this browser holds them.
 *
 * One flat query per table: in this Jazz release, a query that includes two relations, or nests
 * one include in another, can block the page for good.
 *
 * @param db - The account's database.
 * @param hunt_id - Which hunt's rows to read beyond the directory.
 * @returns The rows.
 *
 * @example const held = await loadHeldRows(db, open.hunt_id)
 */
export async function loadHeldRows(db: Db, hunt_id: string): Promise<HeldRows> {
  const directory = await loadDirectory(db)
  const queries = huntQueries(hunt_id, quizzesOf(directory, hunt_id).map((quiz) => quiz.id))
  const [expressions, questions, widgets, columns, reviews] = await Promise.all([
    db.all(queries.expressions, LocalFirst),
    db.all(queries.questions, LocalFirst),
    db.all(queries.widgets, LocalFirst),
    db.all(queries.columns, LocalFirst),
    db.all(queries.reviews, LocalFirst),
  ])
  const bottings = await db.all(bottingsQuery(questions.map((row) => row.id)), LocalFirst)
  return { ...directory, expressions, questions, widgets, columns, bottings, reviews }
}

/** `held` in their committed order */
function byPosition<RT extends { position: number }>(held: readonly RT[]): RT[] {
  return held.toSorted((aa, bb) => aa.position - bb.position)
}

/**
 * One quiz's rows, out of everything held.
 *
 * @param held - The rows held, including the quiz's own.
 * @param quiz_id - Which quiz.
 * @returns Its rows, or null when no such quiz is held.
 *
 * @example quizRowsOf(held, open.quiz_id)?.questions.length
 */
export function quizRowsOf(held: Pick<HeldRows, 'quizzes' | 'questions' | 'widgets' | 'columns' | 'bottings' | 'reviews'>, quiz_id: string): QuizRows | null {
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
    reviews:  held.reviews.filter((row) => row.quiz_id === quiz_id),
  }
}

/**
 * The review of `reviews` `ident_id` has made, the earliest should two exist.
 *
 * @param reviews - A quiz's reviews, oldest first (as `huntQueries` orders them).
 * @param ident_id - Whose review to find.
 * @returns The review, or undefined when that ident has not opened one.
 *
 * @example reviewRowFor(quizRows.reviews, ident.id)?.phase
 */
export function reviewRowFor(reviews: readonly ReviewRow[], ident_id: string): ReviewRow | undefined {
  return reviews.find((review) => review.ident_id === ident_id)
}

/**
 * One hunt's own rows, out of everything held.
 *
 * @param held - The rows held: the directory, and this hunt's own.
 * @param hunt_id - Which hunt.
 * @returns Its rows, or null when no such hunt is held.
 */
export function huntRowsOf(held: HeldRows, hunt_id: string): HuntRows | null {
  const hunt = held.hunts.find((row) => row.id === hunt_id)
  if (! hunt) { return null }
  const realms = byPosition(held.realms.filter((row) => row.hunt_id === hunt_id))
  const realm_ids = new Set(realms.map((row) => row.id))
  return {
    hunt,
    realms,
    quizzes:     held.quizzes.filter((row) => realm_ids.has(row.realm_id)),
    expressions: byPosition(held.expressions.filter((row) => row.hunt_id === hunt_id)),
  }
}

/**
 * The hunt answering to `label`: the one made first, should two have been made with one label.
 *
 * @param held - The directory held; its hunts come in the order they were made.
 * @param label - The label an address names, matched against whichever label is in force.
 * @returns The hunt's row, or undefined when none answers to it.
 *
 * @example huntRowFor(held, 'quiet_otter')?.id
 */
export function huntRowFor(held: Pick<HeldRows, 'hunts'>, label: string): HuntRow | undefined {
  return Labelmaker.entityForLabel(held.hunts, label)
}

/** A hunt as the hunts list shows it: its labels and title, and each realm's quizzes as rows */
export type HuntListing = Pick<HuntRow, 'id' | 'label' | 'forced_label' | 'title'> & {
  realms: { id: string, label: string, quizzes: readonly QuizRow[] }[]
}

/**
 * Every hunt in the directory, as the hunts list shows it, in the order they were made: each
 * titled as `huntFrom` titles it, with its realms in order and their quizzes in the order they
 * were made.
 *
 * @param directory - Every hunt, realm and quiz row held.
 * @returns The hunts.
 *
 * @example huntListingsOf(directory).map((hunt) => hunt.title)
 */
export function huntListingsOf(directory: Directory): HuntListing[] {
  return directory.hunts.map((hunt) => ({
    id:           hunt.id,
    label:        hunt.label,
    forced_label: hunt.forced_label,
    title:        hunt.title === '' ? Labelmaker.titleize(Labelmaker.effectiveLabelOf(hunt)) : hunt.title,
    realms:       byPosition(directory.realms.filter((realm) => realm.hunt_id === hunt.id)).map((realm) => ({
      id:      realm.id,
      label:   realm.label,
      quizzes: directory.quizzes.filter((quiz) => quiz.realm_id === realm.id),
    })),
  }))
}

/** One quiz's rows, as this browser holds them; null when it holds no such quiz */
export async function loadQuizRows(db: Db, quiz_id: string): Promise<QuizRows | null> {
  const [quizzes, questions, widgets, columns, reviews] = await Promise.all([
    db.all(app.quizzes.where({ id: quiz_id }), LocalFirst),
    db.all(app.questions.where({ quiz_id }), LocalFirst),
    db.all(app.widgets.where({ quiz_id }), LocalFirst),
    db.all(app.columns.where({ quiz_id }), LocalFirst),
    db.all(app.reviews.where({ quiz_id }).orderBy('$createdAt'), LocalFirst),
  ])
  const bottings = await db.all(bottingsQuery(questions.map((row) => row.id)), LocalFirst)
  return quizRowsOf({ quizzes, questions, widgets, columns, bottings, reviews }, quiz_id)
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
    const question = { ..._.omit(row, ['id', 'quiz_id', 'position']), _id: row.id, chains_to: target === row.id ? null : target }
    return { ...question, ...resultsFor(question, latest) }
  })
  return {
    ..._.omit(rows.quiz, ['id', 'realm_id']),
    _id:     rows.quiz.id,
    questions,
    widgets: rows.widgets.map((row) => widgetFrom(row)),
    columns: rows.columns.map(({ label, title, source, width_px }) => ({ label, title, source, width_px })),
  }
}

/**
 * The hunt its rows make up: its realms in order, each holding its quizzes whole in the order
 * they were made, and its expressions in order.
 *
 * @param held - The directory held, and this hunt's own rows.
 * @param hunt_id - Which hunt.
 * @returns The hunt; null when no such hunt is held, or it has not all arrived yet (each table
 *   arrives on its own, and a hunt is never without a realm, nor a realm without a quiz).
 *
 * @example huntFrom(held, hunt_id)?.realms[0]?.quizzes.length
 */
export function huntFrom(held: HeldRows, hunt_id: string): HuntT | null {
  const rows = huntRowsOf(held, hunt_id)
  if (! rows || rows.realms.length === 0) { return null }
  const realms = rows.realms.map((realm): RealmT => ({
    _id:     realm.id,
    label:   realm.label,
    title:   realm.title === '' ? Labelmaker.titleize(realm.label) : realm.title,
    quizzes: rows.quizzes.filter((quiz) => quiz.realm_id === realm.id).map((quiz) => quizRowsOf(held, quiz.id)).filter((each) => each !== null).map((each) => quizFrom(each)),
  }))
  if (realms.some((realm) => realm.quizzes.length === 0)) { return null }
  const { id, label, forced_label, title } = rows.hunt
  return {
    _id:         id,
    label,
    forced_label,
    title:       title === '' ? Labelmaker.titleize(Labelmaker.effectiveLabelOf(rows.hunt)) : title,
    realms,
    expressions: rows.expressions.map((row) => expressionFrom(row)),
  }
}

/**
 * The hunt its rows make up, every quiz whole, as this browser holds them.
 *
 * @param db - The account's database.
 * @param hunt_id - Which hunt.
 * @returns The hunt, or null when this browser holds no such hunt or not all of it yet.
 */
export async function loadHunt(db: Db, hunt_id: string): Promise<HuntT | null> {
  return huntFrom(await loadHeldRows(db, hunt_id), hunt_id)
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
