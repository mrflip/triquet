import migrationsTest from '@convex-dev/migrations/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { CaretakerLabel } from '../../convex/migrations'
import { huntingsOf } from '../../convex/reading'
import { Hunt } from '../../src/models/hunt'
import { ReviewValidators } from '../../src/models/review'
import { forgetHuntIds, identified, openTester, seedHunt, type Seeded, type Tester } from '../support/convex'

// The backfills run as the migrations component runs them, in batches handed to the scheduler, so
// each test runs the scheduler dry before reading what they wrote.

/** A deployment with the migrations component, holding a seeded hunt */
async function seeded(): Promise<Seeded> {
  const tt = openTester()
  migrationsTest.register(tt)
  return await seedHunt(tt, Hunt.blank('quiet_otter'))
}

/** Run `fn` (all the backfills, unless one is named) and every batch it schedules */
async function backfill(tt: Tester, fn?: string): Promise<void> {
  await (fn ? tt.mutation(internal.migrations.run, { fn }) : tt.mutation(internal.migrations.runAll, {}))
  await tt.finishAllScheduledFunctions(vi.runAllTimers)
}

/** Each question's and each review's `hunt_id` (null for one without), in the order they were made */
async function huntIdsIn(tt: Tester): Promise<{ questions: (Id<'hunts'> | null)[], reviews: (Id<'hunts'> | null)[] }> {
  return await tt.run(async (ctx) => {
    const [questions, reviews] = await Promise.all([ctx.db.query('questions').collect(), ctx.db.query('reviews').collect()])
    return { questions: questions.map((row) => row.hunt_id ?? null), reviews: reviews.map((row) => row.hunt_id ?? null) }
  })
}

/** A review of the open quiz by the seeded smith, written whole */
async function reviewOpenQuiz({ tt, open, smith }: Seeded): Promise<void> {
  await tt.run(async (ctx) => {
    await ctx.db.insert('reviews', ReviewValidators.row({ hunt_id: open.hunt_id, quiz_id: open.quiz_id, ident_id: smith.ident_id }))
  })
}

/** Take everyone off the seeded hunt */
async function emptied({ tt, open }: Seeded): Promise<void> {
  await tt.run(async (ctx) => {
    const huntings = await huntingsOf(ctx.db, open.hunt_id)
    for (const hunting of huntings) { await ctx.db.delete('huntings', hunting._id) }
  })
}

/** Who is on the seeded hunt, and as what */
async function membersOf({ tt, open }: Seeded): Promise<{ ident_id: Id<'idents'>, role: string }[]> {
  return await tt.run(async (ctx) => {
    const huntings = await huntingsOf(ctx.db, open.hunt_id)
    return huntings.map(({ ident_id, role }) => ({ ident_id, role }))
  })
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe("migrations.backfillQuestionHuntIds", () => {
  it("gives each question without one its quiz's hunt", async () => {
    const hunt = await seeded()
    await forgetHuntIds(hunt.tt)
    await backfill(hunt.tt, 'migrations:backfillQuestionHuntIds')
    const { questions } = await huntIdsIn(hunt.tt)
    expect(questions).to.have.lengthOf.above(0)
    expect(questions).to.deep.eq(questions.map(() => hunt.open.hunt_id))
  })

  it("leaves a question whose quiz is gone without, for the next schema push to name", async () => {
    const hunt = await seeded()
    await forgetHuntIds(hunt.tt)
    await hunt.tt.run(async (ctx) => { await ctx.db.delete('quizzes', hunt.open.quiz_id) })
    await backfill(hunt.tt, 'migrations:backfillQuestionHuntIds')
    const { questions } = await huntIdsIn(hunt.tt)
    expect(questions).to.deep.eq(questions.map(() => null))
  })
})

describe("migrations.backfillReviewHuntIds", () => {
  it("gives each review without one its quiz's hunt", async () => {
    const hunt = await seeded()
    await reviewOpenQuiz(hunt)
    await forgetHuntIds(hunt.tt)
    await backfill(hunt.tt, 'migrations:backfillReviewHuntIds')
    const { reviews } = await huntIdsIn(hunt.tt)
    expect(reviews).to.deep.eq([hunt.open.hunt_id])
  })
})

describe("migrations.adoptMemberlessHunts", () => {
  it("makes the caretaker smith of a hunt nobody is on", async () => {
    const hunt = await seeded()
    const caretaker = await identified(hunt.tt, CaretakerLabel)
    await emptied(hunt)
    await backfill(hunt.tt, 'migrations:adoptMemberlessHunts')
    expect(await membersOf(hunt)).to.deep.eq([{ ident_id: caretaker.ident_id, role: 'smith' }])
  })

  it("leaves a hunt with anyone on it as it is", async () => {
    const hunt = await seeded()
    await identified(hunt.tt, CaretakerLabel)
    await backfill(hunt.tt, 'migrations:adoptMemberlessHunts')
    expect(await membersOf(hunt)).to.deep.eq([{ ident_id: hunt.smith.ident_id, role: 'smith' }])
  })

  it("adopts nothing on a deployment where no ident answers to the caretaker's label", async () => {
    const hunt = await seeded()
    await emptied(hunt)
    await backfill(hunt.tt, 'migrations:adoptMemberlessHunts')
    expect(await membersOf(hunt)).to.deep.eq([])
  })
})

describe("migrations.runAll", () => {
  it("runs every backfill, and a second run changes nothing", async () => {
    const hunt = await seeded()
    const caretaker = await identified(hunt.tt, CaretakerLabel)
    await reviewOpenQuiz(hunt)
    await forgetHuntIds(hunt.tt)
    await emptied(hunt)
    await backfill(hunt.tt)
    const [ids, members] = [await huntIdsIn(hunt.tt), await membersOf(hunt)]
    expect(ids.questions).to.deep.eq(ids.questions.map(() => hunt.open.hunt_id))
    expect(ids.reviews).to.deep.eq([hunt.open.hunt_id])
    expect(members).to.deep.eq([{ ident_id: caretaker.ident_id, role: 'smith' }])
    await backfill(hunt.tt)
    expect([await huntIdsIn(hunt.tt), await membersOf(hunt)]).to.deep.eq([ids, members])
  })
})
