import type { Id, TableNames } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { Review, type ReviewPhase } from '../src/models/review'
import { SignalGrainMs, SignalValidators } from '../src/models/signal'

// Every write that changes a quiz's files moves the quiz's change signal (`src/models/signal.ts`),
// here, by a trigger (convex-helpers' Triggers, registered in `triggers.ts`), rather than by each
// writer. The signal is a row of its own, never the quiz's: every reader of the quiz row (the
// screen's frame among them) would rerun at every write to its questions otherwise.
//
// A burst of writes moves it once per grain (`SignalGrainMs`): a write finding it moved within
// that long leaves it standing, so a bot run of forty answers moves it a handful of times, not
// forty. Every write to a quiz reads its signal, so a write that moves it conflicts with the
// writes to that quiz running beside it, which Convex retries; once per grain, not once per write.

/**
 * The tables whose rows make up a quiz's files: the quiz, its questions, widgetings and columns,
 * what its widgetings stored, and its reviews and their verdicts (only the shared ones are written,
 * so only a shared review's writes move the signal).
 */
export const SignalledTables = ['quizzes', 'questions', 'widgetings', 'columns', 'widgeteds', 'reviews', 'reviewings'] as const satisfies readonly TableNames[]
export type SignalledTablename = typeof SignalledTables[number]

/** A row of a signalled table, as far as the trigger reads it: its hunt, and its quiz, review or phase where it has one */
type SignalledRowT = { hunt_id: Id<'hunts'>, quiz_id?: Id<'quizzes'>, review_id?: Id<'reviews'>, phase?: ReviewPhase }

/** A write that landed on a row of a signalled table, as a trigger is told it: the row as it stood (null for an insert) and as it stands (null for a deletion) */
type SignalledChangeT = { id: string, operation: 'insert' | 'update' | 'delete', oldDoc: SignalledRowT | null, newDoc: SignalledRowT | null }

/** The quiz a write is to, by the hunt it is of */
type QuizOfT = { hunt_id: Id<'hunts'>, quiz_id: Id<'quizzes'> }

/** The database the trigger reads and writes through: the one beneath the triggers, which runs none again */
type InnerDbT = MutationCtx['db']

/**
 * Whether a signal last moved at `changed_at` is moved by a write at `now`: when it has never
 * moved, or last moved at least `SignalGrainMs` ago.
 *
 * @example isMovedAt(null, 9)                    // => true
 * @example isMovedAt(1000, 1000 + SignalGrainMs - 1)  // => false
 */
export function isMovedAt(changed_at: number | null, now: number): boolean {
  return changed_at === null || now - changed_at >= SignalGrainMs
}

/**
 * Move the signal of the quiz `quiz_id` to `now`, unless it moved within the grain: written once
 * the quiz has one, and made for a quiz that is still there when it has none, so a quiz deleted in
 * the same mutation as its children is left with none.
 *
 * @param db - The database beneath the triggers.
 * @param quiz - The quiz, and the hunt it is of.
 * @param now - The moment of the mutation.
 */
export async function moveSignal(db: InnerDbT, { hunt_id, quiz_id }: QuizOfT, now: number): Promise<void> {
  const held = await db.query('signals').withIndex('by_quiz_id', (cvx) => cvx.eq('quiz_id', quiz_id)).first()
  if (! isMovedAt(held?.changed_at ?? null, now)) { return }
  if (held) {
    await db.patch('signals', held._id, { changed_at: now })
    return
  }
  if (await db.get('quizzes', quiz_id) === null) { return }
  await db.insert('signals', SignalValidators.row.parse({ hunt_id, quiz_id, changed_at: now }))
}

/** Take the signal of the quiz `quiz_id` away with it */
async function dropSignal(db: InnerDbT, quiz_id: Id<'quizzes'>): Promise<void> {
  const held = await db.query('signals').withIndex('by_quiz_id', (cvx) => cvx.eq('quiz_id', quiz_id)).first()
  if (held) { await db.delete('signals', held._id) }
}

/** Whether a review, as it stood or stands, is shared: one the smiths' files hold */
function isShared(review: SignalledRowT | null): boolean {
  return review?.phase !== undefined && Review.isShared({ phase: review.phase })
}

/** The quiz a row is of, by the hunt it is of; null for a row that names none */
function quizOf(row: SignalledRowT): QuizOfT | null {
  return row.quiz_id === undefined ? null : { hunt_id: row.hunt_id, quiz_id: row.quiz_id }
}

/** The quiz a verdict's write changes the files of: its review's, while that review is shared; null for a draft's, or a review gone */
async function quizOfVerdict(db: InnerDbT, review_id: Id<'reviews'> | undefined): Promise<QuizOfT | null> {
  const review = review_id === undefined ? null : await db.get('reviews', review_id)
  return review && isShared(review) ? quizOf(review) : null
}

/**
 * The quiz whose files a write changes, or null for one that changes none: a draft review's write,
 * or its verdicts'. Every signalled row carries its hunt and quiz, but the quiz, which is its own.
 */
async function quizOfChange(db: InnerDbT, tablename: SignalledTablename, change: SignalledChangeT): Promise<QuizOfT | null> {
  const row = change.newDoc ?? change.oldDoc
  if (row === null) { return null }
  switch (tablename) {
  case 'quizzes': {
    const quiz_id = db.normalizeId('quizzes', change.id)
    return quiz_id && { hunt_id: row.hunt_id, quiz_id }
  }
  case 'reviews':    { return isShared(change.oldDoc) || isShared(change.newDoc) ? quizOf(row) : null }
  case 'reviewings': { return await quizOfVerdict(db, row.review_id) }
  default:           { return quizOf(row) }
  }
}

/**
 * The quizzes whose signal each mutation has moved, or found moved within the grain, by the
 * mutation's database: once settled, a signal stands for the rest of the mutation (its moment is
 * one), so a mutation writing a quiz's many rows (an import, a deletion) reads its signal once.
 */
const settledIn = new WeakMap<InnerDbT, Set<Id<'quizzes'>>>()

/**
 * The trigger that moves a quiz's signal at each write landing on a row of `tablename`
 * (`moveSignal`), at the moment of the mutation, through the database beneath the triggers, once
 * per mutation and quiz; and takes a deleted quiz's signal away with it.
 */
export function signalling(tablename: SignalledTablename) {
  return async (ctx: { innerDb: InnerDbT }, change: SignalledChangeT): Promise<void> => {
    const settled = settledIn.get(ctx.innerDb) ?? new Set<Id<'quizzes'>>()
    settledIn.set(ctx.innerDb, settled)
    const deleted = tablename === 'quizzes' && change.operation === 'delete' ? ctx.innerDb.normalizeId('quizzes', change.id) : null
    if (deleted) {
      settled.add(deleted)
      await dropSignal(ctx.innerDb, deleted)
      return
    }
    const quiz = await quizOfChange(ctx.innerDb, tablename, change)
    if (! quiz || settled.has(quiz.quiz_id)) { return }
    settled.add(quiz.quiz_id)
    await moveSignal(ctx.innerDb, quiz, Date.now())
  }
}
