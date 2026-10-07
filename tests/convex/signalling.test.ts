import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { SignalledTables, isMovedAt } from '../../convex/signalling'
import { triggers } from '../../convex/triggers'
import type { HuntActionDNA } from '../../src/models/actions'
import { Hunt } from '../../src/models/hunt'
import { Question } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { SignalGrainMs } from '../../src/models/signal'
import { affirmsOf, callerOf, huntHolding, openTester, seedHunt, type Identified, type Seeded } from '../support/convex'
import { classicLayout } from '../support/layouts'
import { present } from '../support/present'

/** The moment the tests begin writing at */
const Early = Date.UTC(2026, 9, 6, 9)

/** A quiz laid out as every quiz once was, its questions labelled `labels` */
function quizOf(label: string, labels: readonly string[]): QuizT {
  return { ...Quiz.blank('', label), ...classicLayout(), questions: labels.map((qnlabel) => ({ ...Question.blank(), label: qnlabel, title: qnlabel, clueing: `Who was ${qnlabel}?` })) }
}

/** A hunt of two quizzes, princes open and paris beside it, with a reviewer, lee */
async function seeded(): Promise<Seeded & { lee: Identified, paris: Id<'quizzes'>, leon: Id<'questions'> }> {
  const held = await seedHunt(openTester(), huntHolding([quizOf('princes', ['leon', 'nantes']), quizOf('paris', ['louvre'])]), { smith: 'pat_smiths' })
  const lee = await held.join('lee_reviews', 'reviewer')
  const seen = await held.read()
  const paris = present(seen.quizzes.find((quiz) => quiz.label === 'paris'))._id as Id<'quizzes'>
  const leon = present(present(seen.quizzes[0]).questions[0])._id as Id<'questions'>
  return { ...held, lee, paris, leon }
}

/** Each quiz's signal, as its row holds it, by quiz */
async function signalsIn(held: Seeded): Promise<Map<string, number>> {
  const rows = await held.tt.run(async (ctx) => await ctx.db.query('signals').collect())
  return new Map(rows.map((row) => [row.quiz_id, row.changed_at]))
}

/** The quiz `quiz_id`'s signal, as its row holds it; undefined for none */
async function signalOf(held: Seeded, quiz_id: string): Promise<number | undefined> {
  const signals = await signalsIn(held)
  return signals.get(quiz_id)
}

/** The quizzes with a signal */
async function signalled(held: Seeded): Promise<string[]> {
  const signals = await signalsIn(held)
  return signals.keys().toArray()
}

/** Move the clock on past the grain, so the next write moves a signal again */
function laterByGrain(): number {
  const now = Date.now() + SignalGrainMs
  vi.setSystemTime(now)
  return now
}

/** `db`, but counting in `count.reviews` each row of `tablename` it is asked to get */
function countingReads<DT extends object>(db: DT, tablename: string, count: { reviews: number }): DT {
  const get = (db as unknown as { get: (...args: unknown[]) => Promise<unknown> }).get.bind(db)
  const counted = async (...args: unknown[]): Promise<unknown> => {
    if (args[0] === tablename) { count.reviews += 1 }
    return await get(...args)
  }
  return new Proxy(db, { get: (target, key) => (key === 'get' ? counted : Reflect.get(target, key) as unknown) })
}

beforeEach(() => { vi.useFakeTimers({ now: Early, toFake: ['Date'] }) })
afterEach(() => { vi.useRealTimers() })

describe('isMovedAt', () => {
  it("moves a signal never moved, or moved a grain ago or more; not one moved within the grain", () => {
    expect(isMovedAt(null, Early)).to.be.true
    expect(isMovedAt(Early, Early + SignalGrainMs)).to.be.true
    expect(isMovedAt(Early, Early + SignalGrainMs - 1)).to.be.false
    expect(isMovedAt(Early, Early)).to.be.false
  })

  it("reads the doc block's examples", () => {
    expect(isMovedAt(null, 9)).to.be.true
    expect(isMovedAt(1000, 1000 + SignalGrainMs - 1)).to.be.false
  })
})

describe('SignalledTables', () => {
  it("are every table a quiz's files are made from", () => {
    expect(SignalledTables).to.have.members(['quizzes', 'questions', 'widgetings', 'columns', 'widgeteds', 'quiz_widgeteds', 'reviews', 'reviewings'])
  })
})

describe("a quiz's signal", () => {
  it("is made at the first write to a quiz, and moves only once the grain has passed", async () => {
    const held = await seeded()
    expect(await signalled(held)).to.deep.eq([])
    await held.act({ kind: 'edit_question', question_id: held.leon, patch: { clueing: 'Who?' } })
    expect(await signalsIn(held)).to.deep.eq(new Map([[held.open.quiz_id, Early]]))
    vi.setSystemTime(Early + SignalGrainMs - 1)
    await held.act({ kind: 'edit_question', question_id: held.leon, patch: { clueing: 'Who, then?' } })
    expect(await signalOf(held, held.open.quiz_id)).to.eq(Early)
    const later = laterByGrain()
    await held.act({ kind: 'edit_question', question_id: held.leon, patch: { clueing: 'Who, now?' } })
    expect(await signalOf(held, held.open.quiz_id)).to.eq(later)
  })

  const Moving: [string, HuntActionDNA][] = [
    ['the quiz itself retitled', { kind: 'retitle_quiz', title: 'Royal Princes' }],
    ['a question added', { kind: 'add_question' }],
    ['a widgeting added', { kind: 'add_widgeting', widgeting: { widget_label: 'dumdum', label: 'dumdum_again' } }],
    ['a column moved', { kind: 'move_column', label: 'clueing', onto_idx: 0 }],
  ]
  for (const [describes, action] of Moving) {
    it(`moves for ${describes}`, async () => {
      const held = await seeded()
      await held.act(action)
      expect(await signalled(held)).to.include(held.open.quiz_id)
    })
  }

  it("moves for a bot's answer stored", async () => {
    const held = await seeded()
    await held.act({ kind: 'record_widgeted', widgeted: { question_id: held.leon, widgeting_label: 'dumdum', status: 'ok', value: 'Leon?' } })
    expect(await signalsIn(held)).to.deep.eq(new Map([[held.open.quiz_id, Early]]))
  })

  it("moves for its own quiz alone", async () => {
    const held = await seeded()
    const { action: affirms } = await affirmsOf(held.tt, held.smith, { ...held.open, quiz_id: held.paris })
    await callerOf(held.smith).mutation(api.hunts.perform, { affirms, action: { kind: 'retitle_quiz', title: 'Paris, France' } })
    expect(await signalled(held)).to.deep.eq([held.paris])
  })

  it("stands for a draft review's writes, which no file holds, and moves once it is shared and while it is", async () => {
    const held = await seeded()
    const { quiz_id } = held.open
    await held.act({ kind: 'open_review', quiz_id }, held.lee)
    await held.act({ kind: 'set_reviewing', quiz_id, question_id: held.leon, patch: { get_rate: 40 } }, held.lee)
    await held.act({ kind: 'set_overall', quiz_id, overall: 'Unfinished.' }, held.lee)
    expect(await signalled(held)).to.deep.eq([])
    await held.act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, held.lee)
    expect(await signalsIn(held)).to.deep.eq(new Map([[quiz_id, Early]]))
    const later = laterByGrain()
    await held.act({ kind: 'set_reviewing', quiz_id, question_id: held.leon, patch: { get_rate: 60 } }, held.lee)
    expect(await signalOf(held, quiz_id)).to.eq(later)
    const withdrawn = laterByGrain()
    await held.act({ kind: 'set_review_phase', quiz_id, phase: 'draft' }, held.lee)
    expect(await signalOf(held, quiz_id)).to.eq(withdrawn)
  })

  it("reads no verdict's review once its quiz's signal has settled in the mutation", async () => {
    const held = await seeded()
    const { quiz_id } = held.open
    await held.act({ kind: 'open_review', quiz_id }, held.lee)
    await held.act({ kind: 'set_reviewing', quiz_id, question_id: held.leon, patch: { get_rate: 40 } }, held.lee)
    await held.act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, held.lee)
    const read = { reviews: 0, verdicts: 0 }
    await held.tt.run(async (ctx) => {
      const { db } = triggers.wrapDB({ ...ctx, db: countingReads(ctx.db, 'reviews', read) })
      await db.patch('quizzes', quiz_id, { title: 'Royal Princes' })
      const verdicts = await ctx.db.query('reviewings').withIndex('by_question_id', (cvx) => cvx.eq('question_id', held.leon)).collect()
      for (const verdict of verdicts) { await db.delete('reviewings', verdict._id) }
      read.verdicts = verdicts.length
    })
    expect(read.verdicts).to.be.above(0)
    expect(read.reviews).to.eq(0)
  })

  it("goes with its quiz", async () => {
    const held = await seeded()
    const { action: affirms } = await affirmsOf(held.tt, held.smith, { ...held.open, quiz_id: held.paris })
    await callerOf(held.smith).mutation(api.hunts.perform, { affirms, action: { kind: 'retitle_quiz', title: 'Paris, France' } })
    await held.act({ kind: 'retitle_quiz', title: 'Royal Princes' })
    laterByGrain()
    await held.act({ kind: 'delete_quiz', quiz_id: held.paris })
    expect(await signalled(held)).to.deep.eq([held.open.quiz_id])
  })
})

describe('quizzes.signals', () => {
  it("answers a smith of the hunt with each quiz's signal, a quiz never written having none", async () => {
    const held = await seeded()
    await held.act({ kind: 'retitle_quiz', title: 'Royal Princes' })
    const { hunt: affirms } = await affirmsOf(held.tt, held.smith, held.open)
    expect(await held.smith.as.query(api.quizzes.signals, { affirms })).to.deep.eq([{ quiz_id: held.open.quiz_id, changed_at: Early }])
  })

  it("answers nothing to a reviewer of the hunt, nor to one affirming a standing they lack", async () => {
    const held = await seeded()
    await held.act({ kind: 'retitle_quiz', title: 'Royal Princes' })
    const { hunt: affirms } = await affirmsOf(held.tt, held.lee, held.open)
    expect(await held.lee.as.query(api.quizzes.signals, { affirms })).to.deep.eq([])
    expect(await held.lee.as.query(api.quizzes.signals, { affirms: { ...affirms, standing: 'smith' } })).to.deep.eq([])
  })

  it("answers nothing of another hunt: a smith of one affirming another's", async () => {
    const held = await seeded()
    await held.act({ kind: 'retitle_quiz', title: 'Royal Princes' })
    const other = await seedHunt(held.tt, Hunt.blank('other_hunt'), { smith: 'sam_smiths' })
    const { hunt: affirms } = await affirmsOf(held.tt, other.smith, other.open)
    expect(await other.smith.as.query(api.quizzes.signals, { affirms })).to.deep.eq([])
    expect(await other.smith.as.query(api.quizzes.signals, { affirms: { ...affirms, hunt_id: held.open.hunt_id } })).to.deep.eq([])
  })
})
