import { describe, expect, it } from 'vitest'
import { internal } from '../../convex/_generated/api'
import type { TableNames } from '../../convex/_generated/dataModel'
import { PeopleTables, type PeopleTablename } from '../../convex/clear_people'
import { Hunt } from '../../src/models/hunt'
import { openOf, openTester, seedHunt, signedIn, type Tester } from '../support/convex'
import { present } from '../support/present'
import { expectSound } from '../support/soundness'

/** The tables a clear leaves alone: every one of ours that is not the people's */
const KeptTables = ['hunts', 'realms', 'quizzes', 'questions', 'widgets', 'widgetings', 'columns', 'widgeteds', 'quiz_widgeteds', 'signals', 'schema_steps'] as const satisfies readonly TableNames[]

/** Every row of the tables a clear leaves alone, by table; a change signal without the moment it last moved, which a shared review's going moves */
async function keptIn(tt: Tester) {
  return await tt.run(async (ctx) => {
    const held = await Promise.all(KeptTables.map(async (tablename) => {
      const rows = await ctx.db.query(tablename).collect()
      return [tablename, rows.map((row) => ('changed_at' in row ? { ...row, changed_at: 'moved or not' } : row))] as const
    }))
    return Object.fromEntries(held)
  })
}

/** How many rows each of the people's tables holds, read past the functions */
async function peopleIn(tt: Tester): Promise<Record<PeopleTablename, number>> {
  return await tt.run(async (ctx) => {
    const counts = await Promise.all(PeopleTables.map(async (tablename) => {
      const rows = await ctx.db.query(tablename).collect()
      return [tablename, rows.length] as const
    }))
    return Object.fromEntries(counts) as Record<PeopleTablename, number>
  })
}

/** Every table of the people's at `count`, but those `some` names */
function peopleAt(count: number, some: Partial<Record<PeopleTablename, number>> = {}): Record<PeopleTablename, number> {
  return { ...Object.fromEntries(PeopleTables.map((tablename) => [tablename, count])) as Record<PeopleTablename, number>, ...some }
}

/**
 * A deployment holding a row of every people's table and of every kept one: a hunt with its smith,
 * a reviewer's shared review holding a verdict, a visitor who never chose a username, and one of each
 * of Convex Auth's other rows.
 */
async function populated(): Promise<Tester> {
  const tt = openTester()
  const held = await seedHunt(tt, Hunt.blank('spring_hunt'), { smith: 'pat_smiths' })
  const lee = await held.join('lee_reviews', 'reviewer')
  const [question] = openOf(await held.read()).questions
  const { quiz_id } = held.open
  await held.act({ kind: 'open_review', quiz_id }, lee)
  await held.act({ kind: 'set_reviewing', quiz_id, question_id: present(question)._id, patch: { guesses: 'Leon?' } }, lee)
  await held.act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, lee)
  const { user_id } = await signedIn(tt)
  await tt.run(async (ctx) => {
    const sessionId = present(await ctx.db.query('authSessions').first())._id
    const accountId = await ctx.db.insert('authAccounts', { userId: user_id, provider: 'anonymous', providerAccountId: 'a-random-uuid' })
    await ctx.db.insert('authRefreshTokens', { sessionId, expirationTime: Date.now() })
    await ctx.db.insert('authVerifiers', { sessionId })
    await ctx.db.insert('authVerificationCodes', { accountId, provider: 'anonymous', code: 'not-a-code', expirationTime: Date.now() })
    await ctx.db.insert('authRateLimits', { identifier: 'someone', lastAttemptTime: Date.now(), attemptsLeft: 3 })
    await ctx.db.insert('schema_steps', { sha: 'f'.repeat(40), subject: 'model: a step', pushed_at: 1, backfilled_at: 1 })
  })
  return tt
}

/** Runs `clear_people:clearBatch` until a run deletes nothing; the deletions of each run, as it said them */
async function clearedAll(tt: Tester): Promise<Record<PeopleTablename, number>[]> {
  const runs: Record<PeopleTablename, number>[] = []
  for (;;) {
    const deleted = await tt.mutation(internal.clear_people.clearBatch, {})
    runs.push(deleted)
    if (Object.values(deleted).every((count) => count === 0)) { return runs }
  }
}

/** Where `clear_people:count` takes up */
type CountAtT = { tablename: PeopleTablename, cursor: string | null } | null

/** The counts `clear_people:count` comes to, a page at a time, as the script adds them up */
async function countedIn(tt: Tester): Promise<Partial<Record<PeopleTablename, number>>> {
  const counts: Partial<Record<PeopleTablename, number>> = {}
  let at = null as CountAtT
  do {
    const page = await tt.query(internal.clear_people.count, { at })
    counts[page.tablename] = (counts[page.tablename] ?? 0) + page.counted
    at = page.next
  } while (at !== null)
  return counts
}

describe("clear_people.clearBatch", () => {
  it("deletes every row of the people's tables, and leaves every hunt and everything under it", async () => {
    const tt = await populated()
    const before = await peopleIn(tt)
    expect(Object.values(before).every((count) => count > 0), JSON.stringify(before)).to.be.true
    const kept = await keptIn(tt)
    const [first] = await clearedAll(tt)
    expect(first).to.deep.eq(before)
    expect(await peopleIn(tt)).to.deep.eq(peopleAt(0))
    expect(await keptIn(tt)).to.deep.eq(kept)
    await expectSound(tt)
  })

  it("deletes nothing on a second run", async () => {
    const tt = await populated()
    await clearedAll(tt)
    const kept = await keptIn(tt)
    expect(await clearedAll(tt)).to.deep.eq([peopleAt(0)])
    expect(await keptIn(tt)).to.deep.eq(kept)
  })

  it("deletes a batch a run, children before the rows they point at, and leaves the rest for the next", async () => {
    const tt = openTester()
    const { user_id } = await signedIn(tt)
    await tt.run(async (ctx) => {
      for (let ii = 0; ii < 501; ii += 1) {
        await ctx.db.insert('idents', { label: `ident_${String(ii)}`, title: 'Someone', user_id })
      }
    })
    expect(await clearedAll(tt)).to.deep.eq([
      peopleAt(0, { idents: 500 }),
      peopleAt(0, { idents: 1, authSessions: 1, users: 1 }),
      peopleAt(0),
    ])
  })
})

describe("clear_people.count", () => {
  it("counts every row of the people's tables, naming each table, the empty ones as none", async () => {
    const tt = await populated()
    expect(await countedIn(tt)).to.deep.eq(await peopleIn(tt))
    await clearedAll(tt)
    expect(await countedIn(tt)).to.deep.eq(peopleAt(0))
  })

  it("counts a table bigger than a page across pages", async () => {
    const tt = openTester()
    await tt.run(async (ctx) => {
      for (let ii = 0; ii < 1001; ii += 1) {
        await ctx.db.insert('idents', { label: `ident_${String(ii)}`, title: 'Someone', user_id: null })
      }
    })
    expect(await countedIn(tt)).to.deep.eq(peopleAt(0, { idents: 1001 }))
  })

  it("starts from the first table, and hands on to the next once one is done", async () => {
    const tt = openTester()
    expect(await tt.query(internal.clear_people.count, { at: null })).to.deep.eq({ tablename: 'reviewings', counted: 0, next: { tablename: 'reviews', cursor: null } })
    expect(await tt.query(internal.clear_people.count, { at: { tablename: 'users', cursor: null } })).to.deep.eq({ tablename: 'users', counted: 0, next: null })
  })
})
