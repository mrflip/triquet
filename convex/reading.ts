import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import * as PA from '../src/lib/vv/patterns'
import { BotSlots, slotkeyOf, type BotSlot } from '../src/models/botting'
import type { HuntRows, LayoutRows, MemberT, QuizRows, RealmRows, SlotRows } from '../src/lib/rows'

// Every read here goes through an index, and takes at most the cap `lib/vv/patterns.ts` sets for
// that kind of child, which the writes refuse to pass: a read never silently drops a row. A
// quiz's questions are read by id, in the order the quiz holds them, which the same cap bounds.

/** What a query or a mutation reads through */
export type Reader = QueryCtx['db']

/** The newest identing a browser has made, and so the ident it is now; null when it has never said */
export async function identFor(db: Reader, browser_key: string): Promise<Doc<'idents'> | null> {
  const identing = await db.query('identings').withIndex('by_browser_key', (cvx) => cvx.eq('browser_key', browser_key)).order('desc').first()
  return identing && await db.get('idents', identing.ident_id)
}

/** The ident answering to `label`: the earliest made, should two have been made with one */
export async function identForLabel(db: Reader, label: string): Promise<Doc<'idents'> | null> {
  return await db.query('idents').withIndex('by_label', (cvx) => cvx.eq('label', label)).first()
}

/**
 * The hunt answering to `label`, by whichever label is in force for it: the earliest made,
 * should two answer to one.
 *
 * @example (await huntForLabel(db, 'quiet_otter'))?._id
 */
export async function huntForLabel(db: Reader, label: string): Promise<Doc<'hunts'> | null> {
  const forced = await db.query('hunts').withIndex('by_forced_label', (cvx) => cvx.eq('forced_label', label)).first()
  const minted = await db.query('hunts').withIndex('by_label', (cvx) => cvx.eq('label', label)).filter((cvx) => cvx.eq(cvx.field('forced_label'), null)).first()
  if (! forced || ! minted) { return forced ?? minted }
  return forced._creationTime < minted._creationTime ? forced : minted
}

/** Every hunt, in the order they were made */
export async function huntsOf(db: Reader): Promise<Doc<'hunts'>[]> {
  return await db.query('hunts').take(PA.HuntsInApp.max)
}

/** A hunt's huntings, in the order they were made */
export async function huntingsOf(db: Reader, hunt_id: Id<'hunts'>): Promise<Doc<'huntings'>[]> {
  return await db.query('huntings').withIndex('by_hunt_id', (qq) => qq.eq('hunt_id', hunt_id)).take(PA.HuntingsPerHunt.max)
}

/** An ident's huntings, one per hunt it is on at most, which the app's cap on hunts bounds */
export async function huntingsFor(db: Reader, ident_id: Id<'idents'>): Promise<Doc<'huntings'>[]> {
  return await db.query('huntings').withIndex('by_ident_id_and_hunt_id', (qq) => qq.eq('ident_id', ident_id)).take(PA.HuntsInApp.max)
}

/** The hunting `ident_id` has on `hunt_id`, and so its role there; null when it is not on the hunt */
export async function huntingFor(db: Reader, hunt_id: Id<'hunts'>, ident_id: Id<'idents'>): Promise<Doc<'huntings'> | null> {
  return await db.query('huntings').withIndex('by_ident_id_and_hunt_id', (qq) => qq.eq('ident_id', ident_id).eq('hunt_id', hunt_id)).first()
}

/** A hunt's huntings, in the order they were made, each with the label and title of its ident */
export async function membersOf(db: Reader, hunt_id: Id<'hunts'>): Promise<MemberT[]> {
  const huntings = await huntingsOf(db, hunt_id)
  const idents = await Promise.all(huntings.map(async (hunting) => await db.get('idents', hunting.ident_id)))
  return huntings.flatMap((hunting, idx) => {
    const ident = idents[idx]
    return ident ? [{ ident_id: hunting.ident_id, label: ident.label, title: ident.title, role: hunting.role }] : []
  })
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

/** A hunt's expressions, in order */
export async function expressionsOf(db: Reader, hunt_id: Id<'hunts'>): Promise<Doc<'expressions'>[]> {
  return await db.query('expressions').withIndex('by_hunt_id_and_position', (cvx) => cvx.eq('hunt_id', hunt_id)).take(PA.ExpressionsPerHunt.max)
}

/**
 * One hunt's own rows: its row, its realms in order with their quizzes' rows, and its expressions.
 *
 * @returns The rows, or null when there is no such hunt.
 */
export async function huntRowsOf(db: Reader, hunt_id: Id<'hunts'>): Promise<HuntRows | null> {
  const hunt = await db.get('hunts', hunt_id)
  if (! hunt) { return null }
  const [realms, expressions] = await Promise.all([realmsOf(db, hunt_id), expressionsOf(db, hunt_id)])
  return { hunt, realms, expressions }
}

/** A quiz's widgets, in order */
export async function widgetsOf(db: Reader, quiz_id: Id<'quizzes'>): Promise<Doc<'widgets'>[]> {
  return await db.query('widgets').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz_id)).take(PA.WidgetsPerQuiz.max)
}

/**
 * How many widgets, across every quiz of the hunt, work each expression.
 *
 * @returns Counts by expression label; an expression no widget works is absent.
 */
export async function expressionUsageOf(db: Reader, realms: readonly RealmRows[]): Promise<Map<string, number>> {
  const quizzes = realms.flatMap((realm) => realm.quizzes)
  const widgetlists = await Promise.all(quizzes.map(async (quiz) => await widgetsOf(db, quiz._id)))
  const usage = new Map<string, number>()
  for (const widget of widgetlists.flat()) {
    if (widget.kind === 'expressing') {
      usage.set(widget.expression_label, (usage.get(widget.expression_label) ?? 0) + 1)
    }
  }
  return usage
}

/**
 * One cell's history, as far as the cell needs it: the newest botting, and the newest that
 * answered. Walks the cell newest first and stops at the first answer, so it reads one row for a
 * cell whose last ask answered, and one more for each failure since.
 *
 * @returns The history; null for a cell never asked.
 */
async function slotRowsOf(db: Reader, question_id: Id<'questions'>, slot: BotSlot): Promise<SlotRows | null> {
  const history = db.query('bottings')
    .withIndex('by_question_id_and_bot_label_and_textkind', (cvx) => cvx.eq('question_id', question_id).eq('bot_label', slot.bot_label).eq('textkind', slot.textkind))
    .order('desc')
  const seen: { newest: Doc<'bottings'> | null } = { newest: null }
  for await (const botting of history) {
    seen.newest ??= botting
    if (botting.status === 'done') { return { newest: seen.newest, done: botting } }
  }
  return seen.newest && { newest: seen.newest, done: null }
}

/** Each played cell's history of `questions`, by `slotkeyOf`; a cell never asked is absent */
export async function slotsOf(db: Reader, questions: readonly Doc<'questions'>[]): Promise<Map<string, SlotRows>> {
  const cells = questions.flatMap((question) => BotSlots.map((slot) => ({ question_id: question._id, slot })))
  const histories = await Promise.all(cells.map(async ({ question_id, slot }) => await slotRowsOf(db, question_id, slot)))
  return new Map(cells.flatMap(({ question_id, slot }, idx) => {
    const history = histories[idx]
    return history ? [[slotkeyOf({ question_id, ...slot }), history] as const] : []
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
 * One quiz's own row, and its widgets and columns in their committed order: everything a quiz
 * holds but its questions.
 *
 * @returns The rows, or null when there is no such quiz.
 */
export async function layoutRowsOf(db: Reader, quiz_id: Id<'quizzes'>): Promise<LayoutRows | null> {
  const quiz = await db.get('quizzes', quiz_id)
  if (! quiz) { return null }
  const [widgets, columns] = await Promise.all([
    widgetsOf(db, quiz_id),
    db.query('columns').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz_id)).take(PA.ColumnsPerQuiz.max),
  ])
  return { quiz, widgets, columns }
}

/**
 * One quiz's rows: its own, its questions, widgets and columns in their committed order, and
 * each played cell's history.
 *
 * @returns The rows, or null when there is no such quiz.
 *
 * @example (await quizRowsOf(db, quiz_id))?.questions.length
 */
export async function quizRowsOf(db: Reader, quiz_id: Id<'quizzes'>): Promise<QuizRows | null> {
  const layout = await layoutRowsOf(db, quiz_id)
  if (! layout) { return null }
  const questions = await questionsOf(db, layout.quiz)
  return { ...layout, questions, slots: await slotsOf(db, questions) }
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
  return await db.query('reviewings').withIndex('by_review_id_and_question_id', (qq) => qq.eq('review_id', review_id)).take(PA.QuestionsPerQuiz.max)
}

/** The reviewing `review_id` has of `question_id`; null until the reviewer has written to it */
export async function reviewingFor(db: Reader, review_id: Id<'reviews'>, question_id: Id<'questions'>): Promise<Doc<'reviewings'> | null> {
  return await db.query('reviewings').withIndex('by_review_id_and_question_id', (qq) => qq.eq('review_id', review_id).eq('question_id', question_id)).first()
}
