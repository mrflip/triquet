import { ValidatorKit } from '../src/lib/validator'
import { frameOf, type QuizFrameT } from '../src/lib/rows'
import { zQuery } from './functions'
import { layoutRowsOf } from './reading'

const { zid } = ValidatorKit

/**
 * The quiz `quiz_id` without its questions, as the grid's frame: its own fields, its questions'
 * order by row id, and its widgets and columns in order. Each question is its own query
 * (`questions.open`), so an edit to one reruns that one alone. Null when there is no such quiz.
 */
export const open = zQuery({
  args:    { quiz_id: zid('quizzes') },
  handler: async (ctx, { quiz_id }): Promise<QuizFrameT | null> => {
    const rows = await layoutRowsOf(ctx.db, quiz_id)
    return rows && frameOf(rows.quiz, rows.widgets, rows.columns)
  },
})
