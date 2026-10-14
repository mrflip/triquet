import { ValidatorKit } from '../src/lib/validator'
import { zInternalQuery } from './functions'
import { RowValidators } from './schema'

const { str } = ValidatorKit

// The rows the app holds, table by table, a page at a time and unjudged: what `scripts/check_reserved`
// reads a deployment through, with the deployment's key, to judge each row by the row validators of
// the checkout it runs from. So a branch growing a reserved list, or tightening a validator, learns
// which rows it would refuse before it is deployed, when they would be locked (`notes/deploy.md`,
// *Checking the reserved list against production*). Internal and read-only.

/**
 * How many rows a page holds: few enough that a page of the longest rows we write (a quiz's notes,
 * a question's texts, a bot's reply) stays well inside what one query may read. No byte limit is
 * set, as one reached may hand back a page short of rows without saying which; a page reading past
 * Convex's own limit fails the query instead, loudly.
 */
const PageRows = 100

/**
 * The fields of a table's rows a page leaves out: how to reach whoever is behind a user (email and
 * phone, and when each was verified), and what Google says of them (name, picture, locale,
 * Workspace domain). Defence in depth: the rows reach the machine running the guard, and none of
 * this need go with them. Each field is optional, and none is held to a label's words or to any
 * check beyond being text or a number, so no row's verdict changes; a branch adding a check to one
 * of them goes unwarned. A user's title stays: it is shown to other users already, and `titleish`
 * holds every title in the app.
 */
export const Unsent: Partial<Record<keyof typeof RowValidators, readonly string[]>> = {
  users: [
    'email', 'emailVerificationTime', 'phone', 'phoneVerificationTime',
    'name', 'image', 'locale', 'hosted_domain',
  ] satisfies (keyof typeof RowValidators.users.shape)[],
}

/**
 * One page of the rows `table` holds, in the order they were made, from `cursor` (null for the
 * first), as Convex paginates them: `page`, `isDone`, and the `continueCursor` to ask from next.
 * Only our own tables are read, those with a row validator (`RowValidators`): Convex Auth's own
 * hold tokens and secrets, which nothing here judges. How to reach the person behind a user, and
 * what Google says of them, are left out (`Unsent`). A table that is not one of this deployment's
 * own (one a newer checkout adds) answers null.
 *
 * @returns The page, or null for a table that is not one of this deployment's own.
 *
 * @example npx convex run check_reserved:page '{"table":"hunts","cursor":null}'
 *   // => { page: [{ _id: '…', label: 'quiet_otter', orglabel: 'flip_kromer', … }], isDone: true, continueCursor: '…' }
 */
export const page = zInternalQuery({
  args:    {
    table:  str.describe('The table to read: one of ours, as `RowValidators` names them.'),
    cursor: str.nullable().describe('Where the page begins: the `continueCursor` of the page before, or null for the first.'),
  },
  handler: async (ctx, { table, cursor }) => {
    if (! Object.hasOwn(RowValidators, table)) { return null }
    const tablename = table as keyof typeof RowValidators
    const paged = await ctx.db.query(tablename).paginate({ cursor, numItems: PageRows })
    const unsent = Unsent[tablename] ?? []
    const page = paged.page.map((row): Record<string, unknown> => Object.fromEntries(Object.entries(row).filter(([fieldname]) => ! unsent.includes(fieldname))))
    return { ...paged, page }
  },
})
