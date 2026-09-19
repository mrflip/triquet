import path from 'node:path'
import * as Z from 'zod'
import { createClient } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from './schema'
import { SeedPlayers } from '../models/player'

export type Db = LibSQLDatabase<typeof schema>

/** Where the database lives unless `TRIQUET_DATABASE_URL` says otherwise: a plain local file */
export const DefaultDatabaseUrl = 'file:data/triquet.db'

/** Where drizzle-kit writes the migrations, and so where they are read back from */
export const MigrationsFolder = path.join(process.cwd(), 'drizzle')

const DatabaseUrl = Z.string().regex(/^(file:|:memory:$)/, 'must be a local database: file:path/to.db, or :memory:')

/**
 * Database at `url`, migrated to the current schema, with its players in step with this build.
 *
 * @param url - A libSQL url; `:memory:` for one that lives only as long as the process.
 * @returns A ready database.
 * @throws When `url` is not a local database, or a migration fails.
 *
 * @example const db = await openDb(':memory:')
 */
export async function openDb(url: string): Promise<Db> {
  const db = drizzle(createClient({ url: DatabaseUrl.parse(url) }), { schema })
  await migrate(db, { migrationsFolder: MigrationsFolder })
  await syncPlayers(db)
  return db
}

/**
 * The seeded players, written over whatever the database holds for them.
 *
 * The prompts are shown to the author from this build's own copy, so the database must never
 * be allowed to disagree with it.
 */
async function syncPlayers(db: Db): Promise<void> {
  for (const player of SeedPlayers) {
    await db.insert(schema.players).values(player)
      .onConflictDoUpdate({ target: schema.players.label, set: player })
  }
}

/**
 * The database url a deployment asks for, or the default when it asks for none.
 *
 * @param raw - The environment variable's text; blank counts as unset.
 * @returns A url for `openDb`.
 *
 * @example databaseUrlFrom('')  // => 'file:data/triquet.db'
 */
export function databaseUrlFrom(raw: string | undefined): string {
  return raw === undefined || raw.trim() === '' ? DefaultDatabaseUrl : raw
}

/** Held on the global object, so a dev-server reload reuses the connection rather than leaking one */
const held = globalThis as typeof globalThis & { triquetDb?: Promise<Db> }

/**
 * The app's one database, opened on first use.
 *
 * @returns The database named by `TRIQUET_DATABASE_URL`, or the default local file.
 */
export function appDb(): Promise<Db> {
  held.triquetDb ??= openDb(databaseUrlFrom(process.env.TRIQUET_DATABASE_URL))
  return held.triquetDb
}
