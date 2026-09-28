import _ from 'es-toolkit/compat'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import * as Labelmaker from './labelmaker'
import { resultsFor, type SlotLatest } from '../models/botting'
import type { ExpressionT } from '../models/expression'
import type { HuntT } from '../models/hunt'
import type { QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'
import type { WidgetT } from '../models/widget'

/** A botting's history in one cell of a question, as far as the cell needs it */
export type SlotRows = {
  /** The newest botting in the cell, whatever became of it */
  newest: Doc<'bottings'>
  /** The newest botting that answered: `newest` itself when it did, null when none ever has */
  done:   Doc<'bottings'> | null
}

/** One quiz's rows: its own, its children's in their committed order, and each played cell's history by `slotkeyOf` */
export type QuizRows = {
  quiz:      Doc<'quizzes'>
  questions: readonly Doc<'questions'>[]
  widgets:   readonly Doc<'widgets'>[]
  columns:   readonly Doc<'columns'>[]
  slots:     ReadonlyMap<string, SlotRows>
}

/** One realm's row, and its quizzes' rows in the order they were made */
export type RealmRows = {
  realm:   Doc<'realms'>
  quizzes: readonly Doc<'quizzes'>[]
}

/** One hunt's own rows: the hunt's, its realms' in order with their quizzes', and its expressions in order */
export type HuntRows = {
  hunt:        Doc<'hunts'>
  realms:      readonly RealmRows[]
  expressions: readonly Doc<'expressions'>[]
}

/** A realm as the hunts list and the switcher show it: titled, with its quizzes as rows */
export type ShallowRealmT = {
  _id:     Id<'realms'>
  label:   string
  title:   string
  quizzes: readonly Doc<'quizzes'>[]
}

/** A hunt as the hunts list shows it: its labels, its title, and each realm's quizzes as rows */
export type HuntListingT = {
  _id:          Id<'hunts'>
  label:        string
  forced_label: string | null
  title:        string
  realms:       readonly ShallowRealmT[]
}

/** An expression, and how many widgets across the hunt work it: one is only deletable at zero */
export type CountedExpressionT = ExpressionT & { usage: number }

/** A hunt as a quiz's screen holds it: its listing, and its expressions with their usage */
export type ShallowHuntT = HuntListingT & { expressions: readonly CountedExpressionT[] }

/** A review, with the label and title of the ident who wrote it; null for an ident no longer there */
export type ReviewedT = Doc<'reviews'> & { reviewer: Pick<Doc<'idents'>, 'label' | 'title'> | null }

/**
 * What one cell's history comes to: its newest answer, and the newest failure when that is
 * newer still.
 *
 * @example slotLatestOf({ newest: failedRow, done: answeredRow }).failed?.status  // => 'error'
 */
export function slotLatestOf(slot: SlotRows): SlotLatest {
  return {
    done:   slot.done,
    failed: slot.newest.status === 'error' ? slot.newest : null,
  }
}

/**
 * When each cell's newest botting was made, by `slotkeyOf`: what a reply the tree holds must be
 * newer than to be recorded.
 */
export function recordedAtOf(slots: ReadonlyMap<string, SlotRows>): Map<string, number> {
  return new Map([...slots].map(([slotkey, slot]) => [slotkey, slot.newest._creationTime]))
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
 * @example quizFrom(rows).questions.length
 */
export function quizFrom(rows: QuizRows): QuizT {
  const latest = new Map([...rows.slots].map(([slotkey, slot]) => [slotkey, slotLatestOf(slot)]))
  const idForLabel = new Map(rows.questions.map((question) => [Labelmaker.effectiveLabelOf(question), question._id]))
  const questions = rows.questions.map((row): QuestionT => {
    const target = row.chains_to === null ? null : idForLabel.get(row.chains_to) ?? null
    const question = { ..._.omit(row, ['_creationTime', 'quiz_id', 'position']), chains_to: target === row._id ? null : target }
    return { ...question, ...resultsFor(question, latest) }
  })
  return {
    ..._.omit(rows.quiz, ['_creationTime', 'realm_id']),
    questions,
    widgets: rows.widgets.map((row) => widgetFrom(row)),
    columns: rows.columns.map(({ label, title, source, width_px }) => ({ label, title, source, width_px })),
  }
}

/** An expression, from its row */
export function expressionFrom(row: Doc<'expressions'>): ExpressionT {
  return { owner: row.owner, label: row.label, formula: row.formula, description: row.description }
}

/** A widget, from its row: the fields of its own kind, without its place */
export function widgetFrom(row: Doc<'widgets'>): WidgetT {
  const { label, description } = row
  if (row.kind === 'expressing') { return { kind: row.kind, label, description, expression_label: row.expression_label } }
  return { kind: row.kind, label, description, bot_label: row.bot_label, textkind: row.textkind }
}

/** A hunt's title as the screen shows it: a blank one reads as the label in force, titleized */
export function huntTitleOf(hunt: Pick<Doc<'hunts'>, 'label' | 'forced_label' | 'title'>): string {
  return hunt.title === '' ? Labelmaker.titleize(Labelmaker.effectiveLabelOf(hunt)) : hunt.title
}

/** A realm's title as the screen shows it: a blank one reads as its label, titleized */
export function realmTitleOf(realm: Pick<Doc<'realms'>, 'label' | 'title'>): string {
  return realm.title === '' ? Labelmaker.titleize(realm.label) : realm.title
}

/**
 * A hunt as the hunts list shows it: titled, with its realms in order, each titled and holding
 * its quizzes' rows in the order they were made.
 *
 * @example huntListingOf(rows).realms[0].quizzes.length
 */
export function huntListingOf(rows: Pick<HuntRows, 'hunt' | 'realms'>): HuntListingT {
  const { _id, label, forced_label } = rows.hunt
  return {
    _id,
    label,
    forced_label,
    title:  huntTitleOf(rows.hunt),
    realms: rows.realms.map(({ realm, quizzes }) => ({ _id: realm._id, label: realm.label, title: realmTitleOf(realm), quizzes })),
  }
}

/**
 * A hunt as a quiz's screen holds it: its listing, and its expressions in order, each with how
 * many widgets across the hunt work it.
 *
 * @param rows - The hunt's own rows.
 * @param usage - How many widgets work each expression, by label; one absent works in none.
 * @returns The shallow hunt.
 *
 * @example shallowHuntOf(rows, new Map([['clueing_full', 1]])).expressions[0].usage  // => 1
 */
export function shallowHuntOf(rows: HuntRows, usage: ReadonlyMap<string, number>): ShallowHuntT {
  return {
    ...huntListingOf(rows),
    expressions: rows.expressions.map((row) => ({ ...expressionFrom(row), usage: usage.get(row.label) ?? 0 })),
  }
}

/**
 * The hunt its rows make up, every quiz whole: what the Export box emits.
 *
 * @param rows - The hunt's own rows.
 * @param quizFor - Each of its quizzes, whole, by id.
 * @returns The hunt, its realms in order, each holding its quizzes in the order they were made.
 *
 * @example huntFrom(rows, quizzes).realms[0].quizzes[0].title
 */
export function huntFrom(rows: HuntRows, quizFor: ReadonlyMap<string, QuizT>): HuntT {
  const { _id, label, forced_label } = rows.hunt
  return {
    _id,
    label,
    forced_label,
    title:       huntTitleOf(rows.hunt),
    realms:      rows.realms.map(({ realm, quizzes }) => ({
      _id:     realm._id,
      label:   realm.label,
      title:   realmTitleOf(realm),
      quizzes: quizzes.map((quiz) => quizFor.get(quiz._id)).filter((quiz) => quiz !== undefined),
    })),
    expressions: rows.expressions.map((row) => expressionFrom(row)),
  }
}

/**
 * The review of a quiz that `ident_id` wrote, out of the quiz's reviews oldest first: the earliest,
 * should there be two.
 *
 * @returns The review, or null when that ident has written none.
 *
 * @example reviewBy(reviews, ident._id)?.phase  // => 'draft'
 */
export function reviewBy<RT extends Pick<Doc<'reviews'>, 'ident_id'>>(reviews: readonly RT[], ident_id: string): RT | null {
  return reviews.find((review) => review.ident_id === ident_id) ?? null
}
