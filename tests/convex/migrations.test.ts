import migrationsTest from '@convex-dev/migrations/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../convex/_generated/api'
import { DefaultQ1Preamble, Quiz } from '../../src/models/quiz'
import { huntHolding, openTester, seedHunt, type Seeded, type Tester } from '../support/convex'

// The backfills run as the migrations component runs them, in batches handed to the scheduler, so
// each test runs the scheduler dry before reading what they wrote.

/** A deployment with the migrations component, holding a hunt of two quizzes, one with a preamble of its own */
async function seeded(): Promise<Seeded> {
  const tt = openTester()
  migrationsTest.register(tt)
  return await seedHunt(tt, huntHolding([Quiz.blank('Plain'), { ...Quiz.blank('Prefaced'), q1_preamble: 'See the note.[br]' }]))
}

/** Run the backfill `fn`, and every batch it schedules */
async function backfill(tt: Tester, fn: string): Promise<void> {
  await tt.mutation(internal.migrations.run, { fn })
  await tt.finishAllScheduledFunctions(vi.runAllTimers)
}

/** Each quiz's LL preamble as its row holds it (null for one without), in the order they were made */
async function preamblesIn(tt: Tester): Promise<(string | null)[]> {
  return await tt.run(async (ctx) => {
    const quizzes = await ctx.db.query('quizzes').collect()
    return quizzes.map((row) => row.q1_preamble ?? null)
  })
}

/** Strip the preamble from every quiz holding the default, as quizzes written before it existed */
async function forgetDefaultPreambles(tt: Tester): Promise<void> {
  await tt.run(async (ctx) => {
    const quizzes = await ctx.db.query('quizzes').collect()
    for (const quiz of quizzes) {
      if (quiz.q1_preamble === DefaultQ1Preamble) { await ctx.db.patch('quizzes', quiz._id, { q1_preamble: undefined }) }
    }
  })
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe("migrations.backfillQ1Preambles", () => {
  it("gives each quiz without an LL preamble the default, and leaves a written one alone", async () => {
    const { tt } = await seeded()
    await forgetDefaultPreambles(tt)
    expect(await preamblesIn(tt)).to.deep.eq([null, 'See the note.[br]'])
    await backfill(tt, 'migrations:backfillQ1Preambles')
    expect(await preamblesIn(tt)).to.deep.eq([DefaultQ1Preamble, 'See the note.[br]'])
  })

  it("changes nothing when run again", async () => {
    const { tt } = await seeded()
    await forgetDefaultPreambles(tt)
    await backfill(tt, 'migrations:backfillQ1Preambles')
    await backfill(tt, 'migrations:backfillQ1Preambles')
    expect(await preamblesIn(tt)).to.deep.eq([DefaultQ1Preamble, 'See the note.[br]'])
  })
})
