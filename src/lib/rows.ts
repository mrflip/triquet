import _ from 'es-toolkit/compat'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import * as Labelmaker from './labelmaker'
import { resultsFor, type SlotLatest } from '../models/botting'
import type { ExpressionT } from '../models/expression'
import type { HuntT } from '../models/hunt'
import type { HuntRole } from '../models/hunting'
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

/**
 * A question as its own query reads it: its row, and the newest reply in each of its cells. Its
 * chain is still the label the row holds: only the quiz knows which sibling answers to it.
 */
export type SeenQuestionT = Doc<'questions'> & Pick<QuestionT, 'guess' | 'clueing_ishes' | 'hint_ishes'>

/** A quiz without its questions, as its own query reads it: its fields, its questions' order by row id, and its widgets and columns */
export type QuizFrameT = Omit<QuizT, 'questions'> & { row_ordering: readonly Id<'questions'>[] }

/** One quiz's own row, and its widgets' and columns' in their committed order: what its layout needs */
export type LayoutRows = Pick<QuizRows, 'quiz' | 'widgets' | 'columns'>

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

/** A quiz's row as a realm lists it: everything but its questions' order, which only the quiz's own screen reads */
export type ListedQuizT = Omit<Doc<'quizzes'>, 'row_ordering'>

/** A realm as the hunts list and the switcher show it: titled, with its quizzes as rows */
export type ShallowRealmT = {
  _id:     Id<'realms'>
  label:   string
  title:   string
  quizzes: readonly ListedQuizT[]
}

/** A hunt as the hunts list shows it: its labels, its title, and each realm's quizzes as rows */
export type HuntListingT = {
  _id:          Id<'hunts'>
  label:        string
  forced_label: string | null
  title:        string
  realms:       readonly ShallowRealmT[]
}

/** A hunt as its hunts list shows one ident: its listing, and the ident's role on it */
export type ListedHuntT = HuntListingT & { role: HuntRole }

/** An expression, and how many widgets across the hunt work it: one is only deletable at zero */
export type CountedExpressionT = ExpressionT & { usage: number }

/** One ident on a hunt, as the members panel shows it: who, and in what role */
export type MemberT = {
  ident_id: Id<'idents'>
  label:    string
  title:    string
  role:     HuntRole
}

/** A smith of a hunt, as someone not on it is told who to ask */
export type SmithT = Pick<MemberT, 'label' | 'title'>

/**
 * A hunt as a quiz's screen holds it: its listing, its expressions with their usage, who is on
 * it, and the role on it of whoever is looking.
 */
export type ShallowHuntT = HuntListingT & {
  expressions: readonly CountedExpressionT[]
  members:     readonly MemberT[]
  role:        HuntRole
}

/**
 * What an address naming a hunt shows whoever is looking: the hunt, when they are on it; else
 * why not, and for someone not on it, the smiths who could add them.
 */
export type HuntOpeningT =
  | { why: null,         hunt: ShallowHuntT }
  | { why: 'noSuchHunt', hunt: null }
  | { why: 'notOnHunt',  hunt: null, smiths: readonly SmithT[] }

/**
 * A review, with the label and title of the ident who wrote it (null for an ident no longer
 * there), and its verdict on each question the reviewer has written to.
 */
export type ReviewedT = Doc<'reviews'> & {
  reviewer:   Pick<Doc<'idents'>, 'label' | 'title'> | null
  reviewings: Doc<'reviewings'>[]
}

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
 * A question as its own query reads it, from its row and its cells' histories.
 *
 * @param row - The question's row.
 * @param slots - Its cells' histories, by `slotkeyOf`; any others there are passed over.
 * @returns The row, with the newest reply in each cell.
 *
 * @example seenQuestionOf(row, slots).guess?.status  // => 'done'
 */
export function seenQuestionOf(row: Doc<'questions'>, slots: ReadonlyMap<string, SlotRows>): SeenQuestionT {
  return seenWith(row, latestOf(slots))
}

/** Each cell's history as the grid reads it, by `slotkeyOf` */
function latestOf(slots: ReadonlyMap<string, SlotRows>): Map<string, SlotLatest> {
  return new Map([...slots].map(([slotkey, slot]) => [slotkey, slotLatestOf(slot)]))
}

/** A question's row with the newest reply in each of its cells, from every cell's history */
function seenWith(row: Doc<'questions'>, latest: ReadonlyMap<string, SlotLatest>): SeenQuestionT {
  return { ...row, ...resultsFor(row, latest) }
}

/**
 * A quiz without its questions, from its own row and its widgets' and columns' rows in order. A
 * quiz written before it had a smith's note reads as having an empty one.
 *
 * @example frameOf(quiz, widgets, columns).row_ordering.length
 */
export function frameOf(quiz: Doc<'quizzes'>, widgets: readonly Doc<'widgets'>[], columns: readonly Doc<'columns'>[]): QuizFrameT {
  return {
    smiths_note: '',
    ..._.omit(quiz, ['_creationTime', 'realm_id']),
    widgets: widgets.map((row) => widgetFrom(row)),
    columns: columns.map(({ label, title, source, width_px }) => ({ label, title, source, width_px })),
  }
}

/**
 * The quiz a frame and its questions make up, as the tree the rest of the tool reads: the
 * questions in the order given, each chain naming the question it points at.
 *
 * The tree's ids are the rows' ids. A chain is held as a label, and here names the sibling that
 * answers to it; a chain to a label no sibling answers to, or to the question itself, reads as no
 * chain.
 *
 * @param frame - The quiz without its questions.
 * @param seen - Its questions, in its order.
 * @returns The quiz.
 *
 * @example quizFromSeen(frame, seen).questions.length
 */
export function quizFromSeen(frame: QuizFrameT, seen: readonly SeenQuestionT[]): QuizT {
  const idForLabel = new Map(seen.map((question) => [Labelmaker.effectiveLabelOf(question), question._id]))
  const questions = seen.map((row): QuestionT => {
    const target = row.chains_to === null ? null : idForLabel.get(row.chains_to) ?? null
    return { ..._.omit(row, ['_creationTime', 'hunt_id', 'quiz_id']), chains_to: target === row._id ? null : target }
  })
  return { ..._.omit(frame, ['row_ordering']), questions }
}

/**
 * The quiz its rows make up, as `quizFromSeen` assembles it: each question showing the newest
 * reply from each of its bots.
 *
 * @param rows - One quiz's rows.
 * @returns The quiz.
 *
 * @example quizFrom(rows).questions.length
 */
export function quizFrom(rows: QuizRows): QuizT {
  const latest = latestOf(rows.slots)
  return quizFromSeen(frameOf(rows.quiz, rows.widgets, rows.columns), rows.questions.map((row) => seenWith(row, latest)))
}

/**
 * The quiz a frame and its questions' readings come to, once every question it orders has been
 * read: undefined while one is still on its way. A question read as gone (deleted a moment ago)
 * is left out.
 *
 * @param frame - The quiz without its questions.
 * @param seenFor - Each question's reading, by row id: undefined while on its way, null when gone.
 * @returns The quiz, or undefined.
 *
 * @example assembledQuiz(frame, (question_id) => byId[question_id])?.questions.length
 */
export function assembledQuiz(frame: QuizFrameT, seenFor: (question_id: Id<'questions'>) => SeenQuestionT | null | undefined): QuizT | undefined {
  const seen = frame.row_ordering.map((question_id) => seenFor(question_id))
  if (seen.includes(undefined)) { return undefined }
  return quizFromSeen(frame, seen.filter((question) => question !== null && question !== undefined))
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
    realms: rows.realms.map(({ realm, quizzes }) => ({
      _id:     realm._id,
      label:   realm.label,
      title:   realmTitleOf(realm),
      quizzes: quizzes.map((quiz) => _.omit(quiz, ['row_ordering'])),
    })),
  }
}

/**
 * A hunt as a quiz's screen holds it: its listing, its expressions in order, each with how many
 * widgets across the hunt work it, who is on it, and the role of whoever is looking.
 *
 * @param rows - The hunt's own rows.
 * @param usage - How many widgets work each expression, by label; one absent works in none.
 * @param members - Who is on the hunt.
 * @param role - The looker's role on it.
 * @returns The shallow hunt.
 *
 * @example shallowHuntOf(rows, new Map([['clueing_full', 1]]), members, 'smith').expressions[0].usage  // => 1
 */
export function shallowHuntOf(rows: HuntRows, usage: ReadonlyMap<string, number>, members: readonly MemberT[], role: HuntRole): ShallowHuntT {
  return {
    ...huntListingOf(rows),
    expressions: rows.expressions.map((row) => ({ ...expressionFrom(row), usage: usage.get(row.label) ?? 0 })),
    members,
    role,
  }
}

/**
 * The smiths among `members`, in the order they joined: who to ask to be put on a hunt, or made a
 * smith of it.
 *
 * @example smithsOf(hunt.members)  // => [{ label: 'flip_kromer', title: 'Flip' }]
 */
export function smithsOf(members: readonly MemberT[]): SmithT[] {
  return members.filter((member) => member.role === 'smith').map(({ label, title }) => ({ label, title }))
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
