import migrationsTest from '@convex-dev/migrations/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../convex/_generated/api'
import { Quiz } from '../../src/models/quiz'
import { huntHolding, openTester, seedHunt, type Seeded, type Tester } from '../support/convex'

// The backfills run as the migrations component runs them, in batches handed to the scheduler, so
// each test runs the scheduler dry before reading what they wrote.

/** A deployment with the migrations component, holding a hunt of two quizzes, one with a note */
async function seeded(): Promise<Seeded> {
  const tt = openTester()
  migrationsTest.register(tt)
  return await seedHunt(tt, huntHolding([Quiz.blank('Unnoted'), { ...Quiz.blank('Noted'), smiths_note: 'Theme: princes.' }]))
}

/** Run the backfill `fn`, and every batch it schedules */
async function backfill(tt: Tester, fn: string): Promise<void> {
  await tt.mutation(internal.migrations.run, { fn })
  await tt.finishAllScheduledFunctions(vi.runAllTimers)
}

/** Each quiz's smith's note as its row holds it (null for one without), in the order they were made */
async function notesIn(tt: Tester): Promise<(string | null)[]> {
  return await tt.run(async (ctx) => {
    const quizzes = await ctx.db.query('quizzes').collect()
    return quizzes.map((row) => row.smiths_note ?? null)
  })
}

/** Strip the smith's note from every quiz whose note is empty, as quizzes written before it existed */
async function forgetEmptyNotes(tt: Tester): Promise<void> {
  await tt.run(async (ctx) => {
    const quizzes = await ctx.db.query('quizzes').collect()
    for (const quiz of quizzes) {
      if (quiz.smiths_note === '') { await ctx.db.patch('quizzes', quiz._id, { smiths_note: undefined }) }
    }
  })
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe("migrations.backfillSmithsNotes", () => {
  it("gives each quiz without a smith's note an empty one, and leaves a written note alone", async () => {
    const { tt } = await seeded()
    await forgetEmptyNotes(tt)
    expect(await notesIn(tt)).to.deep.eq([null, 'Theme: princes.'])
    await backfill(tt, 'migrations:backfillSmithsNotes')
    expect(await notesIn(tt)).to.deep.eq(['', 'Theme: princes.'])
  })

  it("changes nothing when run again", async () => {
    const { tt } = await seeded()
    await forgetEmptyNotes(tt)
    await backfill(tt, 'migrations:backfillSmithsNotes')
    await backfill(tt, 'migrations:backfillSmithsNotes')
    expect(await notesIn(tt)).to.deep.eq(['', 'Theme: princes.'])
  })
})
