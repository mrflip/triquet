import migrationsTest from '@convex-dev/migrations/test'
import { getFunctionName } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import * as Migrations from '../../convex/migrations'
import { StampedTables, type StampedTablename } from '../../convex/stamping'
import { Hunt } from '../../src/models/hunt'
import { openOf, openTester, seedHunt, type Tester } from '../support/convex'
import { expectSound } from '../support/soundness'
import { CategoriesDescription } from '../../src/models/before-october'
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

/** Each stamped table's backfill: every one but those made after stamps began, whose rows the trigger has always stamped */
const StampBackfillFor: Record<Exclude<StampedTablename, 'quiz_widgeteds'>, string> = {
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

describe("migrations.runAll", () => {
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

/**
 * A hunt whose quiz is as the grammar before October 2026 wrote it: the library's
 * category-estimate entry labelled `categories`, worked as `categories` and `categories_2`; a
 * column of each, one showing a part; a column of a question field by its prefix; and the quiz
 * nominating, as `templated`, a field by its prefix and a widgeting.
 */
async function oldQuiz(tt: Tester) {
  const held = await seedHunt(tt, Hunt.blank('spring_hunt'), { smith: 'pat_smiths' })
  const { quiz_id, hunt_id } = held.open
  await tt.run(async (ctx) => {
    const widget = present(await ctx.db.query('widgets').withIndex('by_scope_and_label', (cvx) => cvx.eq('scope', 'pub').eq('label', 'category_data')).first())
    await ctx.db.patch('widgets', widget._id, { label: 'categories', description: CategoriesDescription })
    await ctx.db.patch('quizzes', quiz_id, { templateable: undefined, templated: ['question.clueing', 'categories'] })
    for (const [position, label] of ['categories', 'categories_2'].entries()) {
      await ctx.db.insert('widgetings', { hunt_id, quiz_id, widget_label: 'categories', label, description: '', params: {}, tier: 'question', position })
    }
    const columns = await ctx.db.query('columns').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz_id)).collect()
    for (const column of columns) { await ctx.db.delete('columns', column._id) }
    for (const [position, [label, source]] of [['title', 'question.title'], ['cats', 'categories'], ['masie', 'categories_2.masie']].entries()) {
      await ctx.db.insert('columns', { hunt_id, quiz_id, label: String(label), title: String(label), source: String(source), width_px: 100, position })
    }
  })
  return held
}

/** The quiz's layout and nomination, and the library's category-estimate entries, as the rows hold them */
async function rowsOf(tt: Tester, quiz_id: Id<'quizzes'>) {
  return await tt.run(async (ctx) => {
    const quiz = present(await ctx.db.get('quizzes', quiz_id))
    const widgetings = await ctx.db.query('widgetings').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz_id)).collect()
    const columns = await ctx.db.query('columns').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz_id)).collect()
    const library = await ctx.db.query('widgets').collect()
    const widgets = library.filter((widget) => widget.label.startsWith('categor'))
    return {
      templated:    quiz.templated ?? null,
      templateable: quiz.templateable ?? null,
      widgetings:   widgetings.map((row) => [row.label, row.widget_label]),
      columns:      columns.map((row) => [row.label, row.source, row.formula ?? null]),
      widgets:      widgets.map((row) => [row.label, row.description.includes('qn.category_data.masie')]),
    }
  })
}

describe("the columnwise backfills", () => {
  const Columnwise = ['backfillCategoryDataWidget', 'backfillCategoryDataWidgetings', 'backfillPlainColumnSources', 'backfillQuizTemplateables']

  it("relabel the category-estimate entry and its widgetings, write each source plain and each nomination as `templateable`", async () => {
    const { tt } = deployment()
    const { open } = await oldQuiz(tt)
    for (const fn of Columnwise) { await migrate(tt, `migrations:${fn}`) }
    expect(await rowsOf(tt, open.quiz_id)).to.deep.eq({
      templated:    null,
      templateable: ['clueing', 'category_data'],
      widgetings:   [['category_data', 'category_data'], ['category_data_2', 'category_data']],
      columns:      [['title', 'title', null], ['cats', 'category_data', null], ['masie', 'category_data_2', '$.masie']],
      widgets:      [['category_data', true]],
    })
    await expectSound(tt)
  })

  it("take the old entry away where the seeds have already made `category_data` beside it", async () => {
    const { tt } = deployment()
    const { open } = await oldQuiz(tt)
    await tt.mutation(internal.seeding.seedWidgets, {})
    for (const fn of Columnwise) { await migrate(tt, `migrations:${fn}`) }
    const rows = await rowsOf(tt, open.quiz_id)
    expect([rows.widgets, rows.widgetings]).to.deep.eq([[['category_data', true]], [['category_data', 'category_data'], ['category_data_2', 'category_data']]])
  })

  it("leave rows written as they are now alone, so that a quiz made since changes nothing", async () => {
    const { tt } = deployment()
    const { open } = await seedHunt(tt, Hunt.blank('spring_hunt'), { smith: 'pat_smiths' })
    const before = await rowsOf(tt, open.quiz_id)
    for (const fn of Columnwise) { await migrate(tt, `migrations:${fn}`) }
    expect(await rowsOf(tt, open.quiz_id)).to.deep.eq(before)
  })

  it("relabel a widgeting onto the first free label where the quiz already holds `category_data`", async () => {
    const { tt } = deployment()
    const { open } = await oldQuiz(tt)
    await tt.run(async (ctx) => {
      await ctx.db.insert('widgetings', { hunt_id: open.hunt_id, quiz_id: open.quiz_id, widget_label: 'dumdum', label: 'category_data', description: '', params: {}, tier: 'question', position: 2 })
    })
    for (const fn of Columnwise) { await migrate(tt, `migrations:${fn}`) }
    const rows = await rowsOf(tt, open.quiz_id)
    expect(rows.widgetings).to.deep.eq([['category_data_3', 'category_data'], ['category_data_2', 'category_data'], ['category_data', 'dumdum']])
    expect(rows.columns[1]).to.deep.eq(['cats', 'category_data_3', null])
  })
})
