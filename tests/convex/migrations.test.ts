import migrationsTest from '@convex-dev/migrations/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Quiz } from '../../src/models/quiz'
import { huntHolding, openTester, seedHunt, type Tester } from '../support/convex'

// The backfills run as the migrations component runs them, in batches handed to the scheduler, so
// each test runs the scheduler dry before reading what they wrote.

/** A deployment with the migrations component, and how to seed it with hunts written before hunts had a branch */
function deployment() {
  const tt = openTester()
  migrationsTest.register(tt)
  return { tt, oldHunt: async (versions: readonly (string | undefined)[]) => await oldHuntIn(tt, versions) }
}

/** Seed a hunt as one written before hunts had a branch: no branch of its own, and each quiz on the version given (none, for undefined) */
async function oldHuntIn(tt: Tester, versions: readonly (string | undefined)[]): Promise<Id<'hunts'>> {
  const { open } = await seedHunt(tt, huntHolding(versions.map((_version, idx) => Quiz.blank(`Quiz ${String(idx + 1)}`))))
  await tt.run(async (ctx) => {
    await ctx.db.patch('hunts', open.hunt_id, { branch: undefined })
    const quizzes = await ctx.db.query('quizzes').withIndex('by_hunt_id', (cvx) => cvx.eq('hunt_id', open.hunt_id)).collect()
    for (const [idx, quiz] of quizzes.entries()) { await ctx.db.patch('quizzes', quiz._id, { version: versions[idx] }) }
  })
  return open.hunt_id
}

/** Run the backfill `fn`, and every batch it schedules */
async function migrate(tt: Tester, fn: string): Promise<void> {
  await tt.mutation(internal.migrations.run, { fn })
  await tt.finishAllScheduledFunctions(vi.runAllTimers)
}

/** Each hunt's branch as its row holds it (null for one without), in the order they were made */
async function branchesIn(tt: Tester): Promise<(string | null)[]> {
  return await tt.run(async (ctx) => {
    const hunts = await ctx.db.query('hunts').collect()
    return hunts.map((row) => row.branch ?? null)
  })
}

/** Each quiz's retiring version as its row holds it (null for one without), in the order they were made */
async function versionsIn(tt: Tester): Promise<(string | null)[]> {
  return await tt.run(async (ctx) => {
    const quizzes = await ctx.db.query('quizzes').collect()
    return quizzes.map((row) => row.version ?? null)
  })
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe("migrations.backfillHuntBranches", () => {
  it("puts each hunt without a branch on the version most of its quizzes were on", async () => {
    const { tt, oldHunt } = deployment()
    await oldHunt(['playtest', 'playtest', 'main'])
    await oldHunt(['main', 'main', 'draft'])
    await migrate(tt, 'migrations:backfillHuntBranches')
    expect(await branchesIn(tt)).to.deep.eq(['playtest', 'main'])
  })

  it("breaks a tie toward main, else toward the first in order, and puts a hunt whose quizzes name none on main", async () => {
    const { tt, oldHunt } = deployment()
    await oldHunt(['playtest', 'main'])
    await oldHunt(['zebra', 'alpha'])
    await oldHunt([undefined])
    await migrate(tt, 'migrations:backfillHuntBranches')
    expect(await branchesIn(tt)).to.deep.eq(['main', 'alpha', 'main'])
  })

  it("leaves a hunt that has a branch alone, and changes nothing when run again", async () => {
    const { tt, oldHunt } = deployment()
    await seedHunt(tt, huntHolding([Quiz.blank('Kept')]))
    await oldHunt(['playtest'])
    await migrate(tt, 'migrations:backfillHuntBranches')
    await migrate(tt, 'migrations:backfillHuntBranches')
    expect(await branchesIn(tt)).to.deep.eq(['main', 'playtest'])
  })
})

describe("migrations.retireQuizVersions", () => {
  it("takes the version off every quiz, and changes nothing when run again", async () => {
    const { tt, oldHunt } = deployment()
    await oldHunt(['playtest', undefined])
    await migrate(tt, 'migrations:retireQuizVersions')
    await migrate(tt, 'migrations:retireQuizVersions')
    expect(await versionsIn(tt)).to.deep.eq([null, null])
  })
})

describe("migrations.runAll", () => {
  it("gives each hunt its quizzes' branch before taking their versions off", async () => {
    const { tt, oldHunt } = deployment()
    await oldHunt(['playtest'])
    await tt.mutation(internal.migrations.runAll, {})
    await tt.finishAllScheduledFunctions(vi.runAllTimers)
    expect([await branchesIn(tt), await versionsIn(tt)]).to.deep.eq([['playtest'], [null]])
  })
})
