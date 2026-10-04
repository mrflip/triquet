import { ValidatorKit } from '../src/lib/validator'
import { seenQuestionOf, type SeenQuestionT } from '../src/lib/rows'
import { ActionValidators } from '../src/models/actions'
import { emptyIfDenied, zQuery } from './functions'
import { affirmReadQuestion } from './authorize'
import { storedOf, widgetingsOf } from './reading'

const { zid } = ValidatorKit

/**
 * The question `question_id`, as one row of the grid reads it, for someone on its hunt: its row,
 * and what each of its quiz's widgetings stored for it.
 * Its chain is the label the row holds; the browser resolves it among the quiz's questions. Null
 * when there is no such question (deleted a moment ago), they are not on its hunt, or what they
 * affirm of themselves there is not so.
 */
export const open = zQuery({
  args:    { question_id: zid('questions'), affirms: ActionValidators.huntAffirms },
  handler: async (ctx, { question_id, affirms }): Promise<SeenQuestionT | null> => await emptyIfDenied(null, async () => {
    const { question } = await affirmReadQuestion(ctx.db, affirms, ctx.actor, question_id)
    if (! question) { return null }
    return seenQuestionOf(question, await storedOf(ctx.db, question._id, await widgetingsOf(ctx.db, question.quiz_id)))
  }),
})
