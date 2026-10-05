import _ from 'es-toolkit/compat'
import * as Actor from '../src/lib/actor'
import * as Approve from '../src/lib/approve'
import { ValidatorKit } from '../src/lib/validator'
import { refuse, refusingInvalid } from '../src/lib/refusals'
import { huntListingOf, shallowHuntOf, smithsOf, type HuntOpeningT, type ListedHuntT } from '../src/lib/rows'
import { ActionValidators } from '../src/models/actions'
import type { HuntT } from '../src/models/hunt'
import { zMutation, zQuery } from './functions'
import { affirmPerform, affirmReadHunt, claimsFor } from './authorize'
import { huntForLabel, huntingsFor, huntRowsOf, membersOf, realmsOf, wholeHuntOf } from './reading'
import { perform as performAction } from './writing/perform'

const { label, zid, zod } = ValidatorKit

/**
 * The hunts the asking actor is on, as the hunts list shows them, each with its role there, in
 * the order they were made. None for an actor who has asserted no username.
 */
export const list = zQuery({
  args:    {},
  handler: async (ctx): Promise<ListedHuntT[]> => {
    const { actor } = ctx
    const huntings = Actor.isAnonymous(actor) ? [] : await huntingsFor(ctx.db, actor.ident_id)
    const listed = await Promise.all(huntings.map(async ({ hunt_id, role }) => {
      const hunt = await ctx.db.get('hunts', hunt_id)
      return hunt && { made: hunt._creationTime, listing: { ...huntListingOf({ hunt, realms: await realmsOf(ctx.db, hunt_id) }), role } }
    }))
    return _.sortBy(listed.filter((each) => each !== null), 'made').map(({ listing }) => listing)
  },
})

/**
 * The hunt answering to `hunt_label`, for the asking actor. Someone on it is shown it as a quiz's
 * screen holds it: its realms with their quizzes' rows, who is on it, and their own role. Someone
 * not on it is shown only that, and its smiths, who could add them. Says so when no hunt answers
 * to the label.
 */
export const open = zQuery({
  args:    { hunt_label: label },
  handler: async (ctx, { hunt_label }): Promise<HuntOpeningT> => {
    const hunt = await huntForLabel(ctx.db, hunt_label)
    if (! hunt) { return { why: 'noSuchHunt', hunt: null } }
    const [members, claims] = await Promise.all([membersOf(ctx.db, hunt._id), claimsFor(ctx.db, hunt._id, ctx.actor)])
    if (! Approve.may('read_hunt', claims)) { return { why: 'notOnHunt', hunt: null, smiths: smithsOf(members) } }
    const rows = await huntRowsOf(ctx.db, hunt._id)
    if (! rows) { return { why: 'noSuchHunt', hunt: null } }
    return { why: null, hunt: shallowHuntOf(rows, members, Actor.roleOf(claims)) }
  },
})

/**
 * The hunt `hunt_id`, every quiz whole, as the Export box emits it, for someone on it. Null when
 * there is no such hunt, or the asking actor is not on it.
 */
export const whole = zQuery({
  args:    { hunt_id: zid('hunts') },
  handler: async (ctx, { hunt_id }): Promise<HuntT | null> => {
    if (! await affirmReadHunt(ctx.db, hunt_id, ctx.actor)) { return null }
    return await wholeHuntOf(ctx.db, hunt_id)
  },
})

/**
 * Carry out what the author did from inside a quiz, writing the rows it comes to: see
 * `writing/perform`. Who is acting is the asking actor, who must be allowed to by the policy of the
 * action's kind (`authorize`, `lib/approve`): a smith of the hunt, or for their own review, anyone
 * on it.
 *
 * @throws A `ConvexError` whose data is a refusal (`lib/refusals`) when the action cannot be
 *   carried out (`notIdentified` for an actor who has asserted no username, `notPermitted` for an
 *   action its ident may not take, `ownHunting` for a change to one's own place on the hunt), or `{ ZodError }` when an argument is not valid; nothing is
 *   written.
 */
export const perform = zMutation({
  args:    { open: ActionValidators.open, action: ActionValidators.huntAction },
  returns: zod.null(),
  handler: async (ctx, { open: place, action }) => await refusingInvalid(async () => {
    const { actor } = ctx
    if (Actor.isAnonymous(actor)) { refuse('notIdentified') }
    const verdict = await affirmPerform(ctx.db, place, actor, action)
    if (verdict !== Approve.Allow) { refuse(verdict) }
    await performAction(ctx.db, place, actor.ident_id, action)
    return null
  }),
})
