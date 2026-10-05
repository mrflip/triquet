import _ from 'es-toolkit/compat'
import type * as Z from 'zod'
import { Migrations, type MigrationFunctionReference } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import * as Stamps from '../src/lib/stamps'
import { HuntValidators } from '../src/models/hunt'
import { QuestionValidators } from '../src/models/question'
import { QuizValidators } from '../src/models/quiz'
import { ReviewValidators } from '../src/models/review'
import { ReviewingValidators } from '../src/models/reviewing'
import schema from './schema'
import type { StampedTablename } from './stamping'

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

/** A row validator, as far as its stamps */
type StampedRowValidator = { shape: Record<keyof Stamps.StampsT, Z.ZodType<number>> }

/**
 * The backfill giving each row of `table` written before rows were stamped the stamps it is read
 * with meanwhile (`Stamps.of`): made when the database made it, and last edited then too, unless
 * it has been edited since the stamps arrived. A row with both is left alone. The stamps are held
 * to the row validator's own fields for them; the rest of the row is not read again, so no older
 * row can hold the backfill up (a hunt nobody is on has no org, which its row requires).
 */
function stampBackfill(table: StampedTablename, row: StampedRowValidator) {
  return migrations.define({
    table,
    migrateOne: async (ctx, held) => {
      if (held.created_at !== undefined && held.updated_at !== undefined) { return }
      const stamps = Stamps.of(held)
      await ctx.db.patch(table, held._id, { created_at: row.shape.created_at.parse(stamps.created_at), updated_at: row.shape.updated_at.parse(stamps.updated_at) })
    },
  })
}

/** Stamp each hunt written before rows were stamped (`stampBackfill`) */
export const backfillHuntStamps = stampBackfill('hunts', HuntValidators.row)

/** Stamp each quiz written before rows were stamped (`stampBackfill`) */
export const backfillQuizStamps = stampBackfill('quizzes', QuizValidators.row)

/** Stamp each question written before rows were stamped (`stampBackfill`) */
export const backfillQuestionStamps = stampBackfill('questions', QuestionValidators.row)

/** Stamp each review written before rows were stamped (`stampBackfill`) */
export const backfillReviewStamps = stampBackfill('reviews', ReviewValidators.row)

/** Stamp each reviewing written before rows were stamped (`stampBackfill`) */
export const backfillReviewingStamps = stampBackfill('reviewings', ReviewingValidators.row)

/** Every backfill still defined, in the order they run: the hunts' orgs, the questions' viz, and the stamps */
export const Backfills: readonly MigrationFunctionReference[] = [
  internal.migrations.backfillHuntOrglabels,
  internal.migrations.backfillHuntStamps,
  internal.migrations.backfillQuizStamps,
  internal.migrations.backfillQuestionStamps,
  internal.migrations.backfillReviewStamps,
  internal.migrations.backfillReviewingStamps,
]

/**
 * Every backfill still defined, in order (`Backfills`).
 *
 * @example npx convex run migrations:runAll
 */
export const runAll = migrations.runner([...Backfills])
