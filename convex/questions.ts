import { ValidatorKit } from '../src/lib/validator'
import { seenQuestionOf, type SeenQuestionT } from '../src/lib/rows'
import { zQuery } from './functions'
import { affirmReadHunt } from './authorize'
import { storedOf, widgetingsOf } from './reading'

const { zid } = ValidatorKit

/**
 * The question `question_id`, as one row of the grid reads it, for someone on its hunt: its row,
 * and what each of its quiz's widgetings stored for it.
 * Its chain is the label the row holds; the browser resolves it among the quiz's questions. Null
 * when there is no such question (deleted a moment ago), or they are not on its hunt.
 */
export const open = zQuery({
  args:    { question_id: zid('questions') },
  handler: async (ctx, { question_id }): Promise<SeenQuestionT | null> => {
    const row = await ctx.db.get('questions', question_id)
    if (! row || ! await affirmReadHunt(ctx.db, row.hunt_id, ctx.actor)) { return null }
    return seenQuestionOf(row, await storedOf(ctx.db, row._id, await widgetingsOf(ctx.db, row.quiz_id)))
  },
})
