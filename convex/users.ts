import * as Actor from '../src/lib/actor'
import { ValidatorKit } from '../src/lib/validator'
import { refuse, refusingInvalid } from '../src/lib/refusals'
import { ActionValidators } from '../src/models/actions'
import type { CurrentUserT, OwnUserT } from '../src/models/user'
import { zMutation, zQuery } from './functions'
import { affirmUserAction } from './authorize'
import { ownUserOf } from './reading'
import { performUser } from './writing/user_actions'

const { zid } = ValidatorKit

/**
 * Who the asking session is now: its user, by its userlabel and title, and the actor the server
 * builds of it for every request, so the browser decides what to offer as the server decides what
 * to allow (`Approve`). Null while the user holds no userlabel, or there is no session. Never its
 * email: that is `own`'s.
 */
export const current = zQuery({
  args:    {},
  handler: (ctx): CurrentUserT | null => {
    const { actor } = ctx
    if (Actor.isUnlabelled(actor)) { return null }
    return { user: { _id: actor.user_id, userlabel: actor.userlabel, title: actor.usertitle }, actor }
  },
})

/**
 * What the asking session's user is told of itself and nobody else is (`OwnUserT`): whether it is
 * signed in with Google, the email Google sent, the handle the front door offers it while it holds
 * none, and a name choice a merge left it. Only ever of the session's own user, whose id comes from
 * the session and never from an argument: the one query that returns an email. Null with no
 * session.
 */
export const own = zQuery({
  args:    {},
  handler: async (ctx): Promise<OwnUserT | null> => {
    const { user_id } = ctx
    if (user_id === null) { return null }
    return await ownUserOf(ctx.db, user_id)
  },
})

/**
 * Carry out what a visitor did as themselves: take a userlabel, retitle the user they are, or
 * settle the name choice a merge left them. See `writing/user_actions`.
 *
 * @returns The user that took the userlabel, or was retitled.
 * @throws A `ConvexError` whose data is a refusal (`lib/refusals`: `notSignedIn` for a request
 *   with no session, `notIdentified` for a retitle by a user holding no userlabel, `userlabelSet`
 *   for a user taking a second one, `userlabelClaimed` for a userlabel that is not free,
 *   `nameChoiceGone` for a name choice not pending), or
 *   `{ ZodError }` for an argument that is not valid; nothing is written.
 */
export const perform = zMutation({
  args:    { action: ActionValidators.userAction },
  returns: zid('users'),
  handler: async (ctx, { action }) => await refusingInvalid(async () => {
    const { actor, user_id } = ctx
    if (user_id === null) { refuse('notSignedIn') }
    affirmUserAction(actor, action)
    return await performUser(ctx.db, user_id, actor, action)
  }),
})
