import { ValidatorKit } from '../src/lib/validator'
import { seenQuestionFor, type SeenQuestionT, type StoredRows } from '../src/lib/rows'
import { ActionValidators } from '../src/models/actions'
import { Question } from '../src/models/question'
import { zHuntQuery } from './functions'
import { affirmReadQuestion } from './authorize'
import { storedOf, widgetingsOf } from './reading'

const { zid } = ValidatorKit

/** What a question stored, for a reader not sent it: nothing, and nothing read to find it */
const NothingStored: StoredRows = new Map()

/**
 * The question `question_id`, as one row of the grid or the review reads it, for someone on its
 * hunt: what their standing there is sent of it (`Question.sentTo`). A smith is sent its row and
 * what each of its quiz's widgetings stored for it; a reviewer what a review needs, its answer
 * among it, and nothing stored, which is then not read.
 * Its chain is the label the row holds; the browser resolves it among the quiz's questions. Null
 * when there is no such question (deleted a moment ago), they are not on its hunt, or what they
 * affirm of themselves there is not so.
 */
export const open = zHuntQuery({
  args:    { question_id: zid('questions'), affirms: ActionValidators.huntAffirms },
  empty:   null,
  affirm:  async (ctx, { question_id, affirms }) => await affirmReadQuestion(ctx.db, affirms, ctx.actor, question_id),
  handler: async (ctx): Promise<SeenQuestionT | null> => {
    const { question, standing } = ctx.claims
    if (! question) { return null }
    const stored = Question.isSent('stored', standing) ? await storedOf(ctx.db, question._id, await widgetingsOf(ctx.db, question.quiz_id)) : NothingStored
    return seenQuestionFor(question, stored, ctx.claims)
  },
})
