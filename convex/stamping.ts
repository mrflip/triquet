import _ from 'es-toolkit/compat'
import type { GenericId } from 'convex/values'
import type { TableNames } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import * as Stamps from '../src/lib/stamps'

// Every public mutation writes through this (`functions.ts`), so a row a person makes or edits is
// stamped in one place rather than by each writer. A row validator gives a row it checks the
// stamps of the moment it is checked (`ValidatorKit.stamp`), and this sets them to the moment of
// the mutation as the row goes in; an author never sets them, and an import does not carry them.

/** What a mutation writes through */
type Writer = MutationCtx['db']

/**
 * The tables whose rows a person makes and edits through the app, and which carry stamps: a hunt,
 * a quiz and its questions, and a review and its verdicts. A quiz's widgetings and columns are its
 * layout, whose changes are the quiz's; the rest are made by the app, or recorded and never edited.
 */
export const StampedTables = ['hunts', 'quizzes', 'questions', 'reviews', 'reviewings'] as const satisfies readonly TableNames[]
export type StampedTablename = typeof StampedTables[number]

/** Whether rows of `tablename` carry stamps */
export function isStamped(tablename: string): tablename is StampedTablename {
  return (StampedTables as readonly string[]).includes(tablename)
}

/** The stamps in `fields` taken out: they are this writer's to write */
function unstamped(fields: Record<string, unknown>): Record<string, unknown> {
  return _.omit(fields, ['created_at', 'updated_at'])
}

/**
 * `db`, stamping what it writes to a stamped table (`StampedTables`) with `now`: a row inserted is
 * made and last edited then, the two stamps equal; a patch that changes anything moves its
 * `updated_at` to then, and one that changes nothing is not written; a replace keeps the row's
 * `created_at`. Stamps an author's write carries are set aside. Everything else passes straight
 * through.
 *
 * @param db - The mutation's own database.
 * @param now - The moment of the mutation, in epoch milliseconds.
 *
 * @example await stampingWriter(ctx.db, Date.now()).insert('questions', row)  // its created_at and updated_at are both now
 */
export function stampingWriter(db: Writer, now: number): Writer {
  /** The table of a write, named or found from the id */
  const tableOf = (named: string | null, id: GenericId<string>): string | null => named ?? StampedTables.find((tablename) => db.normalizeId(tablename, id) !== null) ?? null

  /** A write's arguments, the table named or not, as the table, the id and the fields */
  const argsOf = (args: unknown[]): [string | null, GenericId<string>, Record<string, unknown>] => (
    (args.length === 3 ? args : [null, ...args]) as [string | null, GenericId<string>, Record<string, unknown>]
  )

  const insert = async (tablename: string, fields: Record<string, unknown>) => (
    await (db.insert as (...args: unknown[]) => Promise<unknown>)(tablename, isStamped(tablename) ? { ...fields, created_at: now, updated_at: now } : fields)
  )

  const patch = async (...args: unknown[]): Promise<void> => {
    const [named, id, fields] = argsOf(args)
    const write = async (patched: Record<string, unknown>) => { await (db.patch as (...args: unknown[]) => Promise<void>)(...(named === null ? [id, patched] : [named, id, patched])) }
    if (! isStamped(tableOf(named, id) ?? '')) {
      await write(fields)
      return
    }
    const changed = unstamped(fields)
    if (! _.isEmpty(changed)) { await write({ ...changed, updated_at: now }) }
  }

  const replace = async (...args: unknown[]): Promise<void> => {
    const [named, id, fields] = argsOf(args)
    const write = async (replaced: Record<string, unknown>) => { await (db.replace as (...args: unknown[]) => Promise<void>)(...(named === null ? [id, replaced] : [named, id, replaced])) }
    const tablename = tableOf(named, id)
    if (tablename === null || ! isStamped(tablename)) {
      await write(fields)
      return
    }
    const held = await db.get(tablename, id as GenericId<StampedTablename>)
    await write({ ...unstamped(fields), created_at: held ? Stamps.of(held).created_at : now, updated_at: now })
  }

  const stamping: Record<string, unknown> = { insert, patch, replace }
  // The database's own methods are bound to it, and only these three are taken over.
  return new Proxy(db, {
    get: (target, prop) => {
      if (typeof prop === 'string' && Object.hasOwn(stamping, prop)) { return stamping[prop] }
      const val: unknown = Reflect.get(target, prop)
      return typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(target) : val
    },
  })
}
