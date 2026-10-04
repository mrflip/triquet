import { frameOf, type QuizFrameT } from '../src/lib/rows'
import { ActionValidators } from '../src/models/actions'
import { zHuntQuery } from './functions'
import { affirmReadHunt } from './authorize'
import { layoutOf } from './reading'

/**
 * The affirmed quiz without its questions, as the grid's frame, for someone on its hunt: its own
 * fields, its questions' order by row id, and its widgetings and columns in order. Each question
 * is its own query (`questions.open`), so an edit to one reruns that one alone. Null when there is
 * no such quiz, they are not on its hunt, or what they affirm of themselves there is not so.
 */
export const open = zHuntQuery({
  args:    { affirms: ActionValidators.quizAffirms },
  empty:   null,
  affirm:  async (ctx, { affirms }) => await affirmReadHunt(ctx.db, affirms, ctx.actor),
  handler: async (ctx): Promise<QuizFrameT | null> => {
    const { quiz } = ctx.claims
    if (! quiz) { return null }
    const { widgetings, columns } = await layoutOf(ctx.db, quiz)
    return frameOf(quiz, widgetings, columns)
  },
})
