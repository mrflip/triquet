import migrationsTest from '@convex-dev/migrations/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Hunt } from '../../src/models/hunt'
import { openTester, seedHunt, type Tester } from '../support/convex'

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

describe("migrations.runAll", () => {
  it("backfills the hunts' orgs", async () => {
    const { tt, oldHunt } = deployment()
    await oldHunt('spring_hunt', 'pat_smiths')
    await tt.mutation(internal.migrations.runAll, {})
    await tt.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await orgsIn(tt)).to.deep.eq(['pat_smiths'])
  })
})
