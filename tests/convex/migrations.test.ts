import migrationsTest from '@convex-dev/migrations/test'
import { getFunctionName } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../convex/_generated/api'
import * as Migrations from '../../convex/migrations'
import { StampedTables, type StampedTablename } from '../../convex/stamping'
import { Hunt } from '../../src/models/hunt'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { Widgeting } from '../../src/models/widgeting'
import { huntHolding, openOf, openTester, seedHunt, type Tester } from '../support/convex'
import { present } from '../support/present'

// The backfills run as the migrations component runs them, in batches handed to the scheduler, so
// each test runs the scheduler dry before reading what they wrote.

/** A deployment with the migrations component */
function deployment() {
  const tt = openTester()
  migrationsTest.register(tt)
  return { tt }
}

/** Run the backfill `fn`, and every batch it schedules */
async function migrate(tt: Tester, fn: string): Promise<void> {
  await tt.mutation(internal.migrations.run, { fn })
  await tt.finishAllScheduledFunctions(vi.runAllTimers)
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

/** Every stamped row's stamps, by table, as its rows hold them (null for one without), in the order they were made, beside when the database made each */
async function stampsIn(tt: Tester) {
  return await tt.run(async (ctx) => {
    const tables = await Promise.all(StampedTables.map(async (tablename) => [tablename, await ctx.db.query(tablename).collect()] as const))
    return Object.fromEntries(tables.map(([tablename, rows]) => [tablename, rows.map((row) => [Math.floor(row._creationTime), row.created_at ?? null, row.updated_at ?? null])]))
  })
}

/** Take the stamps off every stamped row, as rows written before rows were stamped hold none */
async function unstamp(tt: Tester): Promise<void> {
  await tt.run(async (ctx) => {
    for (const tablename of StampedTables) {
      const rows = await ctx.db.query(tablename).collect()
      for (const row of rows) { await ctx.db.patch(tablename, row._id, { created_at: undefined, updated_at: undefined }) }
    }
  })
}

/** A hunt with a review of its quiz, holding a verdict: a row of every stamped table */
async function reviewedHunt(tt: Tester) {
  const held = await seedHunt(tt, Hunt.blank('spring_hunt'), { smith: 'pat_smiths' })
  const lee = await held.join('lee_reviews', 'reviewer')
  const [question] = openOf(await held.read()).questions
  await held.act({ kind: 'open_review', quiz_id: held.open.quiz_id }, lee)
  await held.act({ kind: 'set_reviewing', quiz_id: held.open.quiz_id, question_id: present(question)._id, patch: { guesses: 'Leon?' } }, lee)
  return held
}

/** Each stamped table's backfill */
const StampBackfillFor: Record<StampedTablename, string> = {
  idents: 'backfillIdentStamps', hunts: 'backfillHuntStamps', realms: 'backfillRealmStamps', widgets: 'backfillWidgetStamps', quizzes: 'backfillQuizStamps',
  widgetings: 'backfillWidgetingStamps', columns: 'backfillColumnStamps', questions: 'backfillQuestionStamps', widgeteds: 'backfillWidgetedStamps',
  reviews: 'backfillReviewStamps', reviewings: 'backfillReviewingStamps', huntings: 'backfillHuntingStamps',
}
const StampBackfills = Object.values(StampBackfillFor)

describe("the stamp backfills", () => {
  it("stamp each row written before rows were stamped as made, and last edited, in the whole millisecond the database made it", async () => {
    const { tt } = deployment()
    await reviewedHunt(tt)
    await unstamp(tt)
    for (const fn of StampBackfills) { await migrate(tt, `migrations:${fn}`) }
    const held = await stampsIn(tt)
    const written = StampedTables.filter((tablename) => present(held[tablename]).length > 0)
    expect(written).to.include.members(['idents', 'hunts', 'realms', 'widgets', 'quizzes', 'columns', 'questions', 'reviews', 'reviewings', 'huntings'])
    for (const tablename of written) {
      const rows = present(held[tablename])
      for (const [made, created_at, updated_at] of rows) { expect([created_at, updated_at], tablename).to.deep.eq([made, made]) }
    }
  })

  it("give a row edited since the stamps arrived the moment the database made it, keeping its edit", async () => {
    const { tt } = deployment()
    await reviewedHunt(tt)
    await unstamp(tt)
    const question_id = await tt.run(async (ctx) => {
      const [question] = await ctx.db.query('questions').take(1)
      await ctx.db.patch('questions', present(question)._id, { updated_at: 4_000_000_000_000 })
      return present(question)._id
    })
    await migrate(tt, 'migrations:backfillQuestionStamps')
    const row = present(await tt.run(async (ctx) => await ctx.db.get('questions', question_id)))
    expect([row.created_at, row.updated_at]).to.deep.eq([Math.floor(row._creationTime), 4_000_000_000_000])
  })

  it("leave a stamped row alone, so that running them again changes nothing", async () => {
    const { tt } = deployment()
    await reviewedHunt(tt)
    for (const fn of StampBackfills) { await migrate(tt, `migrations:${fn}`) }
    const before = await stampsIn(tt)
    for (const fn of StampBackfills) { await migrate(tt, `migrations:${fn}`) }
    expect(await stampsIn(tt)).to.deep.eq(before)
  })
})

/** Each row's recap sprint fields, by table, as its rows hold them (null for one without), in the order they were made */
async function recapFieldsIn(tt: Tester) {
  return await tt.run(async (ctx) => {
    const [quizzes, questions, widgetings] = await Promise.all([ctx.db.query('quizzes').collect(), ctx.db.query('questions').collect(), ctx.db.query('widgetings').collect()])
    return {
      quizzes:    quizzes.map((row) => [row.recap_head ?? null, row.recap_tail ?? null, row.templated ?? null]),
      questions:  questions.map((row) => row.recap ?? null),
      widgetings: widgetings.map((row) => row.tier ?? null),
    }
  })
}

/** Take the recap sprint's fields off every row but those of the quiz labelled `kept`, as rows written before them hold none */
async function unwiden(tt: Tester, kept: string): Promise<void> {
  await tt.run(async (ctx) => {
    const quizzes = await ctx.db.query('quizzes').collect()
    const strip = quizzes.filter((quiz) => quiz.label !== kept)
    for (const quiz of strip) {
      await ctx.db.patch('quizzes', quiz._id, { recap_head: undefined, recap_tail: undefined, templated: undefined })
      const [questions, widgetings] = await Promise.all([
        ctx.db.query('questions').withIndex('by_quiz_id', (cvx) => cvx.eq('quiz_id', quiz._id)).collect(),
        ctx.db.query('widgetings').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz._id)).collect(),
      ])
      for (const question of questions) { await ctx.db.patch('questions', question._id, { recap: undefined }) }
      for (const widgeting of widgetings) { await ctx.db.patch('widgetings', widgeting._id, { tier: undefined }) }
    }
  })
}

/** A hunt of two quizzes, `plain` and `written`, each of one question working `dumdum`; `written` has a recap of its own, templates it, and runs `dumdum` per quiz */
async function recappedHunt(tt: Tester) {
  const dumdum = Widgeting.fill({ widget_label: 'dumdum', label: 'dumdum' })
  const plain = { ...Quiz.blank('Plain', 'plain'), questions: [Question.blank()], widgetings: [dumdum] }
  const written = {
    ...Quiz.blank('Written', 'written'), recap_head: 'Thanks!', recap_tail: 'Bye.', templated: ['question.recap'],
    questions: [{ ...Question.blank(), recap: 'Leon.' }], widgetings: [{ ...dumdum, tier: 'quiz' as const }],
  }
  return await seedHunt(tt, huntHolding([plain, written]))
}

/** The recap sprint's backfills */
const RecapBackfills = ['backfillQuizRecaps', 'backfillQuestionRecaps', 'backfillWidgetingTiers']

describe("the recap backfills", () => {
  it("give each row written before the recap and the tiers an empty recap, templating nothing, run for each question, and leave a row that has them alone", async () => {
    const { tt } = deployment()
    await recappedHunt(tt)
    await unwiden(tt, 'written')
    expect(await recapFieldsIn(tt)).to.deep.eq({ quizzes: [[null, null, null], ['Thanks!', 'Bye.', ['question.recap']]], questions: [null, 'Leon.'], widgetings: [null, 'quiz'] })
    for (const fn of RecapBackfills) { await migrate(tt, `migrations:${fn}`) }
    expect(await recapFieldsIn(tt)).to.deep.eq({ quizzes: [['', '', []], ['Thanks!', 'Bye.', ['question.recap']]], questions: ['', 'Leon.'], widgetings: ['question', 'quiz'] })
  })

  it("fill in only what a quiz lacks", async () => {
    const { tt } = deployment()
    const { open } = await recappedHunt(tt)
    await tt.run(async (ctx) => { await ctx.db.patch('quizzes', open.quiz_id, { recap_head: 'Kept.', recap_tail: undefined, templated: undefined }) })
    await migrate(tt, 'migrations:backfillQuizRecaps')
    const { quizzes } = await recapFieldsIn(tt)
    expect(quizzes[0]).to.deep.eq(['Kept.', '', []])
  })

  it("change nothing when run again", async () => {
    const { tt } = deployment()
    await recappedHunt(tt)
    await unwiden(tt, 'written')
    for (const fn of RecapBackfills) { await migrate(tt, `migrations:${fn}`) }
    const before = await recapFieldsIn(tt)
    for (const fn of RecapBackfills) { await migrate(tt, `migrations:${fn}`) }
    expect(await recapFieldsIn(tt)).to.deep.eq(before)
  })

  it("are not held up by a row the row validators would now refuse: a widgeting labelled as the recap a question now has", async () => {
    const { tt } = deployment()
    const { open } = await recappedHunt(tt)
    await unwiden(tt, 'written')
    await tt.run(async (ctx) => {
      const widgeting = await ctx.db.query('widgetings').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', open.quiz_id)).first()
      await ctx.db.patch('widgetings', present(widgeting)._id, { label: 'recap' })
    })
    await migrate(tt, 'migrations:backfillWidgetingTiers')
    const { widgetings } = await recapFieldsIn(tt)
    expect(widgetings).to.deep.eq(['question', 'quiz'])
  })
})

describe("migrations.runAll", () => {
  it("backfills the recap sprint's fields", async () => {
    const { tt } = deployment()
    await recappedHunt(tt)
    await unwiden(tt, 'written')
    await tt.mutation(internal.migrations.runAll, {})
    await tt.finishAllScheduledFunctions(vi.runAllTimers)
    const held = await recapFieldsIn(tt)
    expect([held.quizzes[0], held.questions[0], held.widgetings[0]]).to.deep.eq([['', '', []], '', 'question'])
  })

  it("backfills every stamp", async () => {
    const { tt } = deployment()
    await reviewedHunt(tt)
    await unstamp(tt)
    await tt.mutation(internal.migrations.runAll, {})
    await tt.finishAllScheduledFunctions(vi.runAllTimers)
    const held = await stampsIn(tt)
    expect(StampedTables.flatMap((tablename) => present(held[tablename]).filter(([, created_at, updated_at]) => created_at === null || updated_at === null))).to.deep.eq([])
  })
})

describe("migrations.Backfills", () => {
  it("lists every backfill the module defines, so runAll runs each one", () => {
    const Runners = new Set(['migrations', 'run', 'runAll', 'outstanding', 'Backfills'])
    const defined = Object.keys(Migrations).filter((key) => ! Runners.has(key))
    expect(Migrations.Backfills.map((ref) => getFunctionName(ref))).to.have.members(defined.map((key) => `migrations:${key}`))
  })
})

describe("migrations.outstanding", () => {
  it("lists every backfill not yet started", async () => {
    const { tt } = deployment()
    expect(await tt.query(internal.migrations.outstanding, {})).to.have.deep.members(
      Migrations.Backfills.map((ref) => ({ name: getFunctionName(ref), state: 'unknown', processed: 0 })),
    )
  })

  it("is empty once runAll has finished", async () => {
    const { tt } = deployment()
    await seedHunt(tt, Hunt.blank('spring_hunt'), { smith: 'pat_smiths' })
    await unstamp(tt)
    await tt.mutation(internal.migrations.runAll, {})
    await tt.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await tt.query(internal.migrations.outstanding, {})).to.deep.eq([])
  })

  it("names a backfill that failed, with its error", async () => {
    const { tt } = deployment()
    const { open } = await seedHunt(tt, Hunt.blank('spring_hunt'), { smith: 'pat_smiths' })
    await tt.run(async (ctx) => { await ctx.db.patch('hunts', open.hunt_id, { created_at: undefined, updated_at: -1 }) })
    await migrate(tt, 'migrations:backfillHuntStamps')
    const outstanding = await tt.query(internal.migrations.outstanding, {})
    const failed = outstanding.find((each) => each.state === 'failed')
    expect(failed?.name).to.eq('migrations:backfillHuntStamps')
    expect(failed?.error).to.be.a('string').and.not.eq('')
    expect(outstanding).to.have.length(Migrations.Backfills.length)
  })
})
