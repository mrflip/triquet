import migrationsTest from '@convex-dev/migrations/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../convex/_generated/api'
import { Quiz } from '../../src/models/quiz'
import { huntHolding, openTester, seedHunt, type Seeded, type Tester } from '../support/convex'

// The migrations run as the migrations component runs them, in batches handed to the scheduler,
// so each test runs the scheduler dry before reading what they wrote.

/** A deployment with the migrations component, holding a hunt of three quizzes */
async function seeded(): Promise<Seeded> {
  const tt = openTester()
  migrationsTest.register(tt)
  return await seedHunt(tt, huntHolding([Quiz.blank('Nulled'), Quiz.blank('Costed'), Quiz.blank('Fresh')]))
}

/** Run the migration `fn`, and every batch it schedules */
async function migrate(tt: Tester, fn: string): Promise<void> {
  await tt.mutation(internal.migrations.run, { fn })
  await tt.finishAllScheduledFunctions(vi.runAllTimers)
}

/** Give the first quiz a null `bulk_ishes_last` and the second a run's cost, as quizzes written before the widget tables held */
async function holdBulkIshesLast(tt: Tester): Promise<void> {
  await tt.run(async (ctx) => {
    const [nulled, costed] = await ctx.db.query('quizzes').collect()
    await ctx.db.patch('quizzes', nulled!._id, { bulk_ishes_last: null })
    await ctx.db.patch('quizzes', costed!._id, { bulk_ishes_last: { approx_tokens: 4200, text_count: 28, updated_at: 1_759_000_000_000 } })
  })
}

/** Each quiz's row, in the order they were made */
async function quizRows(tt: Tester) {
  return await tt.run(async (ctx) => await ctx.db.query('quizzes').collect())
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe("migrations.retireBulkIshesLast", () => {
  it("takes the field off every quiz holding it, null or not, and leaves the rest of each quiz alone", async () => {
    const { tt } = await seeded()
    const ante = await quizRows(tt)
    await holdBulkIshesLast(tt)
    const held = await quizRows(tt)
    expect(held.map((quiz) => 'bulk_ishes_last' in quiz)).to.deep.eq([true, true, false])
    await migrate(tt, 'migrations:retireBulkIshesLast')
    expect(await quizRows(tt)).to.deep.eq(ante)
  })

  it("changes nothing when run again", async () => {
    const { tt } = await seeded()
    const ante = await quizRows(tt)
    await holdBulkIshesLast(tt)
    await migrate(tt, 'migrations:retireBulkIshesLast')
    await migrate(tt, 'migrations:retireBulkIshesLast')
    expect(await quizRows(tt)).to.deep.eq(ante)
  })
})
