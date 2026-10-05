import migrationsTest from '@convex-dev/migrations/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { StampedTables } from '../../convex/stamping'
import { Hunt } from '../../src/models/hunt'
import { openOf, openTester, seedHunt, type Tester } from '../support/convex'
import { present } from '../support/present'

// The backfills run as the migrations component runs them, in batches handed to the scheduler, so
// each test runs the scheduler dry before reading what they wrote.

/** A deployment with the migrations component, and how to seed it with hunts written before hunts stored their org */
function deployment() {
  const tt = openTester()
  migrationsTest.register(tt)
  return { tt, oldHunt: async (label: string, smith: string) => await oldHuntIn(tt, label, smith) }
}

/** Seed a hunt labelled `label` as one written before hunts stored their org: made by `smith`, its first member, and storing no org */
async function oldHuntIn(tt: Tester, label: string, smith: string): Promise<Id<'hunts'>> {
  const { open } = await seedHunt(tt, Hunt.blank(label), { smith })
  await tt.run(async (ctx) => { await ctx.db.patch('hunts', open.hunt_id, { orglabel: undefined }) })
  return open.hunt_id
}

/** Run the backfill `fn`, and every batch it schedules */
async function migrate(tt: Tester, fn: string): Promise<void> {
  await tt.mutation(internal.migrations.run, { fn })
  await tt.finishAllScheduledFunctions(vi.runAllTimers)
}

/** Each hunt's org as its row holds it (null for one without), in the order they were made */
async function orgsIn(tt: Tester): Promise<(string | null)[]> {
  return await tt.run(async (ctx) => {
    const hunts = await ctx.db.query('hunts').collect()
    return hunts.map((row) => row.orglabel ?? null)
  })
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe("migrations.backfillHuntOrglabels", () => {
  it("gives each hunt without an org its earliest member's ident label", async () => {
    const { tt, oldHunt } = deployment()
    await oldHunt('spring_hunt', 'pat_smiths')
    await oldHunt('autumn_hunt', 'lee_jones')
    await migrate(tt, 'migrations:backfillHuntOrglabels')
    expect(await orgsIn(tt)).to.deep.eq(['pat_smiths', 'lee_jones'])
  })

  it("takes the earliest member whatever their role now, and passes over who joined later", async () => {
    const { tt, oldHunt } = deployment()
    const hunt_id = await oldHunt('spring_hunt', 'pat_smiths')
    await tt.run(async (ctx) => {
      const [maker] = await ctx.db.query('huntings').withIndex('by_hunt_id', (cvx) => cvx.eq('hunt_id', hunt_id)).collect()
      if (maker) { await ctx.db.patch('huntings', maker._id, { role: 'reviewer' }) }
    })
    await migrate(tt, 'migrations:backfillHuntOrglabels')
    expect(await orgsIn(tt)).to.deep.eq(['pat_smiths'])
  })

  it("leaves a hunt nobody is on without one", async () => {
    const { tt, oldHunt } = deployment()
    const hunt_id = await oldHunt('spring_hunt', 'pat_smiths')
    await tt.run(async (ctx) => {
      const huntings = await ctx.db.query('huntings').withIndex('by_hunt_id', (cvx) => cvx.eq('hunt_id', hunt_id)).collect()
      for (const hunting of huntings) { await ctx.db.delete('huntings', hunting._id) }
    })
    vi.spyOn(console, 'warn').mockImplementation(() => null)
    await migrate(tt, 'migrations:backfillHuntOrglabels')
    expect(await orgsIn(tt)).to.deep.eq([null])
  })

  it("leaves a hunt that has an org alone, and changes nothing when run again", async () => {
    const { tt, oldHunt } = deployment()
    await seedHunt(tt, Hunt.blank('kept_hunt'), { smith: 'kim_parks' })
    await oldHunt('spring_hunt', 'pat_smiths')
    await migrate(tt, 'migrations:backfillHuntOrglabels')
    await migrate(tt, 'migrations:backfillHuntOrglabels')
    expect(await orgsIn(tt)).to.deep.eq(['kim_parks', 'pat_smiths'])
  })
})

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

const StampBackfills = ['backfillHuntStamps', 'backfillQuizStamps', 'backfillQuestionStamps', 'backfillReviewStamps', 'backfillReviewingStamps'] as const

describe("the stamp backfills", () => {
  it("stamp each row written before rows were stamped as made, and last edited, in the whole millisecond the database made it", async () => {
    const { tt } = deployment()
    await reviewedHunt(tt)
    await unstamp(tt)
    for (const fn of StampBackfills) { await migrate(tt, `migrations:${fn}`) }
    const held = await stampsIn(tt)
    for (const tablename of StampedTables) {
      expect(held[tablename], tablename).to.not.be.empty
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

  it("leave a stamped row alone", async () => {
    const { tt } = deployment()
    await reviewedHunt(tt)
    const before = await stampsIn(tt)
    for (const fn of StampBackfills) { await migrate(tt, `migrations:${fn}`) }
    expect(await stampsIn(tt)).to.deep.eq(before)
  })
})

describe("migrations.runAll", () => {
  it("backfills the hunts' orgs, and every stamp, a hunt nobody is on included", async () => {
    const { tt, oldHunt } = deployment()
    await oldHunt('spring_hunt', 'pat_smiths')
    await reviewedHunt(tt)
    const orphan = await oldHunt('lone_hunt', 'kim_parks')
    await tt.run(async (ctx) => {
      const huntings = await ctx.db.query('huntings').withIndex('by_hunt_id', (cvx) => cvx.eq('hunt_id', orphan)).collect()
      for (const hunting of huntings) { await ctx.db.delete('huntings', hunting._id) }
    })
    await unstamp(tt)
    vi.spyOn(console, 'warn').mockImplementation(() => null)
    await tt.mutation(internal.migrations.runAll, {})
    await tt.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await orgsIn(tt)).to.deep.eq(['pat_smiths', 'pat_smiths', null])
    const held = await stampsIn(tt)
    expect(StampedTables.flatMap((tablename) => present(held[tablename]).filter(([, created_at, updated_at]) => created_at === null || updated_at === null))).to.deep.eq([])
  })
})
