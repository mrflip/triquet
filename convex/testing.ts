import { env } from './_generated/server'
import schema from './schema'
import { ValidatorKit } from '../src/lib/validator'
import { zInternalMutation } from './functions'

const { zod } = ValidatorKit

/** How many rows one run deletes before handing the rest to the next: a delete reads, and its triggers read, and a function may read only so much */
const BatchSize = 500

/**
 * Empty every table of a development or test deployment, up to a batch of rows a run, table by table:
 * run it again until it says it deleted nothing (`scripts/convex_reset` does). Refused on a
 * deployment without `TRIQUET_CLEARABLE=yes`, which production never has.
 *
 * @returns How many rows this run deleted; zero once the deployment is empty.
 * @throws On a deployment that may not be emptied; nothing is deleted.
 *
 * @example npx convex run testing:clearAll --env-file data/convex-agent/cli.env
 */
export const clearAll = zInternalMutation({
  args:    {},
  returns: zod.number(),
  handler: async (ctx) => {
    if (env.TRIQUET_CLEARABLE !== 'yes') { throw new Error('This deployment may not be emptied: TRIQUET_CLEARABLE is not yes') }
    const tablenames = Object.keys(schema.tables) as (keyof typeof schema.tables)[]
    // Table by table, each read just before it is cleared, not side by side: a trigger may take a
    // row away with another (a quiz takes its change signal).
    let deleted = 0
    for (const tablename of tablenames) {
      const rows = await ctx.db.query(tablename).take(BatchSize - deleted)
      for (const row of rows) { await ctx.db.delete(tablename, row._id) }
      deleted += rows.length
    }
    return deleted
  },
})
