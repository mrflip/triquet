import migrationsTest from '@convex-dev/migrations/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../convex/_generated/api'
import { relabelHunt } from '../../convex/writing/hunt_actions'
import { relabelQuiz } from '../../convex/writing/quiz_actions'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { classicLayout } from '../support/layouts'
import { huntHolding, openTester, seedHunt, signedIn, type Tester } from '../support/convex'
import { present } from '../support/present'
import { expectSound } from '../support/soundness'

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

  it("all run from runAll, leaving a deployment that holds together", async () => {
    const tt = migratable()
    await holdForcedLabels(tt)
    await tt.mutation(internal.migrations.runAll, {})
    await tt.finishAllScheduledFunctions(vi.runAllTimers)
    for (const [tablename] of ForcedLabelled) {
      const labels = await labelsIn(tt, tablename)
      expect([labels[0], labels.every(([, forced]) => forced === 'missing')]).to.deep.eq([[`chosen_${tablename}`, 'missing'], true])
    }
    await expectSound(tt)
  })

  it("keeps a label given after the deploy and before the migration, over the override it replaced", async () => {
    const tt = migratable()
    await holdForcedLabels(tt)
    await tt.run(async (ctx) => {
      const hunt = present(await ctx.db.query('hunts').first())
      const quiz = present(await ctx.db.query('quizzes').first())
      const realm = present(await ctx.db.get('realms', quiz.realm_id))
      await relabelHunt(ctx.db, hunt._id, 'renamed_hunt')
      await relabelQuiz(ctx.db, { hunt_id: realm.hunt_id, realm_id: quiz.realm_id, quiz_id: quiz._id }, 'renamed_quiz')
    })
    await tt.mutation(internal.migrations.runAll, {})
    await tt.finishAllScheduledFunctions(vi.runAllTimers)
    const [hunts, quizzes] = await Promise.all([labelsIn(tt, 'hunts'), labelsIn(tt, 'quizzes')])
    expect([hunts[0], quizzes[0]]).to.deep.eq([['renamed_hunt', 'missing'], ['renamed_quiz', 'missing']])
  })
})

/** Each table given copies of its parents' fields, the fields it copies, and the migration that backfills them */
const Copied = [
  ['quizzes',    ['hunt_id'],                         'migrations:backfillQuizCopies'],
  ['widgetings', ['hunt_id'],                         'migrations:backfillWidgetingCopies'],
  ['columns',    ['hunt_id'],                         'migrations:backfillColumnCopies'],
  ['widgeteds',  ['hunt_id', 'quiz_id'],              'migrations:backfillWidgetedCopies'],
  ['reviewings', ['hunt_id', 'quiz_id', 'ident_id'],  'migrations:backfillReviewingCopies'],
  ['huntings',   ['ident_label', 'ident_title'],      'migrations:backfillHuntingCopies'],
] as const

type CopiedTablename = typeof Copied[number][0]

/** Each row's copies, in the order the rows were made; `missing` where a copy is absent */
async function copiesIn(tt: Tester, tablename: CopiedTablename, fieldnames: readonly string[]) {
  const rows = await tt.run(async (ctx) => await ctx.db.query(tablename).collect()) as Record<string, unknown>[]
  return rows.map((row) => fieldnames.map((fieldname) => (Object.hasOwn(row, fieldname) ? row[fieldname] : 'missing')))
}

/**
 * Two hunts as a deployment written before the copies might hold them: each a laid-out quiz with a
 * smith and a reviewer, a stored cell and a verdict, and then every copy taken off every row. The
 * copies each row held before, by table.
 */
async function holdUncopied(tt: Tester) {
  for (const reviewer of ['alice_reviews', 'bob_reviews']) {
    const { act, open, join } = await seedHunt(tt, huntHolding([{ ...Quiz.blank(), ...classicLayout(), questions: [Question.blank(), Question.blank()] }]))
    const member = await join(reviewer, 'reviewer')
    const question_id = await tt.run(async (ctx) => present(present(await ctx.db.get('quizzes', open.quiz_id)).row_ordering[1]))
    await act({ kind: 'record_widgeted', widgeted: { question_id, widgeting_label: 'dumdum', status: 'ok', value: { guess: 'Leon', explanation: '' } } })
    await act({ kind: 'open_review', quiz_id: open.quiz_id }, member)
    await act({ kind: 'set_reviewing', quiz_id: open.quiz_id, question_id, patch: { get_rate: 40 } }, member)
  }
  const copied = Object.fromEntries(await Promise.all(Copied.map(async ([tablename, fieldnames]) => [tablename, await copiesIn(tt, tablename, fieldnames)] as const)))
  await tt.run(async (ctx) => {
    for (const [tablename, fieldnames] of Copied) {
      const rows = await ctx.db.query(tablename).collect()
      for (const row of rows) { await ctx.db.patch(tablename, row._id as never, Object.fromEntries(fieldnames.map((fieldname) => [fieldname, undefined]))) }
    }
  })
  return copied as Record<CopiedTablename, unknown[][]>
}

describe("the copy backfills", () => {
  for (const [tablename, fieldnames, fn] of Copied) {
    describe(fn, () => {
      it(`gives each of the ${tablename} what it copies of its parent, whatever else is backfilled yet`, async () => {
        const tt = migratable()
        const copied = await holdUncopied(tt)
        const stripped = await copiesIn(tt, tablename, fieldnames)
        expect(stripped.flat().every((copy) => copy === 'missing')).to.be.true
        await migrate(tt, fn)
        expect(await copiesIn(tt, tablename, fieldnames)).to.deep.eq(copied[tablename])
      })

      it("changes nothing when run again", async () => {
        const tt = migratable()
        await holdUncopied(tt)
        await migrate(tt, fn)
        const once = await copiesIn(tt, tablename, fieldnames)
        await migrate(tt, fn)
        expect(await copiesIn(tt, tablename, fieldnames)).to.deep.eq(once)
      })
    })
  }

  it("leaves a row whose parent is gone as it is", async () => {
    const tt = migratable()
    await holdUncopied(tt)
    const doomed = await tt.run(async (ctx) => {
      const quiz = present(await ctx.db.query('quizzes').first())
      await ctx.db.delete('realms', quiz.realm_id)
      return quiz._id
    })
    await migrate(tt, 'migrations:backfillQuizCopies')
    const quiz = await tt.run(async (ctx) => present(await ctx.db.get('quizzes', doomed)))
    expect('hunt_id' in quiz).to.be.false
  })

  it("all run from runAll, leaving a deployment that holds together", async () => {
    const tt = migratable()
    const copied = await holdUncopied(tt)
    await tt.mutation(internal.migrations.runAll, {})
    await tt.finishAllScheduledFunctions(vi.runAllTimers)
    for (const [tablename, fieldnames] of Copied) {
      expect(await copiesIn(tt, tablename, fieldnames)).to.deep.eq(copied[tablename])
    }
    await expectSound(tt)
  })
})
