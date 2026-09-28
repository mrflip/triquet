import _ from 'es-toolkit/compat'
import { ValidatorKit } from '../src/lib/validator'
import { refuse, refusingInvalid } from '../src/lib/refusals'
import { huntListingOf, shallowHuntOf, smithsOf, type HuntOpeningT, type ListedHuntT } from '../src/lib/rows'
import { ActionValidators } from '../src/models/actions'
import { IdentingValidators } from '../src/models/identing'
import type { HuntT } from '../src/models/hunt'
import { zMutation, zQuery } from './functions'
import { mayPerform, mayReadHunt, roleOn } from './authorize'
import { expressionUsageOf, huntForLabel, huntingsFor, huntRowsOf, identFor, membersOf, realmsOf, wholeHuntOf } from './reading'
import { perform as performAction } from './writing/perform'

const { label, zid, zod } = ValidatorKit

/**
 * The hunts the ident the browser `browser_key` is now is on, as the hunts list shows them, each
 * with its role there, in the order they were made. None for a browser that has not said who it is.
 */
export const list = zQuery({
  args:    { browser_key: IdentingValidators.browserKey },
  handler: async (ctx, { browser_key }): Promise<ListedHuntT[]> => {
    const ident = await identFor(ctx.db, browser_key)
    const huntings = ident ? await huntingsFor(ctx.db, ident._id) : []
    const listed = await Promise.all(huntings.map(async ({ hunt_id, role }) => {
      const hunt = await ctx.db.get('hunts', hunt_id)
      return hunt && { made: hunt._creationTime, listing: { ...huntListingOf({ hunt, realms: await realmsOf(ctx.db, hunt_id) }), role } }
    }))
    return _.sortBy(listed.filter((each) => each !== null), 'made').map(({ listing }) => listing)
  },
})

/**
 * The hunt answering to `hunt_label`, for the ident the browser `browser_key` is now. Someone on
 * it is shown it as a quiz's screen holds it: its realms with their quizzes' rows, its expressions
 * with how many widgets work each, who is on it, and their own role. Someone not on it is shown
 * only that, and its smiths, who could add them. Says so when no hunt answers to the label.
 */
export const open = zQuery({
  args:    { hunt_label: label, browser_key: IdentingValidators.browserKey },
  handler: async (ctx, { hunt_label, browser_key }): Promise<HuntOpeningT> => {
    const [hunt, ident] = await Promise.all([huntForLabel(ctx.db, hunt_label), identFor(ctx.db, browser_key)])
    if (! hunt) { return { why: 'noSuchHunt', hunt: null } }
    const [members, role] = await Promise.all([membersOf(ctx.db, hunt._id), roleOn(ctx.db, hunt._id, ident?._id ?? null)])
    if (role === null) { return { why: 'notOnHunt', hunt: null, smiths: smithsOf(members) } }
    const rows = await huntRowsOf(ctx.db, hunt._id)
    if (! rows) { return { why: 'noSuchHunt', hunt: null } }
    return { why: null, hunt: shallowHuntOf(rows, await expressionUsageOf(ctx.db, rows.realms), members, role) }
  },
})

/**
 * The hunt `hunt_id`, every quiz whole, as the Export box emits it, for someone on it (the ident
 * the browser `browser_key` is now). Null when there is no such hunt, or they are not on it.
 */
export const whole = zQuery({
  args:    { hunt_id: zid('hunts'), browser_key: IdentingValidators.browserKey },
  handler: async (ctx, { hunt_id, browser_key }): Promise<HuntT | null> => {
    const ident = await identFor(ctx.db, browser_key)
    if (! await mayReadHunt(ctx.db, hunt_id, ident?._id ?? null)) { return null }
    return await wholeHuntOf(ctx.db, hunt_id)
  },
})

/**
 * Carry out what the author did from inside a quiz, writing the rows it comes to: see
 * `writing/perform`. Who is acting is the ident the browser `browser_key` took on last, and they
 * must be allowed to (`authorize`): a smith of the hunt, or for their own review, anyone on it.
 *
 * @throws A `ConvexError` whose data is a refusal (`lib/refusals`) when the action cannot be
 *   carried out (`notIdentified` for a browser that has not said who it is, `notPermitted` for an
 *   action its ident may not take), or `{ ZodError }` when an argument is not valid; nothing is
 *   written.
 */
export const perform = zMutation({
  args:    { open: ActionValidators.open, action: ActionValidators.huntAction, browser_key: IdentingValidators.browserKey },
  returns: zod.null(),
  handler: async (ctx, { open: place, action, browser_key }) => await refusingInvalid(async () => {
    const ident = await identFor(ctx.db, browser_key)
    if (! ident) { refuse('notIdentified') }
    if (! await mayPerform(ctx.db, place, ident._id, action)) { refuse('notPermitted') }
    await performAction(ctx.db, place, ident._id, action)
    return null
  }),
})
