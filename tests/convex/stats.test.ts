import migrationsTest from '@convex-dev/migrations/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFunctionName } from 'convex/server'
import { api, internal } from '../../convex/_generated/api'
import { Backfills } from '../../convex/migrations'
import { Hunt } from '../../src/models/hunt'
import { identified, openTester, seedHunt, signedIn } from '../support/convex'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe("stats.backfills", () => {
  it("answers null to anyone who is no admin: no session, or a session with no username", async () => {
    const tt = openTester()
    migrationsTest.register(tt)
    const session = await signedIn(tt)
    expect([await tt.query(api.stats.backfills, {}), await session.as.query(api.stats.backfills, {})]).to.deep.eq([null, null])
  })

  it("lists each backfill still defined as never run, to an admin, on a deployment that has run none", async () => {
    const tt = openTester()
    migrationsTest.register(tt)
    const { as } = await identified(tt, 'pat_smiths')
    const backfills = await as.query(api.stats.backfills, {}) ?? []
    expect(backfills.map(({ fnname }) => fnname)).to.have.members(Backfills.map((ref) => getFunctionName(ref)))
    expect(backfills.find(({ fnname }) => fnname === 'migrations:backfillHuntOrglabels')).to.deep.eq(
      { fnname: 'migrations:backfillHuntOrglabels', defined: true, state: 'unknown', is_done: false, processed: 0, started_at: null, ended_at: null },
    )
  })

  it("says how far a backfill has run once it has", async () => {
    const tt = openTester()
    migrationsTest.register(tt)
    await seedHunt(tt, Hunt.blank('spring_hunt'), { smith: 'pat_smiths' })
    await tt.mutation(internal.migrations.runAll, {})
    await tt.finishAllScheduledFunctions(vi.runAllTimers)
    const { as } = await identified(tt, 'pat_smiths')
    const backfills = await as.query(api.stats.backfills, {}) ?? []
    const orgs = backfills.find(({ fnname }) => fnname === 'migrations:backfillHuntOrglabels')
    expect(orgs).to.include({ fnname: 'migrations:backfillHuntOrglabels', defined: true, state: 'success', is_done: true, processed: 1 })
    expect(orgs?.started_at).to.be.a('number')
  })
})
