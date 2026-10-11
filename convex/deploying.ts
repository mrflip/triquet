import type { Doc } from './_generated/dataModel'
import type { DatabaseReader } from './_generated/server'
import { zInternalMutation, zInternalQuery } from './functions'
import { ValidatorKit } from '../src/lib/validator'
import { SchemaStepValidators } from '../src/models/schema-step'

const { uint, zod } = ValidatorKit

// The migrations table's functions (`src/models/schema-step.ts`): what records a schema step on a
// backend, and what reads the mark back. Internal: run by `scripts/deploy.ts`,
// `scripts/convex-migrations.ts` and `scripts/convex_dev` with the deployment's key, never by a
// browser. Each is written to be run again harmlessly.

/** How many steps `recent` lists at most */
const RecentMax = 20

/** The step `sha` names, if this backend has recorded it */
async function stepFor(db: DatabaseReader, sha: string): Promise<Doc<'schema_steps'> | null> {
  return await db.query('schema_steps').withIndex('by_sha', (cvx) => cvx.eq('sha', sha)).unique()
}

/**
 * Record that the step `sha` was pushed to this backend, just now. A step recorded already is left
 * as it stands: pushing it again (a re-walk) is not a second step.
 *
 * @example npx convex run deploying:recordPushed '{"sha": "<40 hex>", "subject": "model: hunts remember their branch"}'
 */
export const recordPushed = zInternalMutation({
  args:    { sha: SchemaStepValidators.sha, subject: SchemaStepValidators.row.shape.subject },
  returns: zod.null(),
  handler: async (ctx, { sha, subject }) => {
    if (await stepFor(ctx.db, sha) === null) {
      await ctx.db.insert('schema_steps', SchemaStepValidators.row({ sha, subject, pushed_at: Date.now(), backfilled_at: null }))
    }
    return null
  },
})

/**
 * Record that every backfill the step `sha` defines has finished on this backend, just now. A step
 * nobody recorded as pushed (a push that landed, then a process that died) is recorded now, pushed
 * and backfilled at once, so the mark is never lost to a missing row. One already backfilled is
 * left as it stands.
 *
 * @example npx convex run deploying:recordBackfilled '{"sha": "<40 hex>", "subject": "model: hunts remember their branch"}'
 */
export const recordBackfilled = zInternalMutation({
  args:    { sha: SchemaStepValidators.sha, subject: SchemaStepValidators.row.shape.subject },
  returns: zod.null(),
  handler: async (ctx, { sha, subject }) => {
    const now = Date.now()
    const held = await stepFor(ctx.db, sha)
    if (held === null) {
      await ctx.db.insert('schema_steps', SchemaStepValidators.row({ sha, subject, pushed_at: now, backfilled_at: now }))
    } else if (held.backfilled_at === null) {
      await ctx.db.patch('schema_steps', held._id, { backfilled_at: now })
    }
    return null
  },
})

/**
 * The backend's mark: the step recorded last, or null on a backend that has recorded none. Steps
 * are recorded in the order they are pushed, so the last recorded is the newest taken.
 *
 * @example npx convex run deploying:newest  // => { sha: "...", subject: "...", pushed_at: 1760000000000, backfilled_at: null }
 */
export const newest = zInternalQuery({
  args:    {},
  handler: async (ctx): Promise<Doc<'schema_steps'> | null> => await ctx.db.query('schema_steps').order('desc').first(),
})

/**
 * The steps recorded most recently, newest first, up to `limit` (20): the backend's recent
 * history, for a dry run to show.
 *
 * @example npx convex run deploying:recent '{"limit": 5}'
 */
export const recent = zInternalQuery({
  args:    { limit: uint.min(1).max(RecentMax).optional() },
  handler: async (ctx, { limit }): Promise<Doc<'schema_steps'>[]> => await ctx.db.query('schema_steps').order('desc').take(limit ?? RecentMax),
})
