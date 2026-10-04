import { frameOf, type QuizFrameT } from '../src/lib/rows'
import { ActionValidators } from '../src/models/actions'
import { emptyIfDenied, zQuery } from './functions'
import { affirmReadHunt } from './authorize'
import { layoutOf } from './reading'

/**
 * The affirmed quiz without its questions, as the grid's frame, for someone on its hunt: its own
 * fields, its questions' order by row id, and its widgetings and columns in order. Each question
 * is its own query (`questions.open`), so an edit to one reruns that one alone. Null when there is
 * no such quiz, they are not on its hunt, or what they affirm of themselves there is not so.
 */
export const open = zQuery({
  args:    { affirms: ActionValidators.quizAffirms },
  handler: async (ctx, { affirms }): Promise<QuizFrameT | null> => await emptyIfDenied(null, async () => {
    const { quiz } = await affirmReadHunt(ctx.db, affirms, ctx.actor)
    if (! quiz) { return null }
    const { widgetings, columns } = await layoutOf(ctx.db, quiz)
    return frameOf(quiz, widgetings, columns)
  }),
})
