import { ValidatorKit } from '../src/lib/validator'
import { seenQuestionOf, type SeenQuestionT } from '../src/lib/rows'
import { zQuery } from './functions'
import { slotsOf } from './reading'

const { zid } = ValidatorKit

/**
 * The question `question_id`, as one row of the grid reads it: its row, and its bots' newest
 * replies. Its chain is the label the row holds; the browser resolves it among the quiz's
 * questions. Null when there is no such question (deleted a moment ago).
 */
export const open = zQuery({
  args:    { question_id: zid('questions') },
  handler: async (ctx, { question_id }): Promise<SeenQuestionT | null> => {
    const row = await ctx.db.get('questions', question_id)
    return row && seenQuestionOf(row, await slotsOf(ctx.db, [row]))
  },
})
