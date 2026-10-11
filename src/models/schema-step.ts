import type * as Z from 'zod'
import { Validator } from '../lib/validator'

/*
 * The **migrations table**: one row per schema step a backend has taken, written by whatever
 * pushed the step (`notes/deploy.md`, *The two modes*). A schema step is a commit on `main` that
 * changes `convex/schema.ts` or `convex/migrations.ts`; its row says it was pushed to this
 * backend, and whether its backfills have finished since. The newest row is the backend's
 * high-water mark: `scripts/deploy.ts` walks the steps newer than it, and nothing is inferred
 * from what a deployment or a website happens to be serving. It travels with the data, so a
 * snapshot imported elsewhere brings its own mark.
 */

export const SchemaStepValidators = Validator(({ obj, str, timestamp }) => {
  const sha = str.regex(/^[0-9a-f]{40}$/, 'a full commit hash: forty lowercase hex digits')
    .describe('The step\'s commit, in full: a first-parent commit of `main` (or of the branch a local backend follows).')

  const row = obj({
    sha,
    subject:       str.min(1).max(500)
      .describe('The commit\'s subject line, so the table reads without git at hand.'),
    pushed_at:     timestamp
      .describe('When the step\'s schema and functions were pushed to this backend, in epoch milliseconds.'),
    backfilled_at: timestamp.nullable()
      .describe('When every backfill the step defines had finished on this backend; null while they run, or when whatever pushed it never looked.'),
  })
    .describe('One schema step this backend has taken: pushed, and backfilled or not yet.')

  return { row, sha }
})

export type SchemaStepRowT = Z.output<typeof SchemaStepValidators.row>
