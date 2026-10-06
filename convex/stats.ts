import { getFunctionName } from 'convex/server'
import * as Approve from '../src/lib/approve'
import { backfillsFrom, type BackfillStatusT } from '../src/lib/rows'
import { zQuery } from './functions'
import { Backfills, migrations } from './migrations'

/** How many backfills no longer defined the stats page lists, newest first */
const PastBackfillsMax = 20

/**
 * How far each backfill has run on this deployment, for the stats page: every one `migrations.ts`
 * still defines, in the order they run, whether or not it has started; then the most recent of
 * those it no longer defines, as history. Names, states and counts only, for an admin
 * (`Approve.mayReadBackfills`); null for anyone else.
 */
export const backfills = zQuery({
  args:    {},
  handler: async (ctx): Promise<BackfillStatusT[] | null> => {
    if (! Approve.may('read_backfills', ctx.actor)) { return null }
    const fnnames = Backfills.map((ref) => getFunctionName(ref))
    const [defined, recent] = await Promise.all([
      migrations.getStatus(ctx, { migrations: fnnames }),
      migrations.getStatus(ctx, { limit: PastBackfillsMax + fnnames.length }),
    ])
    return backfillsFrom(defined, recent, PastBackfillsMax)
  },
})
