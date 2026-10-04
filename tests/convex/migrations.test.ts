import migrationsTest from '@convex-dev/migrations/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../convex/_generated/api'
import { Quiz } from '../../src/models/quiz'
import { huntHolding, openTester, seedHunt, signedIn, type Tester } from '../support/convex'
import { present } from '../support/present'

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

/** The tables `forced_label` is retiring from, and the migration that retires it from each */
const ForcedLabelled = [
  ['hunts',     'migrations:retireHuntForcedLabels'],
  ['quizzes',   'migrations:retireQuizForcedLabels'],
  ['questions', 'migrations:retireQuestionForcedLabels'],
] as const

type ForcedLabelledTablename = typeof ForcedLabelled[number][0]

/** A hunt of two blank quizzes */
const huntOfTwo = () => huntHolding([Quiz.blank('One'), Quiz.blank('Two')])

/**
 * Three hunts of two quizzes each, and in each of the three tables, a first row holding an
 * override, a second holding a null one, and the rest none at all: as rows written while a label
 * could be overridden might stand.
 */
async function holdForcedLabels(tt: Tester): Promise<void> {
  await seedHunt(tt, huntOfTwo())
  await seedHunt(tt, huntOfTwo())
  await seedHunt(tt, huntOfTwo())
  await tt.run(async (ctx) => {
    for (const [tablename] of ForcedLabelled) {
      const [chosen, nulled] = await ctx.db.query(tablename).collect()
      await ctx.db.patch(tablename, present(chosen)._id as never, { forced_label: `chosen_${tablename}` })
      await ctx.db.patch(tablename, present(nulled)._id as never, { forced_label: null })
    }
  })
}

/** Each row's label and override, in the order they were made; `missing` where the override is absent */
async function labelsIn(tt: Tester, tablename: ForcedLabelledTablename) {
  const rows = await tt.run(async (ctx) => await ctx.db.query(tablename).collect())
  return rows.map((row) => [row.label, 'forced_label' in row ? row.forced_label : 'missing'])
}

describe("the forced_label migrations", () => {
  for (const [tablename, fn] of ForcedLabelled) {
    describe(fn, () => {
      it(`gives each of the ${tablename} the label it answered to, and takes forced_label off every one`, async () => {
        const tt = migratable()
        await holdForcedLabels(tt)
        const ante = await labelsIn(tt, tablename)
        expect(ante.slice(0, 3).map(([, forced]) => forced)).to.deep.eq([`chosen_${tablename}`, null, 'missing'])
        await migrate(tt, fn)
        const expected = ante.map(([label], idx) => [idx === 0 ? `chosen_${tablename}` : label, 'missing'])
        expect(await labelsIn(tt, tablename)).to.deep.eq(expected)
      })

      it("changes nothing when run again", async () => {
        const tt = migratable()
        await holdForcedLabels(tt)
        await migrate(tt, fn)
        const once = await labelsIn(tt, tablename)
        await migrate(tt, fn)
        expect(await labelsIn(tt, tablename)).to.deep.eq(once)
      })
    })
  }

  it("all run from runAll", async () => {
    const tt = migratable()
    await holdForcedLabels(tt)
    await tt.mutation(internal.migrations.runAll, {})
    await tt.finishAllScheduledFunctions(vi.runAllTimers)
    for (const [tablename] of ForcedLabelled) {
      const labels = await labelsIn(tt, tablename)
      expect([labels[0], labels.every(([, forced]) => forced === 'missing')]).to.deep.eq([[`chosen_${tablename}`, 'missing'], true])
    }
  })
})
