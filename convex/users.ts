import * as Actor from '../src/lib/actor'
import { ValidatorKit } from '../src/lib/validator'
import { refuse, refusingInvalid } from '../src/lib/refusals'
import { ActionValidators } from '../src/models/actions'
import type { CurrentIdentT } from '../src/models/ident'
import { zMutation, zQuery } from './functions'
import { affirmUserAction } from './authorize'
import { performUser } from './writing/user_actions'

const { zid } = ValidatorKit

/**
 * Who the asking session is now: the ident its newest identing names, and the actor the server
 * builds of it for every request, so the browser decides what to offer as the server decides what
 * to allow (`Approve`). Null when it has asserted no userlabel, or there is no session.
 */
export const current = zQuery({
  args:    {},
  handler: async (ctx): Promise<CurrentIdentT | null> => {
    if (Actor.isAnonymous(ctx.actor)) { return null }
    const ident = await ctx.db.get('idents', ctx.actor.ident_id)
    return ident && { ident: { _id: ident._id, label: ident.label, title: ident.title }, actor: ctx.actor }
  },
})

/**
 * Carry out what a visitor did as themselves: assert a userlabel, or retitle it. See
 * `writing/user_actions`.
 *
 * @returns The ident taken on or retitled.
 * @throws A `ConvexError` whose data is a refusal (`lib/refusals`: `notSignedIn` for a request
 *   with no session, `notIdentified` for a retitle by a session that has asserted no userlabel,
 *   `userlabelClaimed` for a userlabel another session holds), or `{ ZodError }` for an argument
 *   that is not valid; nothing is written.
 */
export const perform = zMutation({
  args:    { action: ActionValidators.userAction },
  returns: zid('idents'),
  handler: async (ctx, { action }) => await refusingInvalid(async () => {
    const { actor, user_id } = ctx
    if (user_id === null) { refuse('notSignedIn') }
    affirmUserAction(actor, action)
    return await performUser(ctx.db, user_id, actor, action)
  }),
})
