import { ValidatorKit } from '../src/lib/validator'
import { huntFrom, huntListingOf, quizFrom, shallowHuntOf, type HuntListingT, type ShallowHuntT } from '../src/lib/rows'
import { ActionValidators } from '../src/models/actions'
import { IdentingValidators } from '../src/models/identing'
import type { HuntT } from '../src/models/hunt'
import type { QuizT } from '../src/models/quiz'
import { zMutation, zQuery } from './functions'
import { mayChangeHunt } from './authorize'
import { expressionUsageOf, huntForLabel, huntRowsOf, huntsOf, identFor, quizRowsOf, realmsOf } from './reading'
import { perform as performAction } from './writing/perform'

const { label, zid, zod } = ValidatorKit

/** Every hunt, as the hunts list shows it, in the order they were made */
export const list = zQuery({
  args:    {},
  handler: async (ctx): Promise<HuntListingT[]> => {
    const hunts = await huntsOf(ctx.db)
    return await Promise.all(hunts.map(async (hunt) => huntListingOf({ hunt, realms: await realmsOf(ctx.db, hunt._id) })))
  },
})

/**
 * The hunt answering to `hunt_label`, as a quiz's screen holds it: its realms with their quizzes'
 * rows, and its expressions with how many widgets work each. Null when no hunt answers to it.
 */
export const open = zQuery({
  args:    { hunt_label: label },
  handler: async (ctx, { hunt_label }): Promise<ShallowHuntT | null> => {
    const hunt = await huntForLabel(ctx.db, hunt_label)
    const rows = hunt && await huntRowsOf(ctx.db, hunt._id)
    return rows && shallowHuntOf(rows, await expressionUsageOf(ctx.db, rows.realms))
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
 */
export const perform = zMutation({
  args:    { open: ActionValidators.open, action: ActionValidators.huntAction, browser_key: IdentingValidators.browserKey },
  returns: zod.null(),
  handler: async (ctx, { open: place, action, browser_key }) => {
    if (mayChangeHunt(browser_key, place.hunt_id)) {
      const ident = await identFor(ctx.db, browser_key)
      await performAction(ctx.db, place, ident?._id ?? null, action)
    }
    return null
  },
})
