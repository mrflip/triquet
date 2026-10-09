import _ from 'es-toolkit/compat'
import type { MigrationStatus } from '@convex-dev/migrations'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import * as Labelmaker from './labelmaker'
import * as Stamps from './stamps'
import * as Tsv from './tsv'
import type * as Actor from './actor'
import * as Wheel from './wheel'
import type { WheelT } from '../models/category'
import type { HuntT } from '../models/hunt'
import type { HuntRole } from '../models/hunting'
import { DefaultViz, Question, type QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'
import type { ColumnT } from '../models/column'
import type { WidgetT } from '../models/widget'
import type { WidgetedHistoryT } from '../models/widgeted'
import type { WidgetingT } from '../models/widgeting'

/** One stored widgeted's row, as far as its cell reads it: a row of `widgeteds`, for a question, or of `quiz_widgeteds`, for the quiz itself */
export type StoredRowT = Pick<Doc<'widgeteds'>, 'status' | 'value' | 'message' | 'result_meta' | '_creationTime'>

/** One cell's stored history, as far as the cell needs it: rows of `widgeteds`, or of `quiz_widgeteds` */
export type CellRows = {
  /** The newest row in the cell, whatever became of it */
  newest: StoredRowT
  /** The newest `ok` row: `newest` itself when it is one, null when none ever was */
  ok:     StoredRowT | null
}

/** Each stored widgeting's history for the quiz itself, by the widgeting's label; one with nothing recorded is absent */
export type StoredRows = ReadonlyMap<string, CellRows>

/**
 * Each stored widgeting's history for one question, by the widgeting's row id; one with nothing
 * recorded is absent. A question's own read knows no labels (it reads none of its quiz's
 * widgetings), so the quiz puts each under its label (`quizFromSeen`).
 */
export type QuestionStoredRows = ReadonlyMap<Id<'widgetings'>, CellRows>

/** One quiz's rows: its own, its children's in their committed order, what each question stored, by its id, and what the quiz itself stored */
export type QuizRows = {
  quiz:       Doc<'quizzes'>
  questions:  readonly Doc<'questions'>[]
  widgetings: readonly Doc<'widgetings'>[]
  columns:    readonly Doc<'columns'>[]
  stored:     ReadonlyMap<string, QuestionStoredRows>
  /** What each widgeting run once for the whole quiz stored for it */
  quizStored: StoredRows
}

/** What a question's stored widgetings recorded, as its own query sends it: each cell's history by the widgeting's row id */
export type SentStoredT = Readonly<Record<Id<'widgetings'>, WidgetedHistoryT>>

/** Everything a question's own query could send of it: its row, stamped (`Stamps.of`), and what its stored widgetings recorded, by widgeting id */
type SendableQuestionT = Omit<Doc<'questions'>, keyof Stamps.StampsT> & Stamps.StampsT & { stored: SentStoredT }

/** A question as its own query sends it to someone of `SS` on its hunt: its id, and the fields that standing is sent (`Question.sentTo`) */
export type SeenQuestionAsT<SS extends Actor.HuntStanding> = Pick<SendableQuestionT, '_id' | (typeof Question.sentTo)[SS][number]>

/**
 * A question as its own query reads it, for whoever asked: its id, and what their standing on its
 * hunt is sent of it (`Question.sentTo`); for a smith, all of it. Its chain is still the label the
 * row holds, and what it stored is keyed by widgeting id: only the quiz knows which sibling
 * answers to the one, and which widgeting to the other.
 */
export type SeenQuestionT = { [SS in Actor.HuntStanding]: SeenQuestionAsT<SS> }[Actor.HuntStanding]

/**
 * What a field of a question its reader was not sent reads as, once the browser makes a tree of
 * it: blank, as in a fresh question. Only a smith is sent every field (`Question.sentTo`), and only
 * a smith's screens show the rest.
 */
const Unsent: Omit<QuestionT, '_id'> = { qnum: '', clueing: '', hint: '', title: '', label: '', chains_to: null, alt_text: '', notes: '', full_answer: '', recap: '', viz: DefaultViz, stored: {}, created_at: null, updated_at: null }

/**
 * A quiz without its questions, as its own query reads it: its fields, its questions' order by row
 * id, its widgetings and columns, and each widgeting's row id by its label, by which what a
 * question stored is put under its widgeting's label (`quizFromSeen`)
 */
export type QuizFrameT = Omit<QuizT, 'questions'> & {
  row_ordering:  readonly Id<'questions'>[]
  widgeting_ids: Readonly<Record<string, Id<'widgetings'>>>
}

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

/**
 * How far one backfill has run on this deployment, as the stats page says it: its name, state and
 * counts, never its cursor or its error's text, which may quote a row.
 */
export type BackfillStatusT = {
  /** Its function's name: `migrations:backfillHuntOrglabels` */
  fnname:      string
  /** Whether `migrations.ts` still defines it; one that is gone is history */
  defined:     boolean
  state:       MigrationStatus['state']
  is_done:     boolean
  /** Rows it has been through */
  processed:   number
  /** When its latest run began and ended, as epoch milliseconds; null for never */
  started_at:  number | null
  ended_at:    number | null
}

/** A quiz's row as a realm lists it: everything but its questions' order, which only the quiz's own screen reads */
export type ListedQuizT = Omit<Doc<'quizzes'>, 'row_ordering'>

/** A realm as the hunts list and the switcher show it: titled, with its quizzes as rows, by label */
export type ShallowRealmT = {
  _id:     Id<'realms'>
  label:   string
  title:   string
  quizzes: readonly ListedQuizT[]
}

/** A hunt as the hunts list shows it: its label and the org it is addressed under, its title, its branch, its stamps, and each realm's quizzes as rows */
export type HuntListingT = {
  _id:    Id<'hunts'>
  label:  string
  /** The org its address names, and its label is unique within: the hunt's `orglabel` */
  org:    string
  title:  string
  branch: string
  /** When the hunt was made, and its own row last edited (`Stamps.of`) */
  created_at: number
  updated_at: number
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
function storedFrom(row: StoredRowT): WidgetedHistoryT['newest'] {
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
 * @param stored - Each stored widgeting's history for it, by the widgeting's row id; for a standing not sent it, nothing need be read.
 * @param claims - The reader's claims on the question's hunt, of which only the standing counts.
 * @returns The question, as that standing is sent it.
 *
 * @example seenQuestionFor(row, stored, claims).stored[widgeting_id]?.newest.status  // => 'ok', for a smith
 * @example 'notes' in seenQuestionFor(row, new Map(), claims)                         // => false, for a reviewer
 */
export function seenQuestionFor(row: Doc<'questions'>, stored: QuestionStoredRows, { standing }: Pick<Actor.HuntClaimsT, 'standing'>): SeenQuestionT {
  const sendable: SendableQuestionT = { ...row, ...Stamps.of(row), stored: Object.fromEntries([...stored].map(([widgeting_id, cell]) => [widgeting_id, historyOf(cell)])) }
  return _.pick(sendable, ['_id', ...Question.sentTo[standing]])
}

/**
 * A quiz without its questions, from its own row (stamped, `Stamps.of`), its widgetings' and
 * columns' rows in order, and what its widgetings run once for the whole quiz stored for it, for
 * a reader sent that (a smith; nothing, and nothing read, for anyone else). Each widgeting's row
 * id goes beside it, by its label, for its questions' stored cells to be found by.
 *
 * @example frameOf(quiz, widgetings, columns, new Map()).row_ordering.length
 * @example frameOf(quiz, widgetings, columns, new Map()).widgeting_ids.dumdum  // => the dumdum widgeting's row id
 */
export function frameOf(quiz: Doc<'quizzes'>, widgetings: readonly Doc<'widgetings'>[], columns: readonly Doc<'columns'>[], stored: StoredRows): QuizFrameT {
  return {
    ..._.omit(quiz, ['_creationTime', 'hunt_id', 'realm_id']),
    ...Stamps.of(quiz),
    widgetings:    widgetings.map((row) => widgetingFrom(row)),
    widgeting_ids: Object.fromEntries(widgetings.map((row) => [row.label, row._id])),
    columns:       columns.map((row) => columnFrom(row)),
    stored:        Object.fromEntries([...stored].map(([label, cell]) => [label, historyOf(cell)])),
  }
}

/**
 * What a question stored, as sent by widgeting id, put under each widgeting's label: in the run
 * order of the frame's widgetings that run for each question. A widgeting the frame does not hold
 * (one deleted a moment ago), or one run once for the whole quiz, has no cell here.
 */
function storedUnder(frame: Pick<QuizFrameT, 'widgetings' | 'widgeting_ids'>, stored: SentStoredT): QuestionT['stored'] {
  return Object.fromEntries(frame.widgetings.flatMap(({ label, tier }) => {
    const widgeting_id = frame.widgeting_ids[label]
    const history = tier === 'question' && widgeting_id !== undefined ? stored[widgeting_id] : undefined
    return history ? [[label, history]] : []
  }))
}

/**
 * A column, from its row: its own fields, without the row's ids and place.
 *
 * @example columnFrom(row).source  // => 'clueing'
 */
export function columnFrom(row: Doc<'columns'>): ColumnT {
  return _.pick(row, ['label', 'title', 'source', 'width_px', 'align', 'formula', 'template', 'readout', 'collapsed'])
}

/** What a question `quizFromSeen` made was made of: its reading, what put its stored cells under labels (`storedKeyOf`), and the id its chain came to */
type MadeOfT = { reading: SeenQuestionT, storedKey: string, target: string | null }

/** What each question `quizFromSeen` made was made of, so a later assembly can hand back the very same question */
const QuestionsMadeOf = new WeakMap<QuestionT, MadeOfT>()

/** The frame each quiz `quizFromSeen` made was made from */
const QuizzesFramedBy = new WeakMap<QuizT, QuizFrameT>()

/** `storedKeyOf`, by the frame */
const StoredKeys = new WeakMap<QuizFrameT, string>()

/** The parts of a quiz that are the frame's own, which keep their identity across frames while they hold the same */
const FrameParts = ['widgetings', 'columns', 'stored', 'templateable'] as const

/**
 * What decides where a frame puts a question's stored cells (`storedUnder`), as one string: its
 * widgetings' labels and tiers, in its order, and their ids. Two frames of the same key put every
 * question's cells under the same labels.
 */
function storedKeyOf(frame: QuizFrameT): string {
  const known = StoredKeys.get(frame)
  if (known !== undefined) { return known }
  const made = JSON.stringify([frame.widgetings.map(({ label, tier }) => [label, tier]), frame.widgeting_ids])
  StoredKeys.set(frame, made)
  return made
}

/**
 * The quiz a frame and its questions make up, as the tree the rest of the tool reads: the
 * questions in the order given, each chain naming the question it points at, and what each stored
 * under its widgetings' labels.
 *
 * The tree's ids are the rows' ids. A chain is held as a label, and here names the sibling that
 * answers to it; a chain to a label no sibling answers to, or to the question itself, reads as no
 * chain. What a question stored is sent by widgeting id, and here is put under the label of the
 * frame's widgeting of that id, in run order (`storedUnder`). A field the reader was not sent
 * (`Question.sentTo`) reads as blank.
 *
 * Given the quiz this assembly follows (`was`), it hands back each of its questions whose reading
 * is the very same object, put under the same labels and chained to the same question, rather
 * than one made afresh; each of its own parts (widgetings, columns, stored, templateable) while it
 * holds the same; and the very quiz `was` when nothing at all is new. So a screen can tell what
 * changed by identity, and an edit to one question makes one question new. What it hands back is
 * shared from one assembly to the next, and is never to be changed in place.
 *
 * @param frame - The quiz without its questions.
 * @param seen - Its questions, in its order, as the reader was sent them.
 * @param was - The quiz the last assembly of this quiz came to; null for none.
 * @returns The quiz.
 *
 * @example quizFromSeen(frame, seen, null).questions.length
 * @example quizFromSeen(frame, [first, edited], was).questions[0] === was.questions[0]  // => true
 * @example quizFromSeen(frame, seen, quizFromSeen(frame, seen, null))  // => the very quiz passed as `was`
 */
export function quizFromSeen(frame: QuizFrameT, seen: readonly SeenQuestionT[], was: QuizT | null = null): QuizT {
  const storedKey = storedKeyOf(frame)
  const idForLabel = new Map(seen.map((reading) => ['label' in reading ? reading.label : Unsent.label, reading._id]))
  const wasFor = new Map(was?.questions.map((question) => [question._id, question]))
  const questions = seen.map((reading): QuestionT => {
    const chain = 'chains_to' in reading ? reading.chains_to : null
    const found = chain === null ? null : idForLabel.get(chain) ?? null
    const target = found === reading._id ? null : found
    const held = wasFor.get(reading._id)
    const madeOf = held && QuestionsMadeOf.get(held)
    if (held && madeOf?.reading === reading && madeOf.storedKey === storedKey && madeOf.target === target) { return held }
    const question = { ...Unsent, ...reading, stored: 'stored' in reading ? storedUnder(frame, reading.stored) : Unsent.stored, chains_to: target }
    QuestionsMadeOf.set(question, { reading, storedKey, target })
    return question
  })
  if (was && QuizzesFramedBy.get(was) === frame && isSameList(was.questions, questions)) { return was }
  const own = _.omit(frame, ['row_ordering', 'widgeting_ids'])
  const kept = was ? Object.fromEntries(FrameParts.filter((part) => _.isEqual(was[part], own[part])).map((part) => [part, was[part]])) : {}
  const quiz = { ...own, ...kept, questions }
  QuizzesFramedBy.set(quiz, frame)
  return quiz
}

/** Whether two lists hold the very same members, in order */
function isSameList(aa: readonly unknown[], bb: readonly unknown[]): boolean {
  return aa.length === bb.length && aa.every((each, idx) => each === bb[idx])
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
  return quizFromSeen(frameOf(rows.quiz, rows.widgetings, rows.columns, rows.quizStored), seen)
}

/**
 * The quiz a frame and its questions' readings come to, once every question it orders has been
 * read: undefined while one is still on its way. A question read as gone (deleted a moment ago)
 * is left out. Given the quiz the last assembly came to, what has not changed keeps its identity
 * (`quizFromSeen`).
 *
 * @param frame - The quiz without its questions.
 * @param seenFor - Each question's reading, by row id: undefined while on its way, null when gone.
 * @param was - The quiz the last assembly of this quiz came to; null for none.
 * @returns The quiz, or undefined.
 *
 * @example assembledQuiz(frame, (question_id) => byId[question_id], null)?.questions.length
 */
export function assembledQuiz(frame: QuizFrameT, seenFor: (question_id: Id<'questions'>) => SeenQuestionT | null | undefined, was: QuizT | null = null): QuizT | undefined {
  const seen = frame.row_ordering.map((question_id) => seenFor(question_id))
  if (seen.includes(undefined)) { return undefined }
  return quizFromSeen(frame, seen.filter((question) => question !== null && question !== undefined), was)
}

/** A widget of the library, from its row: its fields, without its place */
export function widgetFrom(row: Doc<'widgets'>): WidgetT {
  const { scope, label, title, description, input_formula } = row
  const shared = { scope, label, title, description, input_formula }
  switch (row.formulary) {
  case 'jsonata': { return { ...shared, formulary: 'jsonata', formula: row.formula, config: row.config } }
  case 'aibot':   { return { ...shared, formulary: 'aibot', formula: row.formula, config: row.config } }
  case 'entry':   { return { ...shared, formulary: 'entry', formula: '', input_formula: '', config: row.config } }
  case 'liquidize': { return { ...shared, formulary: 'liquidize', formula: row.formula, config: row.config } }
  }
}

/** A widgeting, from its row: its fields, without its quiz or its place */
export function widgetingFrom(row: Doc<'widgetings'>): WidgetingT {
  const { widget_label, label, description, params, tier } = row
  return { widget_label, label, description, params, tier }
}

/**
 * A backfill's status, as the stats page says it, from what the migrations component reports.
 *
 * @param status - The component's status of one migration.
 * @param defined - Whether `migrations.ts` still defines it.
 *
 * @example backfillFrom({ name: 'migrations:backfillHuntOrglabels', state: 'success', isDone: true, processed: 37, latestStart: 1759700000000, latestEnd: 1759700001000, cursor: 'xyz' }, true)
 *   // => { fnname: 'migrations:backfillHuntOrglabels', defined: true, state: 'success', is_done: true, processed: 37, started_at: 1759700000000, ended_at: 1759700001000 }
 * @example backfillFrom({ name: 'migrations:backfillHuntOrglabels', state: 'unknown', isDone: false, processed: 0, latestStart: 0 }, true)
 *   // => { ..., state: 'unknown', processed: 0, started_at: null, ended_at: null }
 */
export function backfillFrom(status: MigrationStatus, defined: boolean): BackfillStatusT {
  return {
    fnname:     status.name,
    defined,
    state:      status.state,
    is_done:    status.isDone,
    processed:  status.processed,
    started_at: status.latestStart > 0 ? status.latestStart : null,
    ended_at:   status.latestEnd ?? null,
  }
}

/**
 * The backfills the stats page lists: each one still defined, in the order given, then those of
 * `recent` no longer defined, newest first, at most `pastMax` of them.
 *
 * @param defined - The component's status of each backfill still defined, in the order they run.
 * @param recent - Its status of the migrations it remembers, oldest first, as `getStatus` with a limit hands them back.
 * @param pastMax - How many no longer defined to list.
 *
 * @example backfillsFrom([orgs], [quizCopies, orgs, huntBranches], 20)
 *   // => [orgs (defined), huntBranches (history), quizCopies (history)]
 */
export function backfillsFrom(defined: readonly MigrationStatus[], recent: readonly MigrationStatus[], pastMax: number): BackfillStatusT[] {
  const fnnames = new Set(defined.map((status) => status.name))
  const past    = recent.filter((status) => ! fnnames.has(status.name)).slice(-pastMax).toReversed()
  return [
    ...defined.map((status) => backfillFrom(status, true)),
    ...past.map((status) => backfillFrom(status, false)),
  ]
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
 * A hunt as the hunts list shows it: titled, addressed under its org, stamped, with its realms in order,
 * each titled and holding its quizzes' rows by label, in code-unit order, as the hunt's files
 * sort them: every list of quizzes the app shows is in this order.
 *
 * @param rows - The hunt's own rows.
 * @returns The listing.
 *
 * @example huntListingOf(rows).realms[0].quizzes.length
 */
export function huntListingOf(rows: Pick<HuntRows, 'hunt' | 'realms'>): HuntListingT {
  const { _id, label } = rows.hunt
  return {
    _id,
    label,
    org:    rows.hunt.orglabel,
    title:  huntTitleOf(rows.hunt),
    branch: rows.hunt.branch,
    ...Stamps.of(rows.hunt),
    realms: rows.realms.map(({ realm, quizzes }) => ({
      _id:     realm._id,
      label:   realm.label,
      title:   realmTitleOf(realm),
      quizzes: quizzes.toSorted((aa, bb) => Tsv.byCode(aa.label, bb.label)).map((quiz) => _.omit(quiz, ['row_ordering'])),
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
