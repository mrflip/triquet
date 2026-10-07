import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { formularyFor } from '../src/lib/formulary/formularies'
import * as PA from '../src/lib/vv/patterns'
import { huntFrom, quizFrom, widgetingFrom, type CellRows, type HuntRows, type LayoutRows, type MemberT, type QuizRows, type RealmRows, type StoredRowT, type StoredRows, type WidgetUsageT } from '../src/lib/rows'
import type { WidgetingTier } from '../src/models/widgeting'
import type { HuntT } from '../src/models/hunt'
import type { QuizT } from '../src/models/quiz'

// Every read here goes through an index, and takes at most the cap `lib/vv/patterns.ts` sets for
// that kind of child, which the writes refuse to pass: a read never silently drops a row. A
// quiz's questions are read by id, in the order the quiz holds them, which the same cap bounds.
// One read is not capped: a stored cell's history, walked newest first and stopped at the first
// `ok` row, so it reads one row, plus one per failure since.
//
// A row carries copies of what policy needs from its parents (`notes/convex.md`, *Denormalized
// fields*), so the hunt a row belongs to is on the row.

/** What a query or a mutation reads through */
export type Reader = QueryCtx['db']

/**
 * The ident the session `user_id` asserted last, by its newest identing, while the session still
 * holds it; null when it has asserted none, or when that ident is no longer its own (held by
 * another session, or by none). No write of the app takes an ident from its holder, but an
 * identing alone never makes a session an ident it does not hold.
 */
export async function identFor(db: Reader, user_id: Id<'users'>): Promise<Doc<'idents'> | null> {
  const identing = await db.query('identings').withIndex('by_user_id', (cvx) => cvx.eq('user_id', user_id)).order('desc').first()
  const ident = identing && await db.get('idents', identing.ident_id)
  return ident?.user_id === user_id ? ident : null
}

/** The ident answering to `label`: the earliest made, should two have been made with one */
export async function identForLabel(db: Reader, label: string): Promise<Doc<'idents'> | null> {
  return await db.query('idents').withIndex('by_label', (cvx) => cvx.eq('label', label)).first()
}

/**
 * The hunt answering to `label` alone, whatever its org: the earliest made, should several. Only
 * an old address (`/h/<hunt>`), which names no org, finds a hunt this way; everything else names
 * the org too (`huntInOrg`).
 *
 * @example (await huntForLabel(db, 'quiet_otter'))?._id
 */
export async function huntForLabel(db: Reader, label: string): Promise<Doc<'hunts'> | null> {
  return await db.query('hunts').withIndex('by_label', (cvx) => cvx.eq('label', label)).first()
}

/**
 * The hunt of the org `orglabel` answering to `label`: the earliest made, should two.
 *
 * @example (await huntInOrg(db, 'pat_smith', 'quiet_otter'))?._id
 */
export async function huntInOrg(db: Reader, orglabel: string, label: string): Promise<Doc<'hunts'> | null> {
  return await db.query('hunts').withIndex('by_orglabel_and_label', (cvx) => cvx.eq('orglabel', orglabel).eq('label', label)).first()
}

/** Every hunt, in the order they were made */
export async function huntsOf(db: Reader): Promise<Doc<'hunts'>[]> {
  return await db.query('hunts').take(PA.HuntsInApp.max)
}

/** A hunt's huntings, in the order they were made */
export async function huntingsOf(db: Reader, hunt_id: Id<'hunts'>): Promise<Doc<'huntings'>[]> {
  return await db.query('huntings').withIndex('by_hunt_id', (cvx) => cvx.eq('hunt_id', hunt_id)).take(PA.HuntingsPerHunt.max)
}

/** An ident's huntings, one per hunt it is on at most, which the app's cap on hunts bounds */
export async function huntingsFor(db: Reader, ident_id: Id<'idents'>): Promise<Doc<'huntings'>[]> {
  return await db.query('huntings').withIndex('by_ident_id_and_hunt_id', (cvx) => cvx.eq('ident_id', ident_id)).take(PA.HuntsInApp.max)
}

/** The hunting `ident_id` has on `hunt_id`, and so its role there; null when it is not on the hunt */
export async function huntingFor(db: Reader, hunt_id: Id<'hunts'>, ident_id: Id<'idents'>): Promise<Doc<'huntings'> | null> {
  return await db.query('huntings').withIndex('by_ident_id_and_hunt_id', (cvx) => cvx.eq('ident_id', ident_id).eq('hunt_id', hunt_id)).first()
}

/** A hunt's huntings, in the order they were made, each with the label and title of its ident, as the hunting holds them */
export async function membersOf(db: Reader, hunt_id: Id<'hunts'>): Promise<MemberT[]> {
  const huntings = await huntingsOf(db, hunt_id)
  return huntings.map(({ ident_id, ident_label, ident_title, role }) => ({ ident_id, label: ident_label, title: ident_title, role }))
}

/** A hunt's realms in order, each with its quizzes' rows in the order they were made */
export async function realmsOf(db: Reader, hunt_id: Id<'hunts'>): Promise<RealmRows[]> {
  const realms = await db.query('realms').withIndex('by_hunt_id_and_position', (cvx) => cvx.eq('hunt_id', hunt_id)).take(PA.RealmsPerHunt.max)
  return await Promise.all(realms.map(async (realm) => ({ realm, quizzes: await quizzesOf(db, realm._id) })))
}

/** A realm's quizzes' rows, in the order they were made */
export async function quizzesOf(db: Reader, realm_id: Id<'realms'>): Promise<Doc<'quizzes'>[]> {
  return await db.query('quizzes').withIndex('by_realm_id', (cvx) => cvx.eq('realm_id', realm_id)).take(PA.QuizzesPerRealm.max)
}

/** The quiz of `realm_id` answering to `label`: the earliest made, should two answer to one; null when none does */
export async function quizForLabel(db: Reader, realm_id: Id<'realms'>, label: string): Promise<Doc<'quizzes'> | null> {
  return await db.query('quizzes').withIndex('by_realm_id_and_label', (cvx) => cvx.eq('realm_id', realm_id).eq('label', label)).first()
}

/** The library: every `pub` widget, in the order it lists them */
export async function libraryOf(db: Reader): Promise<Doc<'widgets'>[]> {
  return await db.query('widgets').withIndex('by_scope_and_position', (cvx) => cvx.eq('scope', 'pub')).take(PA.WidgetsInLibrary.max)
}

/** The library's widget labelled `label`: the earliest made, should two have been; null when there is none */
export async function widgetForLabel(db: Reader, label: string): Promise<Doc<'widgets'> | null> {
  return await db.query('widgets').withIndex('by_scope_and_label', (cvx) => cvx.eq('scope', 'pub').eq('label', label)).first()
}

/** Whether any widgeting, in any quiz of any hunt, works the widget labelled `widget_label` */
export async function isWorked(db: Reader, widget_label: string): Promise<boolean> {
  return (await db.query('widgetings').withIndex('by_widget_label', (cvx) => cvx.eq('widget_label', widget_label)).first()) !== null
}

/**
 * What a write must know of every hunt to keep the data whole, asked of a database that sees them
 * all: whose a hunt label is in an org, so no two hunts of one org answer to one; and whether any quiz of any hunt works
 * a widget, so none is left working a widget the library lost. It answers with an id or a yes,
 * never a row, so a function whose database sees one hunt, or only the library (`policy_rules.ts`),
 * can hold it.
 */
export type CensusT = {
  /** The hunt of the org `orglabel` answering to `label`, should one: see `huntInOrg` */
  huntIdInOrg:    (orglabel: string, label: string) => Promise<Id<'hunts'> | null>
  /** Whether any widgeting works the widget labelled `widget_label`: see `isWorked` */
  isWorked:       (widget_label: string) => Promise<boolean>
}

/**
 * The census of `db`, a database that sees every hunt.
 *
 * @example await censusOf(ctx.db).huntIdInOrg('pat_smith', 'quiet_otter')  // => the hunt's id, or null
 */
export function censusOf(db: Reader): CensusT {
  return {
    huntIdInOrg:    async (orglabel, label) => {
      const hunt = await huntInOrg(db, orglabel, label)
      return hunt?._id ?? null
    },
    isWorked:       async (widget_label) => await isWorked(db, widget_label),
  }
}

/**
 * How far the widget labelled `widget_label` is put to work: by how many widgetings, across how
 * many quizzes, in how many hunts. Counts only. At most `WidgetingsCounted` widgetings are read;
 * past that many, every count is a floor, and says so. A widget nobody works counts nothing.
 *
 * @example await usageOf(db, 'dumdum')  // => { widgetings: 3, quizzes: 2, hunts: 1, at_least: false }
 */
export async function usageOf(db: Reader, widget_label: string): Promise<WidgetUsageT> {
  const read = await db.query('widgetings').withIndex('by_widget_label', (cvx) => cvx.eq('widget_label', widget_label)).take(PA.WidgetingsCounted.max + 1)
  const counted = read.slice(0, PA.WidgetingsCounted.max)
  const quiz_ids = new Set(counted.map((widgeting) => widgeting.quiz_id))
  const hunt_ids = new Set(counted.map((widgeting) => widgeting.hunt_id))
  return { widgetings: counted.length, quizzes: quiz_ids.size, hunts: hunt_ids.size, at_least: read.length > counted.length }
}

/**
 * One hunt's own rows: its row, and its realms in order with their quizzes' rows.
 *
 * @returns The rows, or null when there is no such hunt.
 */
export async function huntRowsOf(db: Reader, hunt_id: Id<'hunts'>): Promise<HuntRows | null> {
  const hunt = await db.get('hunts', hunt_id)
  if (! hunt) { return null }
  return { hunt, realms: await realmsOf(db, hunt_id) }
}

/**
 * One hunt, every quiz whole, as its rows make it up: what the Export box emits.
 *
 * @returns The hunt, or null when there is no such hunt.
 */
export async function wholeHuntOf(db: Reader, hunt_id: Id<'hunts'>): Promise<HuntT | null> {
  const rows = await huntRowsOf(db, hunt_id)
  if (! rows) { return null }
  const quizzes = rows.realms.flatMap((realm) => realm.quizzes)
  const whole = await Promise.all(quizzes.map(async (quiz) => await wholeQuizOf(db, quiz)))
  return huntFrom(rows, new Map<string, QuizT>(whole.map((quiz) => [quiz._id, quiz])))
}

/** A quiz's widgetings, in run order */
export async function widgetingsOf(db: Reader, quiz_id: Id<'quizzes'>): Promise<Doc<'widgetings'>[]> {
  return await db.query('widgetings').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz_id)).take(PA.WidgetingsPerQuiz.max)
}

/** The widgetings of `widgetings` that run at `tier` */
function atTier(widgetings: readonly Doc<'widgetings'>[], tier: WidgetingTier): Doc<'widgetings'>[] {
  return widgetings.filter((row) => widgetingFrom(row).tier === tier)
}

/**
 * One cell's history, as far as the cell needs it, from its rows newest first: the newest row,
 * and the newest `ok` one. Stops at the first `ok`, so it reads one row for a cell whose last ask
 * answered, and one more for each failure since.
 */
async function historyIn(rows: AsyncIterable<StoredRowT>): Promise<CellRows | null> {
  const seen: { newest: StoredRowT | null } = { newest: null }
  for await (const widgeted of rows) {
    seen.newest ??= widgeted
    if (widgeted.status === 'ok') { return { newest: seen.newest, ok: widgeted } }
  }
  return seen.newest && { newest: seen.newest, ok: null }
}

/**
 * One cell's history, as far as the cell needs it: the newest row, and the newest `ok` one.
 * Walks the cell newest first and stops at the first `ok`, so it reads one row for a cell whose
 * last ask answered, and one more for each failure since.
 *
 * @returns The history; null for a cell with nothing recorded.
 */
export async function cellRowsOf(db: Reader, question_id: Id<'questions'>, widgeting_id: Id<'widgetings'>): Promise<CellRows | null> {
  return await historyIn(db.query('widgeteds')
    .withIndex('by_question_id_and_widgeting_id', (cvx) => cvx.eq('question_id', question_id).eq('widgeting_id', widgeting_id))
    .order('desc'))
}

/**
 * The quiz's own cell of a widgeting run once for the whole quiz, as `cellRowsOf` reads a
 * question's.
 *
 * @returns The history; null for a cell with nothing recorded.
 */
export async function quizCellRowsOf(db: Reader, quiz_id: Id<'quizzes'>, widgeting_id: Id<'widgetings'>): Promise<CellRows | null> {
  return await historyIn(db.query('quiz_widgeteds')
    .withIndex('by_quiz_id_and_widgeting_id', (cvx) => cvx.eq('quiz_id', quiz_id).eq('widgeting_id', widgeting_id))
    .order('desc'))
}

/** Each of `widgetings` that has a cell, by its label, with the cell `cellOf` reads for it */
async function cellsByLabel(widgetings: readonly Doc<'widgetings'>[], cellOf: (widgeting: Doc<'widgetings'>) => Promise<CellRows | null>): Promise<StoredRows> {
  const cells = await Promise.all(widgetings.map(async (widgeting) => await cellOf(widgeting)))
  return new Map(widgetings.flatMap((widgeting, idx) => {
    const cell = cells[idx]
    return cell ? [[widgeting.label, cell] as const] : []
  }))
}

/**
 * What `question` stored for each of `widgetings` that runs for each question, by the
 * widgeting's label. A widgeting with nothing recorded for it (a `jsonata` one always) is absent.
 */
export async function storedOf(db: Reader, question_id: Id<'questions'>, widgetings: readonly Doc<'widgetings'>[]): Promise<StoredRows> {
  return await cellsByLabel(atTier(widgetings, 'question'), async (widgeting) => await cellRowsOf(db, question_id, widgeting._id))
}

/**
 * What the quiz `quiz_id` stored for each of `widgetings` that runs once for the whole quiz and
 * stores, by the widgeting's label: one index range each. One with nothing recorded is absent.
 *
 * @example (await quizStoredOf(db, quiz._id, widgetings)).get('playtesters')?.ok?.value  // => 'Ada and Grace'
 */
export async function quizStoredOf(db: Reader, quiz_id: Id<'quizzes'>, widgetings: readonly Doc<'widgetings'>[]): Promise<StoredRows> {
  const stores = await storingOf(db, atTier(widgetings, 'quiz'))
  return await cellsByLabel(stores, async (widgeting) => await quizCellRowsOf(db, quiz_id, widgeting._id))
}

/** The widgetings of `widgetings` whose formulary stores (never a `jsonata` one), by the library */
async function storingOf(db: Reader, widgetings: readonly Doc<'widgetings'>[]): Promise<Doc<'widgetings'>[]> {
  if (widgetings.length === 0) { return [] }
  const library = await libraryOf(db)
  const storing = new Set(library.filter((widget) => formularyFor(widget).store !== null).map((widget) => widget.label))
  return widgetings.filter((widgeting) => storing.has(widgeting.widget_label))
}

/** A quiz's questions, in the quiz's order, each read by its id */
export async function questionsOf(db: Reader, quiz: Doc<'quizzes'>): Promise<Doc<'questions'>[]> {
  const questions = await Promise.all(quiz.row_ordering.map(async (question_id) => await db.get('questions', question_id)))
  return questions.filter((question) => question !== null)
}

/**
 * The question `question_id` of the quiz `quiz_id`: null when there is no such question, or it
 * is another quiz's.
 */
export async function questionOf(db: Reader, quiz_id: Id<'quizzes'>, question_id: Id<'questions'>): Promise<Doc<'questions'> | null> {
  const question = await db.get('questions', question_id)
  return question?.quiz_id === quiz_id ? question : null
}

/**
 * One quiz's own row, and its widgetings and columns in their committed order: everything a quiz
 * holds but its questions.
 *
 * @returns The rows, or null when there is no such quiz.
 */
export async function layoutRowsOf(db: Reader, quiz_id: Id<'quizzes'>): Promise<LayoutRows | null> {
  const quiz = await db.get('quizzes', quiz_id)
  return quiz && await layoutOf(db, quiz)
}

/**
 * The quiz `quiz`, a row already in hand, with its widgetings and columns in their committed
 * order: as `layoutRowsOf`, reading nothing of the quiz itself.
 *
 * @example const { widgetings, columns } = await layoutOf(ctx.db, claims.quiz)
 */
export async function layoutOf(db: Reader, quiz: Doc<'quizzes'>): Promise<LayoutRows> {
  const [widgetings, columns] = await Promise.all([
    widgetingsOf(db, quiz._id),
    db.query('columns').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz._id)).take(PA.ColumnsPerQuiz.max),
  ])
  return { quiz, widgetings, columns }
}

/**
 * What each of `questions` stored for each of `widgetings`, by the question's id. Only the
 * widgetings that run for each question and whose formulary stores are read (never a `jsonata`
 * one): one index range per question each, which a whole quiz must keep within a transaction's
 * bound.
 *
 * @example (await allStoredOf(db, questions, widgetings)).get(question._id)?.get('dumdum')?.ok?.value
 */
export async function allStoredOf(db: Reader, questions: readonly Doc<'questions'>[], widgetings: readonly Doc<'widgetings'>[]): Promise<Map<string, StoredRows>> {
  const stores = await storingOf(db, atTier(widgetings, 'question'))
  const stored = await Promise.all(questions.map(async (question) => await storedOf(db, question._id, stores)))
  return new Map(questions.map((question, idx) => [question._id, stored[idx] ?? new Map()]))
}

/**
 * One quiz's rows: its own, its questions, widgetings and columns in their committed order, what
 * each question stored, and what the quiz itself stored.
 *
 * @returns The rows, or null when there is no such quiz.
 *
 * @example (await quizRowsOf(db, quiz_id))?.questions.length
 */
export async function quizRowsOf(db: Reader, quiz_id: Id<'quizzes'>): Promise<QuizRows | null> {
  const quiz = await db.get('quizzes', quiz_id)
  return quiz && await quizRowsFor(db, quiz)
}

/**
 * The rows of `quiz`, a row already in hand: as `quizRowsOf`, reading nothing of the quiz itself.
 *
 * @example (await quizRowsFor(ctx.db, claims.quiz)).questions.length
 */
export async function quizRowsFor(db: Reader, quiz: Doc<'quizzes'>): Promise<QuizRows> {
  const [layout, questions] = await Promise.all([layoutOf(db, quiz), questionsOf(db, quiz)])
  const [stored, quizStored] = await Promise.all([allStoredOf(db, questions, layout.widgetings), quizStoredOf(db, quiz._id, layout.widgetings)])
  return { ...layout, questions, stored, quizStored }
}

/**
 * `quiz`, a row already in hand, whole, as a smith reads it (`quizFrom`): its fields, its
 * questions with what they stored, and its widgetings and columns. What the export holds of it.
 *
 * @example (await wholeQuizOf(ctx.db, claims.quiz)).questions.length
 */
export async function wholeQuizOf(db: Reader, quiz: Doc<'quizzes'>): Promise<QuizT> {
  return quizFrom(await quizRowsFor(db, quiz))
}

/** A quiz's reviews, oldest first: the order two reviews by one ident are settled by */
export async function reviewsOf(db: Reader, quiz_id: Id<'quizzes'>): Promise<Doc<'reviews'>[]> {
  return await db.query('reviews').withIndex('by_quiz_id', (cvx) => cvx.eq('quiz_id', quiz_id)).take(PA.ReviewsPerQuiz.max)
}

/** The review of `quiz_id` that `ident_id` has made, the earliest should two exist; null when none */
export async function reviewFor(db: Reader, quiz_id: Id<'quizzes'>, ident_id: Id<'idents'>): Promise<Doc<'reviews'> | null> {
  return await db.query('reviews').withIndex('by_quiz_id_and_ident_id', (cvx) => cvx.eq('quiz_id', quiz_id).eq('ident_id', ident_id)).first()
}

/** A review's reviewings: at most one per question of its quiz, which the quiz's cap bounds */
export async function reviewingsOf(db: Reader, review_id: Id<'reviews'>): Promise<Doc<'reviewings'>[]> {
  return await db.query('reviewings').withIndex('by_review_id_and_question_id', (cvx) => cvx.eq('review_id', review_id)).take(PA.QuestionsPerQuiz.max)
}

/** The reviewing `review_id` has of `question_id`; null until the reviewer has written to it */
export async function reviewingFor(db: Reader, review_id: Id<'reviews'>, question_id: Id<'questions'>): Promise<Doc<'reviewings'> | null> {
  return await db.query('reviewings').withIndex('by_review_id_and_question_id', (cvx) => cvx.eq('review_id', review_id).eq('question_id', question_id)).first()
}
