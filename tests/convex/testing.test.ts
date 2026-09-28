import { afterEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../convex/_generated/api'
import { Hunt } from '../../src/models/hunt'
import { openTester, seedHunt, type Tester } from '../support/convex'

/** How many rows each table holds that has any */
async function countsIn(tt: Tester): Promise<Record<string, number>> {
  return await tt.run(async (ctx) => {
    const tablenames = ['hunts', 'realms', 'quizzes', 'questions', 'widgets', 'columns', 'expressions', 'idents'] as const
    const counts = await Promise.all(tablenames.map(async (tablename) => {
      const rows = await ctx.db.query(tablename).collect()
      return [tablename, rows.length] as const
    }))
    return Object.fromEntries(counts.filter(([, count]) => count > 0))
  })
}

describe('testing.clearAll', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('empties every table of a deployment that may be emptied', async () => {
    vi.stubEnv('TRIQUET_CLEARABLE', 'yes')
    const tt = openTester()
    await seedHunt(tt, Hunt.blank())
    await tt.mutation(internal.testing.clearAll, {})
    expect(await countsIn(tt)).to.deep.eq({})
  })

  it('refuses a deployment that may not be emptied, deleting nothing', async () => {
    vi.stubEnv('TRIQUET_CLEARABLE', '')
    const tt = openTester()
    await seedHunt(tt, Hunt.blank())
    const before = await countsIn(tt)
    await expect(tt.mutation(internal.testing.clearAll, {})).rejects.toThrow(/may not be emptied/)
    expect(await countsIn(tt)).to.deep.eq(before)
  })

  it('hands what one run cannot delete to the next', async () => {
    vi.stubEnv('TRIQUET_CLEARABLE', 'yes')
    vi.useFakeTimers()
    const tt = openTester()
    const labels = Array.from({ length: 501 }, (_unused, idx) => `ident_${String(idx)}`)
    await tt.run(async (ctx) => {
      for (const label of labels) { await ctx.db.insert('idents', { label, title: 'Someone' }) }
    })
    expect(await tt.mutation(internal.testing.clearAll, {})).to.eq(500)
    await tt.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await countsIn(tt)).to.deep.eq({})
  })
})
