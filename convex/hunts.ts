import _ from 'es-toolkit/compat'
import { ValidatorKit } from '../src/lib/validator'
import { refuse, refusingInvalid } from '../src/lib/refusals'
import { huntFrom, huntListingOf, quizFrom, shallowHuntOf, type ListedHuntT, type ShallowHuntT } from '../src/lib/rows'
import { ActionValidators } from '../src/models/actions'
import { IdentingValidators } from '../src/models/identing'
import type { HuntT } from '../src/models/hunt'
import type { QuizT } from '../src/models/quiz'
import { zMutation, zQuery } from './functions'
import { mayChangeHunt } from './authorize'
import { expressionUsageOf, huntForLabel, huntingFor, huntingsFor, huntRowsOf, identFor, membersOf, quizRowsOf, realmsOf } from './reading'
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
 * The hunt answering to `hunt_label`, as a quiz's screen holds it: its realms with their quizzes'
 * rows, its expressions with how many widgets work each, who is on it, and the role on it of the
 * ident the browser `browser_key` is now. Null when no hunt answers to it.
 */
export const open = zQuery({
  args:    { hunt_label: label, browser_key: IdentingValidators.browserKey },
  handler: async (ctx, { hunt_label, browser_key }): Promise<ShallowHuntT | null> => {
    const [hunt, ident] = await Promise.all([huntForLabel(ctx.db, hunt_label), identFor(ctx.db, browser_key)])
    const rows = hunt && await huntRowsOf(ctx.db, hunt._id)
    if (! rows) { return null }
    const [usage, members, hunting] = await Promise.all([
      expressionUsageOf(ctx.db, rows.realms),
      membersOf(ctx.db, rows.hunt._id),
      ident && huntingFor(ctx.db, rows.hunt._id, ident._id),
    ])
    return shallowHuntOf(rows, usage, members, hunting?.role ?? null)
  },
})

/** The hunt `hunt_id`, every quiz whole, as the Export box emits it; null when there is no such hunt */
export const whole = zQuery({
  args:    { hunt_id: zid('hunts') },
  handler: async (ctx, { hunt_id }): Promise<HuntT | null> => {
    const rows = await huntRowsOf(ctx.db, hunt_id)
    if (! rows) { return null }
    const quizzes = rows.realms.flatMap((realm) => realm.quizzes)
    const whole = await Promise.all(quizzes.map(async (quiz) => await quizRowsOf(ctx.db, quiz._id)))
    const quizFor = new Map<string, QuizT>(whole.filter((each) => each !== null).map((each) => [each.quiz._id, quizFrom(each)]))
    return huntFrom(rows, quizFor)
  },
})

/**
 * Carry out what the author did from inside a quiz, writing the rows it comes to: see
 * `writing/perform`. Who is acting is the ident the browser `browser_key` took on last.
 *
 * @throws A `ConvexError` whose data is a refusal (`lib/refusals`) when the action cannot be
 *   carried out, or `{ ZodError }` when an argument is not valid; nothing is written.
 */
export const perform = zMutation({
  args:    { open: ActionValidators.open, action: ActionValidators.huntAction, browser_key: IdentingValidators.browserKey },
  returns: zod.null(),
  handler: async (ctx, { open: place, action, browser_key }) => await refusingInvalid(async () => {
    if (! mayChangeHunt(browser_key, place.hunt_id)) { refuse('notPermitted') }
    const ident = await identFor(ctx.db, browser_key)
    await performAction(ctx.db, place, ident?._id ?? null, action)
    return null
  }),
})
