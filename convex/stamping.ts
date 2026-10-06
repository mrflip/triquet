import type { TableNames } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import * as Stamps from '../src/lib/stamps'

// Every row of ours a write lands on is stamped here, by a trigger (convex-helpers' Triggers,
// registered in `triggers.ts`), rather than by each writer: `functions.ts` hands every mutation it
// builds a database wrapped by `triggers.wrapDB`, and the trigger writes the stamps through the
// database beneath it, which runs no trigger again. A writer never names a stamp, and an import does not carry one.
//
// What this does not see: a write from the Convex dashboard, and the migrations' own internal
// mutations (`migrations.ts`), which write raw on purpose so that a backfill is no edit. A row the
// trigger has never seen is read as `Stamps.of` reads it.

/**
 * The tables whose rows are stamped: every table of ours the app writes, but `identings`, each row
 * of which is one assertion of a username, appended and never edited, so that its `_creationTime`
 * is its whole history. Convex Auth's tables are its own.
 */
export const StampedTables = [
  'idents', 'hunts', 'realms', 'widgets', 'quizzes', 'widgetings', 'columns', 'questions', 'widgeteds', 'reviews', 'reviewings', 'huntings',
] as const satisfies readonly TableNames[]
export type StampedTablename = typeof StampedTables[number]

/** A write that landed on a stamped row, as a trigger is told it: the row as it stood (null for an insert) and as it stands */
type StampedChangeT = { id: string, operation: 'insert' | 'update' | 'delete', oldDoc: Stamps.StampableT | null, newDoc: Stamps.StampableT | null }

/**
 * The stamps a write leaves a row with: made in the whole millisecond of its `_creationTime` (or
 * when it already says it was made), and on an insert last edited then too, so that a row nobody
 * has edited has its two stamps equal; at every later write, last edited at `now`, the moment of
 * the mutation. A row the trigger never saw takes its `created_at` at its first write. A write
 * that leaves the stamps out (a replace) keeps the row's.
 *
 * @param tablename - Whose row, for the refusal.
 * @param change - What the write did.
 * @param now - The moment of the mutation, in epoch milliseconds.
 * @returns The stamps to write; null for a deletion.
 * @throws When the write changes a `created_at` the row already held: once written, it never changes.
 *
 * @example stampsAfter('questions', { id, operation: 'insert', oldDoc: null, newDoc: { _creationTime: 5.5 } }, 9)  // => { created_at: 5, updated_at: 5 }
 * @example stampsAfter('questions', { id, operation: 'update', oldDoc: { _creationTime: 5.5, created_at: 5 }, newDoc: { _creationTime: 5.5, created_at: 5 } }, 9)  // => { created_at: 5, updated_at: 9 }
 */
export function stampsAfter(tablename: string, change: StampedChangeT, now: number): Stamps.StampsT | null {
  const { operation, oldDoc, newDoc } = change
  if (operation === 'delete' || newDoc === null) { return null }
  const held = oldDoc?.created_at
  if (held !== undefined && newDoc.created_at !== undefined && newDoc.created_at !== held) {
    throw new Error(`${tablename} ${change.id}: created_at is immutable, and this write would change it from ${String(held)} to ${String(newDoc.created_at)}`)
  }
  const created_at = held ?? newDoc.created_at ?? Math.floor(newDoc._creationTime)
  return { created_at, updated_at: operation === 'insert' ? created_at : now }
}

/** The trigger that stamps each write landing on a row of `tablename` (`stampsAfter`), through the database beneath the triggers */
export function stamping(tablename: StampedTablename) {
  return async (ctx: { innerDb: MutationCtx['db'] }, change: StampedChangeT): Promise<void> => {
    const stamps = stampsAfter(tablename, change, Date.now())
    if (stamps) { await ctx.innerDb.patch(tablename, change.id as never, stamps) }
  }
}
