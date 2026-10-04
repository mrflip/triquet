import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { formularyFor } from '../src/lib/formulary/formularies'
import * as PA from '../src/lib/vv/patterns'
import { huntFrom, quizFrom, type CellRows, type HuntRows, type LayoutRows, type MemberT, type QuizRows, type RealmRows, type StoredRows, type WidgetUsageT } from '../src/lib/rows'
import type { HuntT } from '../src/models/hunt'
import type { QuizT } from '../src/models/quiz'

// Every read here goes through an index, and takes at most the cap `lib/vv/patterns.ts` sets for
// that kind of child, which the writes refuse to pass: a read never silently drops a row. A
// quiz's questions are read by id, in the order the quiz holds them, which the same cap bounds.
// One read is not capped: a stored cell's history, walked newest first and stopped at the first
// `ok` row, so it reads one row, plus one per failure since.
//
// A row carries copies of what policy needs from its parents (`notes/convex.md`, *Denormalized
// fields*), so the hunt a row belongs to is on the row. A row written before it carried its copies
// has its parent read for them instead, until `migrations.ts` has backfilled it.

/** What a query or a mutation reads through */
export type Reader = QueryCtx['db']

/** The ident the session `user_id` asserted last, by its newest identing; null when it has asserted none */
export async function identFor(db: Reader, user_id: Id<'users'>): Promise<Doc<'idents'> | null> {
  const identing = await db.query('identings').withIndex('by_user_id', (cvx) => cvx.eq('user_id', user_id)).order('desc').first()
  return identing && await db.get('idents', identing.ident_id)
}

/** The ident answering to `label`: the earliest made, should two have been made with one */
export async function identForLabel(db: Reader, label: string): Promise<Doc<'idents'> | null> {
  return await db.query('idents').withIndex('by_label', (cvx) => cvx.eq('label', label)).first()
}

/**
 * The hunt answering to `label`: the earliest made, should two answer to one.
 *
 * @example (await huntForLabel(db, 'quiet_otter'))?._id
 */
export async function huntForLabel(db: Reader, label: string): Promise<Doc<'hunts'> | null> {
  return await db.query('hunts').withIndex('by_label', (cvx) => cvx.eq('label', label)).first()
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
  const members = await Promise.all(huntings.map(async (hunting) => await memberOf(db, hunting)))
  return members.filter((member) => member !== null)
}

/** One hunting as a member: its ident's label and title as it holds them, or as its ident does for a hunting not yet backfilled; null when that ident is gone */
async function memberOf(db: Reader, hunting: Doc<'huntings'>): Promise<MemberT | null> {
  const { ident_id, ident_label, ident_title, role } = hunting
  if (ident_label !== undefined && ident_title !== undefined) { return { ident_id, label: ident_label, title: ident_title, role } }
  const ident = await db.get('idents', ident_id)
  return ident && { ident_id, label: ident.label, title: ident.title, role }
}

/** A hunt's realms in order, each with its quizzes' rows in the order they were made */
export async function realmsOf(db: Reader, hunt_id: Id<'hunts'>): Promise<RealmRows[]> {
  const realms = await db.query('realms').withIndex('by_hunt_id_and_position', (cvx) => cvx.eq('hunt_id', hunt_id)).take(PA.RealmsPerHunt.max)
  return await Promise.all(realms.map(async (realm) => ({ realm, quizzes: await quizzesOf(db, realm._id) })))
}

/**
 * The hunt `quiz` belongs to: the one it names, or for a quiz not yet backfilled, its realm's.
 * Null when that realm is gone.
 *
 * @example await huntIdOf(ctx.db, quiz)  // => quiz.hunt_id, read from no other row once backfilled
 */
export async function huntIdOf(db: Reader, quiz: Pick<Doc<'quizzes'>, 'hunt_id' | 'realm_id'>): Promise<Id<'hunts'> | null> {
  if (quiz.hunt_id !== undefined) { return quiz.hunt_id }
  const realm = await db.get('realms', quiz.realm_id)
  return realm?.hunt_id ?? null
}

/**
 * The hunt a widgeting or column belongs to: the one it names, or for one not yet backfilled, its
 * quiz's. Null when that quiz is gone, or its realm.
 */
export async function huntIdOfLayoutRow(db: Reader, row: Pick<Doc<'widgetings'> | Doc<'columns'>, 'hunt_id' | 'quiz_id'>): Promise<Id<'hunts'> | null> {
  if (row.hunt_id !== undefined) { return row.hunt_id }
  const quiz = await db.get('quizzes', row.quiz_id)
  return quiz && await huntIdOf(db, quiz)
}

/** What a reviewing copies from its review */
export type ReviewingCopiesT = Pick<Doc<'reviews'>, 'hunt_id' | 'quiz_id' | 'ident_id'>

/**
 * The hunt, quiz and writer of the review `reviewing` is part of: as it holds them, or for one not
 * yet backfilled, as its review does. Null when that review is gone.
 */
export async function reviewingCopiesOf(db: Reader, reviewing: Doc<'reviewings'>): Promise<ReviewingCopiesT | null> {
  const { hunt_id, quiz_id, ident_id } = reviewing
  if (hunt_id !== undefined && quiz_id !== undefined && ident_id !== undefined) { return { hunt_id, quiz_id, ident_id } }
  const review = await db.get('reviews', reviewing.review_id)
  return review && { hunt_id: review.hunt_id, quiz_id: review.quiz_id, ident_id: review.ident_id }
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
  const hunt_ids = await Promise.all(counted.map(async (widgeting) => await huntIdOfLayoutRow(db, widgeting)))
  const hunts = new Set(hunt_ids.filter((hunt_id) => hunt_id !== null))
  return { widgetings: counted.length, quizzes: quiz_ids.size, hunts: hunts.size, at_least: read.length > counted.length }
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
  const whole = await Promise.all(quizzes.map(async (quiz) => await quizRowsOf(db, quiz._id)))
  const quizFor = new Map<string, QuizT>(whole.filter((each) => each !== null).map((each) => [each.quiz._id, quizFrom(each)]))
  return huntFrom(rows, quizFor)
}

/** A quiz's widgetings, in run order */
export async function widgetingsOf(db: Reader, quiz_id: Id<'quizzes'>): Promise<Doc<'widgetings'>[]> {
  return await db.query('widgetings').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz_id)).take(PA.WidgetingsPerQuiz.max)
}

/**
 * One cell's history, as far as the cell needs it: the newest row, and the newest `ok` one.
 * Walks the cell newest first and stops at the first `ok`, so it reads one row for a cell whose
 * last ask answered, and one more for each failure since.
 *
 * @returns The history; null for a cell with nothing recorded.
 */
export async function cellRowsOf(db: Reader, question_id: Id<'questions'>, widgeting_id: Id<'widgetings'>): Promise<CellRows | null> {
  const history = db.query('widgeteds')
    .withIndex('by_question_id_and_widgeting_id', (cvx) => cvx.eq('question_id', question_id).eq('widgeting_id', widgeting_id))
    .order('desc')
  const seen: { newest: Doc<'widgeteds'> | null } = { newest: null }
  for await (const widgeted of history) {
    seen.newest ??= widgeted
    if (widgeted.status === 'ok') { return { newest: seen.newest, ok: widgeted } }
  }
  return seen.newest && { newest: seen.newest, ok: null }
}

/**
 * What `question` stored for each of `widgetings`, by the widgeting's label. A widgeting with
 * nothing recorded for it (a `jsonata` one always) is absent.
 */
export async function storedOf(db: Reader, question_id: Id<'questions'>, widgetings: readonly Doc<'widgetings'>[]): Promise<StoredRows> {
  const cells = await Promise.all(widgetings.map(async (widgeting) => await cellRowsOf(db, question_id, widgeting._id)))
  return new Map(widgetings.flatMap((widgeting, idx) => {
    const cell = cells[idx]
    return cell ? [[widgeting.label, cell] as const] : []
  }))
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
 * widgetings whose formulary stores are read (never a `jsonata` one): one index range per
 * question each, which a whole quiz must keep within a transaction's bound.
 *
 * @example (await allStoredOf(db, questions, widgetings)).get(question._id)?.get('dumdum')?.ok?.value
 */
export async function allStoredOf(db: Reader, questions: readonly Doc<'questions'>[], widgetings: readonly Doc<'widgetings'>[]): Promise<Map<string, StoredRows>> {
  const library = await libraryOf(db)
  const storing = new Set(library.filter((widget) => formularyFor(widget).store !== null).map((widget) => widget.label))
  const stores = widgetings.filter((widgeting) => storing.has(widgeting.widget_label))
  const stored = await Promise.all(questions.map(async (question) => await storedOf(db, question._id, stores)))
  return new Map(questions.map((question, idx) => [question._id, stored[idx] ?? new Map()]))
}

/**
 * One quiz's rows: its own, its questions, widgetings and columns in their committed order, and
 * what each question stored.
 *
 * @returns The rows, or null when there is no such quiz.
 *
 * @example (await quizRowsOf(db, quiz_id))?.questions.length
 */
export async function quizRowsOf(db: Reader, quiz_id: Id<'quizzes'>): Promise<QuizRows | null> {
  const layout = await layoutRowsOf(db, quiz_id)
  if (! layout) { return null }
  const questions = await questionsOf(db, layout.quiz)
  return { ...layout, questions, stored: await allStoredOf(db, questions, layout.widgetings) }
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
