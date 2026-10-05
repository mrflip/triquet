import _ from 'es-toolkit/compat'
import { Migrations } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import * as PA from '../src/lib/vv/patterns'
import { DefaultBranch, HuntValidators } from '../src/models/hunt'
import schema from './schema'

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
 * @example npx convex run migrations:run '{"fn": "migrations:backfillHuntBranches", "dryRun": true}'
 */
export const run = migrations.runner()

/**
 * Put each hunt written before a hunt had a branch on the version its quizzes were on: the one
 * most of them shared, `main` among those tied for most, else the first of those in order, and
 * `main` for a hunt whose quizzes name none.
 */
export const backfillHuntBranches = migrations.define({
  table:      'hunts',
  migrateOne: async (ctx, hunt) => {
    if (hunt.branch !== undefined) { return }
    const quizzes = await ctx.db.query('quizzes').withIndex('by_hunt_id', (cvx) => cvx.eq('hunt_id', hunt._id)).take(PA.RealmsPerHunt.max * PA.QuizzesPerRealm.max)
    const row = HuntValidators.row({ ..._.omit(hunt, ['_id', '_creationTime']), branch: branchOf(quizzes.map((quiz) => quiz.version)) })
    await ctx.db.patch('hunts', hunt._id, { branch: row.branch })
  },
})

/** The version most of `versions` name, `main` winning a tie it is part of; `main` when none is named */
function branchOf(versions: readonly (string | undefined)[]): string {
  const counts = _.countBy(versions.filter((version) => version !== undefined))
  const most = _.max(Object.values(counts))
  if (most === undefined) { return DefaultBranch }
  const tied = Object.keys(counts).filter((version) => counts[version] === most)
  return tied.includes(DefaultBranch) ? DefaultBranch : tied.toSorted((left, right) => left.localeCompare(right))[0] ?? DefaultBranch
}

/** Take `version` off every quiz still holding it, once its hunt has a branch to stand for it */
export const retireQuizVersions = migrations.define({
  table:      'quizzes',
  migrateOne: async (ctx, quiz) => {
    if (quiz.version === undefined) { return }
    await ctx.db.patch('quizzes', quiz._id, { version: undefined })
  },
})

/**
 * Both, in the order they need: each hunt takes its branch from its quizzes' versions before the
 * versions are taken off.
 *
 * @example npx convex run migrations:runAll
 */
export const runAll = migrations.runner([internal.migrations.backfillHuntBranches, internal.migrations.retireQuizVersions])
