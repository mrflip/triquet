/**
 * When a row a person makes and edits was made, and last edited: its **stamps**, `created_at` and
 * `updated_at`, each in epoch milliseconds (UTC by definition). The database's writer gives a row
 * both from one moment when it is inserted, so the two are equal until its first edit, and moves
 * `updated_at` at every edit after (`convex/stamping.ts`). Where a person reads them (a jsonball, a
 * table), they are written as ISO-8601 UTC strings ending in `Z`.
 */

/** The fields that hold a row's stamps */
export const StampFieldnames = ['created_at', 'updated_at'] as const

/** A row's stamps, in epoch milliseconds */
export type StampsT = { created_at: number, updated_at: number }

/** A thing's stamps as a person reads them: ISO-8601 in UTC, or null where they are not known */
export type IsoStampsT = { created_at: string | null, updated_at: string | null }

/** A row as the database hands it back, stamped or written before rows were */
export type StampableT = { _creationTime: number, created_at?: number, updated_at?: number }

/**
 * The stamps of a row: its own, or for a row written before rows were stamped, what the backfill
 * gives it (the stamp backfills of `convex/migrations.ts`): made when the database made it, and not edited since,
 * unless it has been edited since the stamps arrived.
 *
 * @example of({ _creationTime: 1759700000000.5 })  // => { created_at: 1759700000000, updated_at: 1759700000000 }
 * @example of({ _creationTime: 1, created_at: 2, updated_at: 3 })  // => { created_at: 2, updated_at: 3 }
 */
export function of(row: StampableT): StampsT {
  const created_at = row.created_at ?? Math.floor(row._creationTime)
  return { created_at, updated_at: row.updated_at ?? created_at }
}

/**
 * Whether a row has not been edited since it was made: its stamps are equal.
 *
 * @example isUntouched({ created_at: 5, updated_at: 5 })  // => true
 */
export function isUntouched(stamps: StampsT): boolean {
  return stamps.created_at === stamps.updated_at
}

/**
 * A thing's stamps as a person reads them (`isoOf`): a row as the database hands it back, read as
 * `of` reads it; a thing of the tree, its own (null when not known: built rather than read, or not
 * sent to its reader).
 *
 * @example isoStampsOf({ created_at: 0, updated_at: null })  // => { created_at: '1970-01-01T00:00:00.000Z', updated_at: null }
 * @example isoStampsOf({ _creationTime: 0.5 })              // => { created_at: '1970-01-01T00:00:00.000Z', updated_at: '1970-01-01T00:00:00.000Z' }
 */
export function isoStampsOf(thing: { _creationTime?: number, created_at?: number | null, updated_at?: number | null }): IsoStampsT {
  const { _creationTime, created_at, updated_at } = thing
  const stamps = _creationTime === undefined ? { created_at, updated_at } : of({ _creationTime, created_at: created_at ?? undefined, updated_at: updated_at ?? undefined })
  return { created_at: isoOf(stamps.created_at ?? null), updated_at: isoOf(stamps.updated_at ?? null) }
}

/**
 * An epoch-milliseconds stamp as a person reads it, ISO-8601 in UTC; null for a stamp not known
 * (a thing built rather than read from the database, or a field its reader was not sent).
 *
 * @example isoOf(0)     // => '1970-01-01T00:00:00.000Z'
 * @example isoOf(null)  // => null
 */
export function isoOf(stamp: number | null): string | null {
  return stamp === null ? null : new Date(stamp).toISOString()
}
