import { ValidatorKit } from '../src/lib/validator'
import { ActionValidators } from '../src/models/actions'
import { IdentingValidators } from '../src/models/identing'
import type { IdentT } from '../src/models/ident'
import { zMutation, zQuery } from './functions'
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
 * Carry out what a visitor did before opening any quiz: take on an ident, or make a hunt. See
 * `writing/account_actions`.
 *
 * @returns The ident taken on, or the hunt made; null when the hunt was refused.
 */
export const performAccount = zMutation({
  args:    { action: ActionValidators.accountAction, browser_key: IdentingValidators.browserKey },
  returns: zod.union([zid('idents'), zid('hunts'), zod.null()]),
  handler: async (ctx, { action, browser_key }) => await performAccountAction(ctx.db, browser_key, action),
})
