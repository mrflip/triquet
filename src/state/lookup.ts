import { withTimeout } from 'es-toolkit'
import type { Db, QueryBuilder } from 'jazz-tools'
import { LocalFirst } from './quiz-rows'

/** How long a browser that holds nothing waits to hear from the server before deciding on its own */
export const ServerLookupMillis = 3000

/**
 * What the server holds for `query`, when it answers within `ServerLookupMillis`.
 *
 * The server only advises. One that cannot be reached fails the read, and one that will not serve
 * this app never answers; either way the browser goes on with what it holds.
 *
 * @param db - The account's database.
 * @param query - What to ask for.
 * @returns The rows the server has; null when it did not answer in time, or at all.
 *
 * @example await askServer(db, app.hunts.where({ label: 'quiet_otter' }))
 */
export async function askServer<RT>(db: Db, query: QueryBuilder<RT>): Promise<RT[] | null> {
  try {
    return await withTimeout(async () => await db.all(query, { tier: 'remote-if-possible' }), ServerLookupMillis)
  } catch {
    return null
  }
}

/**
 * The rows `query` finds in this browser or, when it holds none, on the server.
 *
 * A browser that has never synced holds nothing, so "nothing here" is only an answer once the
 * server has had its say. Where this browser already holds a match, the server is not asked.
 *
 * @param db - The account's database.
 * @param query - What to look for.
 * @returns What this browser holds; failing that, what the server has; failing that, nothing.
 *
 * @example const [ident] = await lookUp(db, app.idents.where({ label }).orderBy('$createdAt').limit(1))
 */
export async function lookUp<RT>(db: Db, query: QueryBuilder<RT>): Promise<RT[]> {
  const local = await db.all(query, LocalFirst)
  if (local.length > 0) { return local }
  return await askServer(db, query) ?? []
}
