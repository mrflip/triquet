import type { TableNames } from './_generated/dataModel'
import { zInternalMutation, zInternalQuery } from './functions'
import { ValidatorKit } from '../src/lib/validator'

const { obj, oneof, rec, str, uint } = ValidatorKit

// Production's people, cleared, and its hunts kept (the OAuth sprint, whiteboard/20261010-oauth):
// every row that says who someone is, or what they did as someone, goes; every hunt, and everything
// under it, stays at its address. Internal, run by `scripts/clear_people` with the deployment's key
// (`notes/deploy.md`, *Clearing production's people*). Written against the schema before the
// sprint's convergence on users and huntships, which deletes it with the tables it empties.

/**
 * The tables cleared, children before the rows they point at, so that a clear stopped between
 * batches leaves no row pointing at one gone: verdicts before their reviews, memberships and
 * assertions before their idents, tokens and verifiers before their sessions, sessions and accounts
 * before their users. Convex Auth's tables are all of them, the one place this app deletes them.
 */
export const PeopleTables = [
  'reviewings', 'reviews', 'huntings', 'identings', 'idents',
  'authRefreshTokens', 'authVerifiers', 'authSessions', 'authVerificationCodes', 'authAccounts', 'authRateLimits', 'users',
] as const satisfies readonly TableNames[]
export type PeopleTablename = typeof PeopleTables[number]

/** How many rows one run of `clearBatch` deletes at most: each verdict's and review's delete reads its quiz's change signal too */
const BatchSize = 500

/** How many rows one run of `count` counts at most, of one table */
const PageSize = 1000

/** Where `count` takes up: a table, and how far into it; the first table, from its start, when null */
const CountAt = obj({ tablename: oneof(PeopleTables), cursor: str.nullable() })

/** Rows by table, every table of `PeopleTables` named */
const ByTable = rec(oneof(PeopleTables), uint)

/**
 * How many rows of the people's tables there are, a page of one table a run: add up `counted` by
 * `tablename`, and run again from `next` until it is null. Every table answers at least once, so
 * an empty one is counted as none.
 *
 * @returns The table counted, how many rows this page held, and where the next run takes up.
 *
 * @example npx convex run clear_people:count '{"at": null}'
 *   // => { tablename: 'reviewings', counted: 12, next: { tablename: 'reviews', cursor: null } }
 */
export const count = zInternalQuery({
  args:    { at: CountAt.nullable() },
  returns: obj({ tablename: oneof(PeopleTables), counted: uint, next: CountAt.nullable() }),
  handler: async (ctx, { at }) => {
    const { tablename, cursor } = at ?? { tablename: PeopleTables[0], cursor: null }
    const page = await ctx.db.query(tablename).paginate({ cursor, numItems: PageSize })
    const following = PeopleTables[PeopleTables.indexOf(tablename) + 1]
    const next = page.isDone ? (following && { tablename: following, cursor: null }) : { tablename, cursor: page.continueCursor }
    return { tablename, counted: page.page.length, next: next ?? null }
  },
})

/**
 * Delete up to a batch of the people's rows, table by table in `PeopleTables`' order: run it again
 * until it deletes none. Hunts, realms, quizzes, questions, widgetings, columns, widgeteds, change
 * signals and the library are never touched, but that a quiz whose shared reviews go has its
 * change signal moved, as any write to them moves it.
 *
 * @returns How many rows of each table this run deleted; all none once nothing is left.
 *
 * @example npx convex run clear_people:clearBatch
 *   // => { reviewings: 12, reviews: 3, huntings: 40, ..., users: 0 }
 */
export const clearBatch = zInternalMutation({
  args:    {},
  returns: ByTable,
  handler: async (ctx) => {
    const deleted = Object.fromEntries(PeopleTables.map((tablename) => [tablename, 0])) as Record<PeopleTablename, number>
    let left = BatchSize
    // Table by table, each read just before it is cleared: a verdict's delete reads its review.
    for (const tablename of PeopleTables) {
      const rows = await ctx.db.query(tablename).take(left)
      for (const row of rows) { await ctx.db.delete(tablename, row._id) }
      deleted[tablename] = rows.length
      left -= rows.length
    }
    return deleted
  },
})
