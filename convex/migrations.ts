import _ from 'es-toolkit/compat'
import { Migrations } from '@convex-dev/migrations'
import { components } from './_generated/api'
import { internalMutation } from './_generated/server'
import schema from './schema'
import { QuizValidators } from '../src/models/quiz'

// Backfills that bring a deployment's rows up to the schema, run through `@convex-dev/migrations`,
// which batches them, records how far each got, and never runs a finished one twice. Each is
// written to be run again harmlessly: a row that already fits is left as it is. Rows are written
// through their row validators, as every other write is. A migration is defined here beside a
// widened schema, and removed once the schema is tightened after it (`notes/deploy.md`, *Schema
// pushes*).

export const migrations = new Migrations(components.migrations, { internalMutation, schema })

/**
 * Any one migration, by name.
 *
 * @example npx convex run migrations:run '{"fn": "migrations:backfillSmithsNotes", "dryRun": true}'
 */
export const run = migrations.runner()

/** Give each quiz written before a quiz had a smith's note an empty one */
export const backfillSmithsNotes = migrations.define({
  table:      'quizzes',
  migrateOne: async (ctx, quiz) => {
    if (quiz.smiths_note !== undefined) { return }
    const row = QuizValidators.row({ ..._.omit(quiz, ['_id', '_creationTime']), smiths_note: '' })
    await ctx.db.patch('quizzes', quiz._id, { smiths_note: row.smiths_note })
  },
})
