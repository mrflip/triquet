import migrationsTest from '@convex-dev/migrations/test'
import { getFunctionName } from 'convex/server'
import _ from 'es-toolkit/compat'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import * as Migrations from '../../convex/migrations'
import { StampedTables, type StampedTablename } from '../../convex/stamping'
import { Hunt } from '../../src/models/hunt'
import { openOf, openTester, seedHunt, type Tester } from '../support/convex'
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

/** The bagshape chain's backfills, in the order they run */
const BagshapeBackfills = ['backfillBagshapeWidgets', 'backfillBagshapeWidgetings', 'backfillBagshapeColumns', 'backfillBagshapeQuizzes', 'backfillBagshapeQuestions', 'backfillBagshapeWidgeteds']

/**
 * A hunt whose stored texts read the bag as it was before it took the export's shape: a formula
 * widget, a template widget and its widgeting's own template, a column showing `qns` with a
 * template, the recap's head, a nominated clueing and text entry, and a hint and an entry the
 * quiz does not nominate.
 */
async function bagBeforeOctober(tt: Tester) {
  const held = await seedHunt(tt, Hunt.blank('spring_hunt'), { smith: 'pat_smiths' })
  const { hunt_id, quiz_id } = held.open
  const [question] = openOf(await held.read()).questions
  const question_id = present(question)._id as Id<'questions'>
  return await tt.run(async (ctx) => {
    const widget = { scope: 'pub' as const, title: '', description: '', config: {}, position: 90 }
    await ctx.db.insert('widgets', { ...widget, label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)', input_formula: '$' })
    await ctx.db.insert('widgets', { ...widget, label: 'blurbish', formulary: 'liquidize', formula: '{{ qn.title }}', input_formula: '$', position: 91 })
    await ctx.db.insert('widgets', { ...widget, label: 'noted', formulary: 'entry', formula: '', input_formula: '', config: { entry_kind: 'text' }, position: 92 })
    const widgeting = { hunt_id, quiz_id, description: '', tier: 'question' as const }
    await ctx.db.insert('widgetings', { ...widgeting, widget_label: 'blurbish', label: 'blurbed', params: { template: '{{ qn.hint }}' }, position: 90 })
    const byline = await ctx.db.insert('widgetings', { ...widgeting, widget_label: 'noted', label: 'byline', params: {}, position: 91 })
    const aside = await ctx.db.insert('widgetings', { ...widgeting, widget_label: 'noted', label: 'aside', params: {}, position: 92 })
    await ctx.db.insert('columns', { hunt_id, quiz_id, label: 'every', title: 'Every', source: 'qns', template: '{{ value }} of {{ qns.size }}', formula: '$count($)', width_px: 100, position: 90 })
    await ctx.db.patch('quizzes', quiz_id, { recap_head: 'Thanks, {{ qn_label }}', templateable: ['clueing', 'byline'] })
    await ctx.db.patch('questions', question_id, { clueing: 'By {{qn.byline}}', hint: 'Not {{qn.title}}' })
    const cell = { hunt_id, quiz_id, question_id, status: 'ok' as const, message: null, result_meta: {} }
    await ctx.db.insert('widgeteds', { ...cell, widgeting_id: byline, value: '{{ qn.title }}!' })
    await ctx.db.insert('widgeteds', { ...cell, widgeting_id: aside, value: '{{ qn.title }}?' })
    return { quiz_id, question_id }
  })
}

/** The texts `bagBeforeOctober` stored, as they stand */
async function bagTextsIn(tt: Tester, { quiz_id, question_id }: { quiz_id: Id<'quizzes'>, question_id: Id<'questions'> }) {
  return await tt.run(async (ctx) => {
    const widgets = await ctx.db.query('widgets').collect()
    const widgetOf = (label: string) => present(widgets.find((widget) => widget.label === label))
    const widgetings = await ctx.db.query('widgetings').collect()
    const columns = await ctx.db.query('columns').collect()
    const quiz = present(await ctx.db.get('quizzes', quiz_id))
    const question = present(await ctx.db.get('questions', question_id))
    const cells = await ctx.db.query('widgeteds').collect()
    return {
      shout:   widgetOf('shout').formula,
      blurb:   widgetOf('blurbish').formula,
      params:  present(widgetings.find((widgeting) => widgeting.label === 'blurbed')).params,
      column:  _.pick(present(columns.find((column) => column.label === 'every')), ['source', 'template', 'formula']),
      head:    quiz.recap_head,
      fields:  _.pick(question, ['clueing', 'hint']),
      cells:   cells.map((cell) => cell.value),
      stamped: [quiz.updated_at ?? null, question.updated_at ?? null, quiz._creationTime],
    }
  })
}

describe("the bagshape backfills", () => {
  it("rewrite each stored text that reads the bag in the words it has now, and leave what reads no bag, and no stamp moved", async () => {
    const { tt } = deployment()
    const ids = await bagBeforeOctober(tt)
    const before = await bagTextsIn(tt, ids)
    for (const fn of BagshapeBackfills) { await migrate(tt, `migrations:${fn}`) }
    expect(await bagTextsIn(tt, ids)).to.deep.eq({
      shout:   '$uppercase(question.title)',
      blurb:   '{{ question.title }}',
      params:  { template: '{{ question.hint }}' },
      column:  { source: 'questions', template: '{{ value }} of {{ questions.size }}', formula: '$count($.*)' },
      head:    'Thanks, {{ question_label }}',
      fields:  { clueing: 'By {{question.byline}}', hint: 'Not {{qn.title}}' },
      cells:   ['{{ question.title }}!', '{{ qn.title }}?'],
      stamped: before.stamped,
    })
  })

  it("change nothing run again", async () => {
    const { tt } = deployment()
    const ids = await bagBeforeOctober(tt)
    for (const fn of BagshapeBackfills) { await migrate(tt, `migrations:${fn}`) }
    const once = await bagTextsIn(tt, ids)
    for (const fn of BagshapeBackfills) { await tt.mutation(internal.migrations.run, { fn: `migrations:${fn}`, reset: true }); await tt.finishAllScheduledFunctions(vi.runAllTimers) }
    expect(await bagTextsIn(tt, ids)).to.deep.eq(once)
  })

  it("leave a question's field its validator refuses once rewritten, and rewrite its others", async () => {
    const { tt } = deployment()
    const ids = await bagBeforeOctober(tt)
    const grown = '{{qn.title}}'.repeat(300)
    await tt.run(async (ctx) => {
      await ctx.db.patch('quizzes', ids.quiz_id, { templateable: ['clueing', 'hint', 'byline'] })
      await ctx.db.patch('questions', ids.question_id, { clueing: grown })
    })
    const quiet = vi.spyOn(console, 'warn').mockImplementation(() => null)
    for (const fn of BagshapeBackfills) { await migrate(tt, `migrations:${fn}`) }
    quiet.mockRestore()
    const { fields } = await bagTextsIn(tt, ids)
    expect(fields).to.deep.eq({ clueing: grown, hint: 'Not {{question.title}}' })
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
