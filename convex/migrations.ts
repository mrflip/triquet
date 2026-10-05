import _ from 'es-toolkit/compat'
import { Migrations } from '@convex-dev/migrations'
import { components } from './_generated/api'
import { internalMutation } from './_generated/server'
import schema from './schema'
import { DefaultQ1Preamble, QuizValidators } from '../src/models/quiz'

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
 * @example npx convex run migrations:run '{"fn": "migrations:backfillQ1Preambles", "dryRun": true}'
 */
export const run = migrations.runner()

/** Give each quiz written before a quiz had an LL preamble the default one */
export const backfillQ1Preambles = migrations.define({
  table:      'quizzes',
  migrateOne: async (ctx, quiz) => {
    if (quiz.q1_preamble !== undefined) { return }
    const row = QuizValidators.row({ ..._.omit(quiz, ['_id', '_creationTime']), q1_preamble: DefaultQ1Preamble })
    await ctx.db.patch('quizzes', quiz._id, { q1_preamble: row.q1_preamble })
  },
})
