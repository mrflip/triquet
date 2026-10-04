import { ValidatorKit } from '../src/lib/validator'
import { refuse, refusingInvalid } from '../src/lib/refusals'
import { ActionValidators } from '../src/models/actions'
import { IdentingValidators } from '../src/models/identing'
import type { IdentT } from '../src/models/ident'
import { zMutation, zQuery } from './functions'
import { mayActOnAccount } from './authorize'
import { identFor } from './reading'
import { performAccount as performAccountAction } from './writing/account_actions'

const { zid, zod } = ValidatorKit

/** The ident the browser `browser_key` is now: the one its newest identing names; null when it has never said */
export const current = zQuery({
  args:    { browser_key: IdentingValidators.browserKey },
  handler: async (ctx, { browser_key }): Promise<IdentT | null> => {
    const ident = await identFor(ctx.db, browser_key)
    return ident && { _id: ident._id, label: ident.label, title: ident.title }
  },
})

/**
 * Carry out what a visitor did before opening any quiz: take on an ident, retitle it, make a
 * hunt, or retitle, relabel or arrange the categories of a hunt they smith (`authorize`). See `writing/account_actions`.
 *
 * @returns The ident taken on or retitled, or the hunt made or changed.
 * @throws A `ConvexError` whose data is a refusal (`lib/refusals`: `notIdentified` for a hunt
 *   named by a browser that has not said who it is, `notPermitted` for one its ident may not
 *   change), or `{ ZodError }` for an argument that is not valid; nothing is written.
 */
export const performAccount = zMutation({
  args:    { action: ActionValidators.accountAction, browser_key: IdentingValidators.browserKey },
  returns: zod.union([zid('idents'), zid('hunts')]),
  handler: async (ctx, { action, browser_key }) => await refusingInvalid(async () => {
    const ident = await identFor(ctx.db, browser_key)
    if (! await mayActOnAccount(ctx.db, ident?._id ?? null, action)) { refuse(ident ? 'notPermitted' : 'notIdentified') }
    return await performAccountAction(ctx.db, browser_key, action)
  }),
})
