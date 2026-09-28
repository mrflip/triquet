import { ValidatorKit } from '../src/lib/validator'
import { quizFrom } from '../src/lib/rows'
import type { QuizT } from '../src/models/quiz'
import { zQuery } from './functions'
import { quizRowsOf } from './reading'

const { zid } = ValidatorKit

/**
 * The quiz `quiz_id`, whole, as the grid reads it: its questions, widgets and columns in order,
 * each question showing its bots' newest replies. Null when there is no such quiz.
 */
export const open = zQuery({
  args:    { quiz_id: zid('quizzes') },
  handler: async (ctx, { quiz_id }): Promise<QuizT | null> => {
    const rows = await quizRowsOf(ctx.db, quiz_id)
    return rows && quizFrom(rows)
  },
})
