import _ from 'es-toolkit/compat'
import { Migrations } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import schema from './schema'
import { HuntValidators } from '../src/models/hunt'
import { IdentValidators } from '../src/models/ident'
import { QuestionValidators } from '../src/models/question'
import { QuizValidators } from '../src/models/quiz'

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

/**
 * Every migration pending, in the order they can run.
 *
 * @example npx convex run migrations:runAll
 */
export const runAll = migrations.runner([
  internal.migrations.backfillIdentClaims,
  internal.migrations.retireHuntForcedLabels,
  internal.migrations.retireQuizForcedLabels,
  internal.migrations.retireQuestionForcedLabels,
])

/** Mark each ident made before a username belonged to a session as claimed by none, for the next session that asserts it */
export const backfillIdentClaims = migrations.define({
  table:      'idents',
  migrateOne: async (ctx, ident) => {
    if (ident.user_id !== undefined) { return }
    const row = IdentValidators.row({ ..._.omit(ident, ['_id', '_creationTime']), user_id: null })
    await ctx.db.patch('idents', ident._id, { user_id: row.user_id })
  },
})

/** The fields of a document the database owns, and the retiring `forced_label` */
const UnwrittenFields = ['_id', '_creationTime', 'forced_label'] as const

/** A row holding the retiring `forced_label`, or having held it */
type ForcedLabelled = { label: string, forced_label?: string | null }

/** The label a row answered to while it could hold an override: the override where one is set */
const labelInForce = (row: ForcedLabelled) => row.forced_label ?? row.label

/** Give each hunt the label it answered to, and take `forced_label` off it */
export const retireHuntForcedLabels = migrations.define({
  table:      'hunts',
  migrateOne: async (ctx, hunt) => {
    if (hunt.forced_label === undefined) { return }
    const row = HuntValidators.row({ ..._.omit(hunt, UnwrittenFields), label: labelInForce(hunt) })
    await ctx.db.patch('hunts', hunt._id, { label: row.label, forced_label: undefined })
  },
})

/** Give each quiz the label it answered to, and take `forced_label` off it */
export const retireQuizForcedLabels = migrations.define({
  table:      'quizzes',
  migrateOne: async (ctx, quiz) => {
    if (quiz.forced_label === undefined) { return }
    const row = QuizValidators.row({ ..._.omit(quiz, UnwrittenFields), label: labelInForce(quiz) })
    await ctx.db.patch('quizzes', quiz._id, { label: row.label, forced_label: undefined })
  },
})

/** Give each question the label it answered to, and take `forced_label` off it */
export const retireQuestionForcedLabels = migrations.define({
  table:      'questions',
  migrateOne: async (ctx, question) => {
    if (question.forced_label === undefined) { return }
    const row = QuestionValidators.row({ ..._.omit(question, UnwrittenFields), label: labelInForce(question) })
    await ctx.db.patch('questions', question._id, { label: row.label, forced_label: undefined })
  },
})
