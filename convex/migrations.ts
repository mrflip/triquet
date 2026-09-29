import _ from 'es-toolkit/compat'
import { Migrations } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import schema from './schema'
import { HuntingValidators } from '../src/models/hunting'
import { QuestionValidators } from '../src/models/question'
import { ReviewValidators } from '../src/models/review'
import { huntIdOfRow, huntingsOf, identForLabel } from './reading'

// Backfills that bring a deployment's rows up to the schema, run through `@convex-dev/migrations`,
// which batches them, records how far each got, and never runs a finished one twice. Each is
// written to be run again harmlessly: a row that already fits is left as it is. Rows are written
// through their row validators, as every other write is.

export const migrations = new Migrations(components.migrations, { internalMutation, schema })

/**
 * Any one migration, by name.
 *
 * @example npx convex run migrations:run '{"fn": "migrations:backfillQuestionHuntIds", "dryRun": true}'
 */
export const run = migrations.runner()

/** The ident made smith of a hunt that has nobody on it */
export const CaretakerLabel = 'mrflip'

/**
 * Give each question its hunt's id (`hunt_id`), found through its quiz's realm, for questions
 * written before a question named its hunt. One whose quiz or realm is gone is left without, and
 * the next schema push names it.
 */
export const backfillQuestionHuntIds = migrations.define({
  table:      'questions',
  migrateOne: async (ctx, question) => {
    const hunt_id = question.hunt_id === undefined && await huntIdOfRow(ctx.db, question)
    if (! hunt_id) { return }
    const row = QuestionValidators.row({ ..._.omit(question, ['_id', '_creationTime']), hunt_id })
    await ctx.db.patch('questions', question._id, { hunt_id: row.hunt_id })
  },
})

/**
 * Give each review its hunt's id (`hunt_id`), found through its quiz's realm, for reviews written
 * before a review named its hunt. One whose quiz or realm is gone is left without, and the next
 * schema push names it.
 */
export const backfillReviewHuntIds = migrations.define({
  table:      'reviews',
  migrateOne: async (ctx, review) => {
    const hunt_id = review.hunt_id === undefined && await huntIdOfRow(ctx.db, review)
    if (! hunt_id) { return }
    const row = ReviewValidators.row({ ..._.omit(review, ['_id', '_creationTime']), hunt_id })
    await ctx.db.patch('reviews', review._id, { hunt_id: row.hunt_id })
  },
})

/**
 * Make the caretaker (`CaretakerLabel`) smith of each hunt nobody is on: hunts made before a hunt
 * had members, which no one could open or add anyone to otherwise. A hunt with anyone on it is
 * left as it is, and so is every hunt on a deployment where no ident answers to the label.
 */
export const adoptMemberlessHunts = migrations.define({
  table:      'hunts',
  migrateOne: async (ctx, hunt) => {
    const [huntings, caretaker] = await Promise.all([huntingsOf(ctx.db, hunt._id), identForLabel(ctx.db, CaretakerLabel)])
    if (! caretaker || huntings.length > 0) { return }
    await ctx.db.insert('huntings', HuntingValidators.row({ hunt_id: hunt._id, ident_id: caretaker._id, role: 'smith' }))
  },
})

/**
 * Every backfill above, in order; one already finished is skipped.
 *
 * @example npx convex run migrations:runAll
 */
export const runAll = migrations.runner([
  internal.migrations.backfillQuestionHuntIds,
  internal.migrations.backfillReviewHuntIds,
  internal.migrations.adoptMemberlessHunts,
])
