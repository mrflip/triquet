import { Migrations, type MigrationFunctionReference } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { zInternalQuery } from './functions'
import * as Stamps from '../src/lib/stamps'
import { ValidatorKit } from '../src/lib/validator'
import schema from './schema'
import type { StampedTablename } from './stamping'

// Backfills that bring a deployment's rows up to the schema, run through `@convex-dev/migrations`,
// which batches them, records how far each got, and never runs a finished one twice. Each is
// written to be run again harmlessly: a row that already fits is left as it is. Rows are written
// through their row validators, as every other write is. A migration is defined here beside a
// widened schema, and removed once the schema is tightened after it (`notes/deploy.md`, *Schema
// pushes*), whose ledger names the commit that still holds each one. Every production deploy runs
// them all (`runAll`) and waits for them (`outstanding`, `scripts/convex-migrations.ts`), so a
// backfill runs itself once its widening is deployed.

const { obj, arr, str, uint, oneof } = ValidatorKit

/** A backfill not yet finished, as `outstanding` reports it */
const Unfinished = obj({ name: str, state: oneof(['inProgress', 'failed', 'canceled', 'unknown']), processed: uint, error: str.optional() })

export const migrations = new Migrations(components.migrations, { internalMutation, schema })

/**
 * Any one migration, by name.
 *
 * @example npx convex run migrations:run '{"fn": "migrations:backfillHuntStamps", "dryRun": true}'
 */
export const run = migrations.runner()

/**
 * The backfill giving each row of `table` that the stamping trigger has never seen the stamps it
 * is read with meanwhile (`Stamps.of`): made in the whole millisecond the database made it, and
 * last edited then too, unless it has been edited since the stamps arrived. A backfill is no edit:
 * a never-edited row keeps its two stamps equal, as an untouched starter question must
 * (`importQuestions`). The migrations write raw, so the trigger does not see this write. A row
 * with both stamps is left alone; the rest of the row is not read again, so no older row can hold
 * the backfill up. The stamps stay optional for good, so no tightening retires these.
 */
function stampBackfill(table: StampedTablename) {
  return migrations.define({
    table,
    migrateOne: async (ctx, held) => {
      if (held.created_at !== undefined && held.updated_at !== undefined) { return }
      const stamps = Stamps.of(held)
      await ctx.db.patch(table, held._id, { created_at: ValidatorKit.stamps.created_at.parse(stamps.created_at), updated_at: ValidatorKit.stamps.updated_at.parse(stamps.updated_at) })
    },
  })
}

// One per stamped table, each as `stampBackfill` says.
export const backfillIdentStamps     = stampBackfill('idents')
export const backfillHuntStamps      = stampBackfill('hunts')
export const backfillRealmStamps     = stampBackfill('realms')
export const backfillWidgetStamps    = stampBackfill('widgets')
export const backfillQuizStamps      = stampBackfill('quizzes')
export const backfillWidgetingStamps = stampBackfill('widgetings')
export const backfillColumnStamps    = stampBackfill('columns')
export const backfillQuestionStamps  = stampBackfill('questions')
export const backfillWidgetedStamps  = stampBackfill('widgeteds')
export const backfillReviewStamps    = stampBackfill('reviews')
export const backfillReviewingStamps = stampBackfill('reviewings')
export const backfillHuntingStamps   = stampBackfill('huntings')

/**
 * Every backfill still defined, in the order they run: the stamps'. What `runAll` runs and
 * `outstanding` reports on. A new backfill joins the end, and leaves with the tightening after it.
 * It is never empty: `runAll`, a runner of the series, refuses to run none.
 */
export const Backfills: readonly MigrationFunctionReference[] = [
  internal.migrations.backfillIdentStamps,
  internal.migrations.backfillHuntStamps,
  internal.migrations.backfillRealmStamps,
  internal.migrations.backfillWidgetStamps,
  internal.migrations.backfillQuizStamps,
  internal.migrations.backfillWidgetingStamps,
  internal.migrations.backfillColumnStamps,
  internal.migrations.backfillQuestionStamps,
  internal.migrations.backfillWidgetedStamps,
  internal.migrations.backfillReviewStamps,
  internal.migrations.backfillReviewingStamps,
  internal.migrations.backfillHuntingStamps,
]

/**
 * Every backfill still defined, in order (`Backfills`), each skipped once finished: run after every
 * production deploy, so it is harmless with nothing to do. A failure stops the series, leaving the
 * backfills after it unrun.
 *
 * @example npx convex run migrations:runAll
 */
export const runAll = migrations.runner([...Backfills])

/**
 * The backfills in `Backfills` not yet finished, with how far each got: empty once all are. A
 * backfill not yet started reads as `unknown`; one that threw, as `failed`, with its error.
 *
 * @example npx convex run migrations:outstanding  // => [{ name: 'migrations:backfillQuestionStamps', state: 'inProgress', processed: 100 }]
 */
export const outstanding = zInternalQuery({
  args:    {},
  returns: arr(Unfinished),
  handler: async (ctx) => {
    const statuses = await migrations.getStatus(ctx, { migrations: [...Backfills] })
    return statuses.flatMap(({ name, state, processed, error }) => (state === 'success' ? [] : [{ name, state, processed, error }]))
  },
})
