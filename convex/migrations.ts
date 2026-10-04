import _ from 'es-toolkit/compat'
import { Migrations } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import schema from './schema'
import { ColumnValidators } from '../src/models/column'
import { HuntValidators } from '../src/models/hunt'
import { HuntingValidators } from '../src/models/hunting'
import { IdentValidators } from '../src/models/ident'
import { QuestionValidators } from '../src/models/question'
import { QuizValidators } from '../src/models/quiz'
import { ReviewingValidators } from '../src/models/reviewing'
import { WidgetedValidators } from '../src/models/widgeted'
import { WidgetingValidators } from '../src/models/widgeting'
import { huntIdOf, huntIdOfLayoutRow, reviewingCopiesOf } from './reading'

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
  internal.migrations.backfillQuizCopies,
  internal.migrations.backfillWidgetingCopies,
  internal.migrations.backfillColumnCopies,
  internal.migrations.backfillWidgetedCopies,
  internal.migrations.backfillReviewingCopies,
  internal.migrations.backfillHuntingCopies,
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

/** The fields of a document the database owns */
const SystemFields = ['_id', '_creationTime'] as const

/** The fields of a document the database owns, and the retiring `forced_label` */
const UnwrittenFields = [...SystemFields, 'forced_label'] as const

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
    // Only the label is held to the row validator: a quiz may not have been given its hunt yet.
    const label = QuizValidators.row.shape.label.parse(labelInForce(quiz))
    await ctx.db.patch('quizzes', quiz._id, { label, forced_label: undefined })
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

// Each row copies what policy needs from its parent (`notes/convex.md`, *Denormalized fields*). A
// row whose parent is gone has nothing to copy, and is left for the tightening's push to name.

/** Give each quiz the hunt its realm belongs to */
export const backfillQuizCopies = migrations.define({
  table:      'quizzes',
  migrateOne: async (ctx, quiz) => {
    if (quiz.hunt_id !== undefined) { return }
    const hunt_id = await huntIdOf(ctx.db, quiz)
    if (hunt_id === null) { return }
    const row = QuizValidators.row({ ..._.omit(quiz, UnwrittenFields), hunt_id })
    await ctx.db.patch('quizzes', quiz._id, { hunt_id: row.hunt_id })
  },
})

/** Give each widgeting the hunt its quiz belongs to */
export const backfillWidgetingCopies = migrations.define({
  table:      'widgetings',
  migrateOne: async (ctx, widgeting) => {
    if (widgeting.hunt_id !== undefined) { return }
    const hunt_id = await huntIdOfLayoutRow(ctx.db, widgeting)
    if (hunt_id === null) { return }
    const row = WidgetingValidators.row({ ..._.omit(widgeting, SystemFields), hunt_id })
    await ctx.db.patch('widgetings', widgeting._id, { hunt_id: row.hunt_id })
  },
})

/** Give each column the hunt its quiz belongs to */
export const backfillColumnCopies = migrations.define({
  table:      'columns',
  migrateOne: async (ctx, column) => {
    if (column.hunt_id !== undefined) { return }
    const hunt_id = await huntIdOfLayoutRow(ctx.db, column)
    if (hunt_id === null) { return }
    const row = ColumnValidators.row({ ..._.omit(column, SystemFields), hunt_id })
    await ctx.db.patch('columns', column._id, { hunt_id: row.hunt_id })
  },
})

/** Give each widgeted the hunt and quiz its question belongs to */
export const backfillWidgetedCopies = migrations.define({
  table:      'widgeteds',
  migrateOne: async (ctx, widgeted) => {
    if (widgeted.hunt_id !== undefined && widgeted.quiz_id !== undefined) { return }
    const question = await ctx.db.get('questions', widgeted.question_id)
    if (! question) { return }
    const row = WidgetedValidators.row({ ..._.omit(widgeted, SystemFields), hunt_id: question.hunt_id, quiz_id: question.quiz_id })
    await ctx.db.patch('widgeteds', widgeted._id, { hunt_id: row.hunt_id, quiz_id: row.quiz_id })
  },
})

/** Give each reviewing the hunt, quiz and writer of its review */
export const backfillReviewingCopies = migrations.define({
  table:      'reviewings',
  migrateOne: async (ctx, reviewing) => {
    if (reviewing.hunt_id !== undefined && reviewing.quiz_id !== undefined && reviewing.ident_id !== undefined) { return }
    const copies = await reviewingCopiesOf(ctx.db, reviewing)
    if (copies === null) { return }
    const row = ReviewingValidators.row({ ..._.omit(reviewing, SystemFields), ...copies })
    await ctx.db.patch('reviewings', reviewing._id, { hunt_id: row.hunt_id, quiz_id: row.quiz_id, ident_id: row.ident_id })
  },
})

/** Give each hunting the label and title of its ident */
export const backfillHuntingCopies = migrations.define({
  table:      'huntings',
  migrateOne: async (ctx, hunting) => {
    if (hunting.ident_label !== undefined && hunting.ident_title !== undefined) { return }
    const ident = await ctx.db.get('idents', hunting.ident_id)
    if (! ident) { return }
    const row = HuntingValidators.row({ ..._.omit(hunting, SystemFields), ident_label: ident.label, ident_title: ident.title })
    await ctx.db.patch('huntings', hunting._id, { ident_label: row.ident_label, ident_title: row.ident_title })
  },
})
