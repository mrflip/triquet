import _ from 'es-toolkit/compat'
import * as Actor from '../src/lib/actor'
import * as Approve from '../src/lib/approve'
import { ValidatorKit } from '../src/lib/validator'
import { huntListingOf, shallowHuntOf, smithsOf, type HuntOpeningT, type ListedHuntT } from '../src/lib/rows'
import { ActionValidators } from '../src/models/actions'
import type { HuntT } from '../src/models/hunt'
import { zHuntMutation, zHuntQuery, zQuery } from './functions'
import { affirmExportHunt, affirmPerform, claimsFor } from './authorize'
import { huntForLabel, huntingsFor, huntRowsOf, membersOf, realmsOf, wholeHuntOf } from './reading'
import { perform as performAction } from './writing/perform'

const { label, zod } = ValidatorKit

/**
 * The hunts the asking actor is on, as the hunts list shows them, each with its role there and
 * the org it is addressed under, in the order they were made. None for an actor who has asserted no username. It spans hunts, and
 * so holds the whole database (`Unscoped` in `authorize.ts`), needing no rule: it reads the
 * actor's own huntings, and only the hunts those name.
 */
export const list = zQuery({
  args:    {},
  handler: async (ctx): Promise<ListedHuntT[]> => {
    const { actor } = ctx
    const huntings = Actor.isAnonymous(actor) ? [] : await huntingsFor(ctx.db, actor.ident_id)
    const listed = await Promise.all(huntings.map(async ({ hunt_id, role }) => {
      const hunt = await ctx.db.get('hunts', hunt_id)
      if (! hunt) { return null }
      const [realms, members] = await Promise.all([realmsOf(ctx.db, hunt_id), membersOf(ctx.db, hunt_id)])
      return { made: hunt._creationTime, listing: { ...huntListingOf({ hunt, realms }, members), role } }
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
 * The affirmed hunt, every quiz whole, as the Export box emits it, for a smith of it
 * (`Approve.mayExportHunt`). Null when there is no such hunt, the asking actor is not a smith of
 * it, or what they affirm of themselves there is not so.
 */
export const whole = zHuntQuery({
  args:    { affirms: ActionValidators.huntAffirms },
  empty:   null,
  affirm:  async (ctx, { affirms }) => await affirmExportHunt(ctx.db, affirms, ctx.actor),
  handler: async (ctx): Promise<HuntT | null> => await wholeHuntOf(ctx.db, ctx.claims.hunt_id),
})

/**
 * Carry out what the author did from inside a quiz, writing the rows it comes to: see
 * `writing/perform`. The browser affirms who it is, its standing on the hunt, and the quiz on its
 * screen; each is checked, and the actor must be allowed the action by the policy of its kind
 * (`authorize`, `lib/approve`): a smith of the hunt, in an unlocked quiz for a change to it, or
 * for their own review, anyone on it. What it writes, it writes only to that hunt.
 *
 * @throws A `ConvexError` whose data is a refusal (`lib/refusals`) when the action cannot be
 *   carried out (`notIdentified` for an actor who has asserted no username, `notPermitted` for an
 *   affirm that is not so or an action its ident may not take, `quizLocked` for a change to a
 *   locked quiz, `ownHunting` for a change to one's own place on the hunt), or `{ ZodError }` when
 *   an argument is not valid; nothing is written.
 */
export const perform = zHuntMutation({
  args:    { affirms: ActionValidators.affirms, action: ActionValidators.huntAction },
  returns: zod.null(),
  affirm:  async (ctx, { affirms, action }) => await affirmPerform(ctx.db, affirms, ctx.actor, action),
  handler: async (ctx, { action }) => {
    await performAction(ctx.db, ctx.census, ctx.claims, action)
    return null
  },
})
