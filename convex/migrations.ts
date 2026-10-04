import { Migrations } from '@convex-dev/migrations'
import { components } from './_generated/api'
import { internalMutation } from './_generated/server'
import schema from './schema'

// Backfills that bring a deployment's rows up to the schema, run through `@convex-dev/migrations`,
// which batches them, records how far each got, and never runs a finished one twice. Each is
// written to be run again harmlessly: a row that already fits is left as it is. A migration is
// defined here beside a widened schema, and removed once the schema is tightened after it
// (`notes/deploy.md`, *Schema pushes*), whose ledger names the commit that still holds each one.

export const migrations = new Migrations(components.migrations, { internalMutation, schema })

/**
 * Any one migration, by name.
 *
 * @example npx convex run migrations:run '{"fn": "migrations:retireBulkIshesLast", "dryRun": true}'
 */
export const run = migrations.runner()

/** Take `bulk_ishes_last` off every quiz still holding it, whatever it holds, null included */
export const retireBulkIshesLast = migrations.define({
  table:      'quizzes',
  migrateOne: async (ctx, quiz) => {
    if (quiz.bulk_ishes_last === undefined) { return }
    await ctx.db.patch('quizzes', quiz._id, { bulk_ishes_last: undefined })
  },
})
