import migrationsTest from '@convex-dev/migrations/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../convex/_generated/api'
import { openTester, signedIn, type Tester } from '../support/convex'

// The migrations run as the migrations component runs them, in batches handed to the scheduler,
// so each test runs the scheduler dry before reading what they wrote.

/** A deployment with the migrations component */
function migratable(): Tester {
  const tt = openTester()
  migrationsTest.register(tt)
  return tt
}

/** Run the migration `fn`, and every batch it schedules */
async function migrate(tt: Tester, fn: string): Promise<void> {
  await tt.mutation(internal.migrations.run, { fn })
  await tt.finishAllScheduledFunctions(vi.runAllTimers)
}

/** Three idents as a deployment might hold them: one from before usernames were held, one marked held by nobody, one held by a session */
async function holdIdents(tt: Tester) {
  const { user_id } = await signedIn(tt)
  await tt.run(async (ctx) => {
    await ctx.db.insert('idents', { label: 'old_timer', title: 'Old Timer' })
    await ctx.db.insert('idents', { label: 'nobody_yet', title: 'Nobody Yet', user_id: null })
    await ctx.db.insert('idents', { label: 'flip_kromer', title: 'Flip', user_id })
  })
  return user_id
}

/** Each ident's label and holder, in the order they were made; `missing` where the field is absent */
async function holders(tt: Tester) {
  const idents = await tt.run(async (ctx) => await ctx.db.query('idents').collect())
  return idents.map((ident) => [ident.label, 'user_id' in ident ? ident.user_id : 'missing'])
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe("migrations.backfillIdentClaims", () => {
  it("marks each ident without a holder as held by nobody, and leaves the rest alone", async () => {
    const tt = migratable()
    const user_id = await holdIdents(tt)
    expect(await holders(tt)).to.deep.eq([['old_timer', 'missing'], ['nobody_yet', null], ['flip_kromer', user_id]])
    await migrate(tt, 'migrations:backfillIdentClaims')
    expect(await holders(tt)).to.deep.eq([['old_timer', null], ['nobody_yet', null], ['flip_kromer', user_id]])
  })

  it("changes nothing when run again", async () => {
    const tt = migratable()
    await holdIdents(tt)
    await migrate(tt, 'migrations:backfillIdentClaims')
    const once = await holders(tt)
    await migrate(tt, 'migrations:backfillIdentClaims')
    expect(await holders(tt)).to.deep.eq(once)
  })
})
