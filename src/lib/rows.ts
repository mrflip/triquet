import _ from 'es-toolkit/compat'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import * as Labelmaker from './labelmaker'
import type * as Actor from './actor'
import * as Wheel from './wheel'
import type { WheelT } from '../models/category'
import type { HuntT } from '../models/hunt'
import type { HuntRole } from '../models/hunting'
import { Question, type QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'
import type { WidgetT } from '../models/widget'
import type { WidgetedHistoryT } from '../models/widgeted'
import type { WidgetingT } from '../models/widgeting'

/** One cell's stored history, as far as the cell needs it: rows of `widgeteds` */
export type CellRows = {
  /** The newest row in the cell, whatever became of it */
  newest: Doc<'widgeteds'>
  /** The newest `ok` row: `newest` itself when it is one, null when none ever was */
  ok:     Doc<'widgeteds'> | null
}

/** Each stored widgeting's history for one question, by the widgeting's label; one with nothing recorded is absent */
export type StoredRows = ReadonlyMap<string, CellRows>

/** One quiz's rows: its own, its children's in their committed order, and what each question stored, by its id */
export type QuizRows = {
  quiz:       Doc<'quizzes'>
  questions:  readonly Doc<'questions'>[]
  widgetings: readonly Doc<'widgetings'>[]
  columns:    readonly Doc<'columns'>[]
  stored:     ReadonlyMap<string, StoredRows>
}

/** Everything a question's own query could send of it: its row, and what its stored widgetings recorded */
type SendableQuestionT = Doc<'questions'> & Pick<QuestionT, 'stored'>

/** A question as its own query sends it to someone of `SS` on its hunt: its id, and the fields that standing is sent (`Question.sentTo`) */
export type SeenQuestionAsT<SS extends Actor.HuntStanding> = Pick<SendableQuestionT, '_id' | (typeof Question.sentTo)[SS][number]>

/**
 * A question as its own query reads it, for whoever asked: its id, and what their standing on its
 * hunt is sent of it (`Question.sentTo`); for a smith, all of it. Its chain is still the label the
 * row holds: only the quiz knows which sibling answers to it.
 */
export type SeenQuestionT = { [SS in Actor.HuntStanding]: SeenQuestionAsT<SS> }[Actor.HuntStanding]

/**
 * What a field of a question its reader was not sent reads as, once the browser makes a tree of
 * it: blank, as in a fresh question. Only a smith is sent every field (`Question.sentTo`), and only
 * a smith's screens show the rest.
 */
const Unsent: Omit<QuestionT, '_id'> = { qnum: '', clueing: '', hint: '', title: '', label: '', chains_to: null, alt_text: '', notes: '', full_answer: '', stored: {} }

/** A quiz without its questions, as its own query reads it: its fields, its questions' order by row id, and its widgetings and columns */
export type QuizFrameT = Omit<QuizT, 'questions'> & { row_ordering: readonly Id<'questions'>[] }

/** One quiz's own row, and its widgetings' and columns' in their committed order: what its layout needs */
export type LayoutRows = Pick<QuizRows, 'quiz' | 'widgetings' | 'columns'>

/** One realm's row, and its quizzes' rows in the order they were made */
export type RealmRows = {
  realm:   Doc<'realms'>
  quizzes: readonly Doc<'quizzes'>[]
}

/** One hunt's own rows: the hunt's, and its realms' in order with their quizzes' */
export type HuntRows = {
  hunt:   Doc<'hunts'>
  realms: readonly RealmRows[]
}

/**
 * How far a widget of the library is put to work, as its editor says it: counts only, never which
 * hunt or quiz. `at_least` says the widgetings were more than a count reads, so each count is a floor.
 */
export type WidgetUsageT = {
  widgetings: number
  quizzes:    number
  hunts:      number
  at_least:   boolean
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

/** A hunt as the hunts list shows it: its label, its title, its branch, and each realm's quizzes as rows */
export type HuntListingT = {
  _id:    Id<'hunts'>
  label:  string
  title:  string
  branch: string
  realms: readonly ShallowRealmT[]
}

/** A hunt as its hunts list shows one ident: its listing, and the ident's role on it */
export type ListedHuntT = HuntListingT & { role: HuntRole }

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
 * A hunt as a quiz's screen holds it: its listing, its wheel of categories, who is on it, and the
 * role on it of whoever is looking
 */
export type ShallowHuntT = HuntListingT & {
  /** How the hunt arranges its categories: the default wheel until someone arranges them. `Wheel.orderOf` gives its total order. */
  wheel:   WheelT
  members: readonly MemberT[]
  role:    HuntRole
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
 * A cell's history as the tree holds it: the rows' own fields, without the ids.
 *
 * @example historyOf({ newest: failedRow, ok: answeredRow }).newest.status  // => 'errored'
 */
export function historyOf(cell: CellRows): WidgetedHistoryT {
  return { newest: storedFrom(cell.newest), ok: cell.ok && storedFrom(cell.ok) }
}

/** One stored widgeted, from its row */
function storedFrom(row: Doc<'widgeteds'>): WidgetedHistoryT['newest'] {
  const { status, value, message, result_meta, _creationTime } = row
  return { status, value, message, result_meta, _creationTime }
}

/** The standing a quiz is read whole for, as the export and the server's own reads want it: a smith's */
const Whole = { standing: 'smith' } as const

/**
 * A question as its own query sends it to someone on its hunt: its id, and the fields their
 * standing there is sent (`Question.sentTo`), chosen by that standing alone. A smith is sent all of
 * it, with what its widgetings stored; a reviewer what a review needs, its answer included.
 *
 * @param row - The question's row.
 * @param stored - Each stored widgeting's history for it, by the widgeting's label; for a standing not sent it, nothing need be read.
 * @param claims - The reader's claims on the question's hunt, of which only the standing counts.
 * @returns The question, as that standing is sent it.
 *
 * @example seenQuestionFor(row, stored, claims).stored.dumdum?.newest.status  // => 'ok', for a smith
 * @example 'notes' in seenQuestionFor(row, new Map(), claims)                 // => false, for a reviewer
 */
export function seenQuestionFor(row: Doc<'questions'>, stored: StoredRows, { standing }: Pick<Actor.HuntClaimsT, 'standing'>): SeenQuestionT {
  const sendable: SendableQuestionT = { ...row, stored: Object.fromEntries([...stored].map(([label, cell]) => [label, historyOf(cell)])) }
  return _.pick(sendable, ['_id', ...Question.sentTo[standing]])
}

/**
 * A quiz without its questions, from its own row and its widgetings' and columns' rows in order.
 *
 * @example frameOf(quiz, widgetings, columns).row_ordering.length
 */
export function frameOf(quiz: Doc<'quizzes'>, widgetings: readonly Doc<'widgetings'>[], columns: readonly Doc<'columns'>[]): QuizFrameT {
  return {
    ..._.omit(quiz, ['_creationTime', 'hunt_id', 'realm_id']),
    widgetings: widgetings.map((row) => widgetingFrom(row)),
    columns:    columns.map((row) => _.pick(row, ['label', 'title', 'source', 'width_px', 'align'])),
  }
}

/**
 * The quiz a frame and its questions make up, as the tree the rest of the tool reads: the
 * questions in the order given, each chain naming the question it points at.
 *
 * The tree's ids are the rows' ids. A chain is held as a label, and here names the sibling that
 * answers to it; a chain to a label no sibling answers to, or to the question itself, reads as no
 * chain. A field the reader was not sent (`Question.sentTo`) reads as blank.
 *
 * @param frame - The quiz without its questions.
 * @param seen - Its questions, in its order, as the reader was sent them.
 * @returns The quiz.
 *
 * @example quizFromSeen(frame, seen).questions.length
 */
export function quizFromSeen(frame: QuizFrameT, seen: readonly SeenQuestionT[]): QuizT {
  const filled = seen.map((reading) => ({ ...Unsent, ...reading }))
  const idForLabel = new Map(filled.map((question) => [question.label, question._id]))
  const questions = filled.map((row): QuestionT => {
    const target = row.chains_to === null ? null : idForLabel.get(row.chains_to) ?? null
    return { ...row, chains_to: target === row._id ? null : target }
  })
  return { ..._.omit(frame, ['row_ordering']), questions }
}

/**
 * The quiz its rows make up, whole, as `quizFromSeen` assembles it for a smith: each question
 * carrying every field, and what its stored widgetings recorded.
 *
 * @param rows - One quiz's rows.
 * @returns The quiz.
 *
 * @example quizFrom(rows).questions.length
 */
export function quizFrom(rows: QuizRows): QuizT {
  const seen = rows.questions.map((row) => seenQuestionFor(row, rows.stored.get(row._id) ?? new Map(), Whole))
  return quizFromSeen(frameOf(rows.quiz, rows.widgetings, rows.columns), seen)
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

/** A widget of the library, from its row: its fields, without its place */
export function widgetFrom(row: Doc<'widgets'>): WidgetT {
  const { scope, label, title, description, input_formula } = row
  const shared = { scope, label, title, description, input_formula }
  switch (row.formulary) {
  case 'jsonata': { return { ...shared, formulary: 'jsonata', formula: row.formula, config: row.config } }
  case 'aibot':   { return { ...shared, formulary: 'aibot', formula: row.formula, config: row.config } }
  case 'entry':   { return { ...shared, formulary: 'entry', formula: '', input_formula: '', config: row.config } }
  }
}

/** A widgeting, from its row: its fields, without its quiz or its place */
export function widgetingFrom(row: Doc<'widgetings'>): WidgetingT {
  const { widget_label, label, description, params } = row
  return { widget_label, label, description, params }
}

/** A hunt's title as the screen shows it: a blank one reads as its label, titleized */
export function huntTitleOf(hunt: Pick<Doc<'hunts'>, 'label' | 'title'>): string {
  return hunt.title === '' ? Labelmaker.titleize(hunt.label) : hunt.title
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
  const { _id, label } = rows.hunt
  return {
    _id,
    label,
    title:  huntTitleOf(rows.hunt),
    branch: rows.hunt.branch,
    realms: rows.realms.map(({ realm, quizzes }) => ({
      _id:     realm._id,
      label:   realm.label,
      title:   realmTitleOf(realm),
      quizzes: quizzes.map((quiz) => _.omit(quiz, ['row_ordering'])),
    })),
  }
}

/**
 * A hunt as a quiz's screen holds it: its listing, its wheel (the default one, for a hunt nobody
 * has arranged), who is on it, and the role of whoever is looking.
 *
 * @param rows - The hunt's own rows.
 * @param members - Who is on the hunt.
 * @param role - The looker's role on it.
 * @returns The shallow hunt.
 *
 * @example shallowHuntOf(rows, members, 'smith').role  // => 'smith'
 */
export function shallowHuntOf(rows: HuntRows, members: readonly MemberT[], role: HuntRole): ShallowHuntT {
  return { ...huntListingOf(rows), wheel: rows.hunt.wheel ?? Wheel.defaultWheel(), members, role }
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
  const { _id, label } = rows.hunt
  return {
    _id,
    label,
    title:  huntTitleOf(rows.hunt),
    branch: rows.hunt.branch,
    realms: rows.realms.map(({ realm, quizzes }) => ({
      _id:     realm._id,
      label:   realm.label,
      title:   realmTitleOf(realm),
      quizzes: quizzes.map((quiz) => quizFor.get(quiz._id)).filter((quiz) => quiz !== undefined),
    })),
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
