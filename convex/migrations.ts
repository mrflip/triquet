import _ from 'es-toolkit/compat'
import { Migrations } from '@convex-dev/migrations'
import { components } from './_generated/api'
import { internalMutation } from './_generated/server'
import schema from './schema'
import { IdentValidators } from '../src/models/ident'

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
 * @example npx convex run migrations:run '{"fn": "migrations:backfillIdentClaims", "dryRun": true}'
 */
export const run = migrations.runner()

/** Mark each ident made before a username belonged to a session as claimed by none, for the next session that asserts it */
export const backfillIdentClaims = migrations.define({
  table:      'idents',
  migrateOne: async (ctx, ident) => {
    if (ident.user_id !== undefined) { return }
    const row = IdentValidators.row({ ..._.omit(ident, ['_id', '_creationTime']), user_id: null })
    await ctx.db.patch('idents', ident._id, { user_id: row.user_id })
  },
})
