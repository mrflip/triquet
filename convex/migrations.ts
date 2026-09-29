import { Migrations } from '@convex-dev/migrations'
import { components } from './_generated/api'
import { internalMutation } from './_generated/server'
import schema from './schema'

// Backfills that bring a deployment's rows up to the schema, run through `@convex-dev/migrations`,
// which batches them, records how far each got, and never runs a finished one twice. None is
// pending: a migration is defined here beside a widened schema, and removed once the schema is
// tightened after it (`notes/deploy.md`, *Schema pushes*).

export const migrations = new Migrations(components.migrations, { internalMutation, schema })

/** Any one migration, by name: `npx convex run migrations:run '{"fn": "migrations:<name>"}'` */
export const run = migrations.runner()
