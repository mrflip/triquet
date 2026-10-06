import _ from 'es-toolkit/compat'
import { Migrations, type MigrationFunctionReference } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { HuntValidators } from '../src/models/hunt'
import schema from './schema'

// Backfills that bring a deployment's rows up to the schema, run through `@convex-dev/migrations`,
// which batches them, records how far each got, and never runs a finished one twice. Each is
// written to be run again harmlessly: a row that already fits is left as it is. Rows are written
// through their row validators, as every other write is. A migration is defined here beside a
// widened schema, and removed once the schema is tightened after it (`notes/deploy.md`, *Schema
// pushes*), whose ledger names the commit that still holds each one.

export const migrations = new Migrations(components.migrations, { internalMutation, schema })

/**
 * Any one migration, by name.
 *
 * @example npx convex run migrations:run '{"fn": "migrations:backfillHuntOrglabels", "dryRun": true}'
 */
export const run = migrations.runner()

/**
 * Give each hunt written before a hunt stored its org the one its address has named meanwhile:
 * the ident label of its earliest member, who made it unless they have since left. A hunt nobody
 * is on is left without one, and said in the log: nobody can open it, and the tightening's push
 * names it, to be given a smith or deleted first.
 */
export const backfillHuntOrglabels = migrations.define({
  table:      'hunts',
  migrateOne: async (ctx, hunt) => {
    if (hunt.orglabel !== undefined) { return }
    const earliest = await ctx.db.query('huntings').withIndex('by_hunt_id', (cvx) => cvx.eq('hunt_id', hunt._id)).first()
    if (! earliest) {
      console.warn(`Hunt ${hunt.label} (${hunt._id}) has nobody on it, so no org to backfill`)
      return
    }
    const row = HuntValidators.row({ ..._.omit(hunt, ['_id', '_creationTime']), orglabel: earliest.ident_label })
    await ctx.db.patch('hunts', hunt._id, { orglabel: row.orglabel })
  },
})

/** Every backfill still defined, in the order they run: today, the hunts' orgs alone */
export const Backfills: readonly MigrationFunctionReference[] = [internal.migrations.backfillHuntOrglabels]

/**
 * Every backfill still defined, in order (`Backfills`).
 *
 * @example npx convex run migrations:runAll
 */
export const runAll = migrations.runner([...Backfills])
