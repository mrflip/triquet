import * as Actor from '../src/lib/actor'
import { ValidatorKit } from '../src/lib/validator'
import { refuse, refusingInvalid } from '../src/lib/refusals'
import { ActionValidators } from '../src/models/actions'
import type { IdentT } from '../src/models/ident'
import { zMutation, zQuery } from './functions'
import { affirmAccountAction } from './authorize'
import { performAccount as performAccountAction } from './writing/account_actions'

const { zid, zod } = ValidatorKit

/** The ident the asking session is now: the one its newest identing names; null when it has asserted no username, or there is no session */
export const current = zQuery({
  args:    {},
  handler: async (ctx): Promise<IdentT | null> => {
    if (Actor.isAnonymous(ctx.actor)) { return null }
    const ident = await ctx.db.get('idents', ctx.actor.ident_id)
    return ident && { _id: ident._id, label: ident.label, title: ident.title }
  },
})

/**
 * Carry out what a visitor did before opening any quiz: assert a username, retitle it, make a
 * hunt, or retitle or relabel a hunt they smith (`authorize`). See `writing/account_actions`.
 *
 * @returns The ident taken on or retitled, or the hunt made or changed.
 * @throws A `ConvexError` whose data is a refusal (`lib/refusals`: `notSignedIn` for a request
 *   with no session, `notIdentified` for a hunt named by a session that has asserted no
 *   username, `notPermitted` for one its ident may not change, `usernameClaimed` for a username
 *   another session holds), or `{ ZodError }` for an argument that is not valid; nothing is
 *   written.
 */
export const performAccount = zMutation({
  args:    { action: ActionValidators.accountAction },
  returns: zod.union([zid('idents'), zid('hunts')]),
  handler: async (ctx, { action }) => await refusingInvalid(async () => {
    const { actor, user_id } = ctx
    if (user_id === null) { refuse('notSignedIn') }
    await affirmAccountAction(ctx.db, actor, action)
    return await performAccountAction(ctx.db, user_id, actor, action)
  }),
})
