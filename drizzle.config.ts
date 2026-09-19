import { defineConfig } from 'drizzle-kit'
import { databaseUrlFrom } from './src/db/client'

/** Migrations are generated from the schema, checked in, and applied by the app when it opens the database */
export default defineConfig({
  dialect:       'turso',
  schema:        './src/db/schema.ts',
  out:           './drizzle',
  dbCredentials: { url: databaseUrlFrom(process.env.TRIQUET_DATABASE_URL) },
})
