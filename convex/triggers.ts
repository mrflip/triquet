import { Triggers } from 'convex-helpers/server/triggers'
import type { DataModel } from './_generated/dataModel'
import { SignalledTables, signalling } from './signalling'
import { StampedTables, stamping } from './stamping'

/**
 * The triggers every mutation's database runs (`functions.ts`, through `triggers.wrapDB`): the
 * stamps of every stamped table (`stamping.ts`), and then the change signal of the quiz a write
 * changes the files of (`signalling.ts`). Each writes through the database beneath the triggers,
 * which runs none again.
 */
export const triggers = new Triggers<DataModel>()
for (const tablename of StampedTables) { triggers.register(tablename, stamping(tablename)) }
for (const tablename of SignalledTables) { triggers.register(tablename, signalling(tablename)) }
