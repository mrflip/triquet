import { ValidatorKit } from '../src/lib/validator'
import { frameOf, type QuizFrameT } from '../src/lib/rows'
import { zQuery } from './functions'
import { affirmReadHunt } from './authorize'
import { huntIdOf, layoutRowsOf } from './reading'

const { zid } = ValidatorKit

/**
 * The quiz `quiz_id` without its questions, as the grid's frame, for someone on its hunt: its own
 * fields, its questions' order by row id, and its widgetings and columns in order. Each question is its own query (`questions.open`), so an edit to
 * one reruns that one alone. Null when there is no such quiz, or they are not on its hunt.
 */
export const open = zQuery({
  args:    { quiz_id: zid('quizzes') },
  handler: async (ctx, { quiz_id }): Promise<QuizFrameT | null> => {
    const quiz = await ctx.db.get('quizzes', quiz_id)
    const hunt_id = quiz && await huntIdOf(ctx.db, quiz)
    if (! hunt_id || ! await affirmReadHunt(ctx.db, hunt_id, ctx.actor)) { return null }
    const rows = await layoutRowsOf(ctx.db, quiz_id)
    return rows && frameOf(rows.quiz, rows.widgetings, rows.columns)
  },
})
