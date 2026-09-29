import { ValidatorKit } from '../src/lib/validator'
import { seenQuestionOf, type SeenQuestionT } from '../src/lib/rows'
import { IdentingValidators } from '../src/models/identing'
import { zQuery } from './functions'
import { mayReadHunt } from './authorize'
import { huntIdOfRow, identFor, slotsOf } from './reading'

const { zid } = ValidatorKit

/**
 * The question `question_id`, as one row of the grid reads it, for someone on its hunt (the ident
 * the browser `browser_key` is now): its row, and its bots' newest replies. Its chain is the label
 * the row holds; the browser resolves it among the quiz's questions. Null when there is no such
 * question (deleted a moment ago), or they are not on its hunt.
 */
export const open = zQuery({
  args:    { question_id: zid('questions'), browser_key: IdentingValidators.browserKey },
  handler: async (ctx, { question_id, browser_key }): Promise<SeenQuestionT | null> => {
    const [row, ident] = await Promise.all([ctx.db.get('questions', question_id), identFor(ctx.db, browser_key)])
    const hunt_id = row && await huntIdOfRow(ctx.db, row)
    if (! row || ! hunt_id || ! await mayReadHunt(ctx.db, hunt_id, ident?._id ?? null)) { return null }
    return seenQuestionOf(row, await slotsOf(ctx.db, [row]))
  },
})
