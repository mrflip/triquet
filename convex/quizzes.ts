import { ValidatorKit } from '../src/lib/validator'
import { frameOf, type QuizFrameT } from '../src/lib/rows'
import { IdentingValidators } from '../src/models/identing'
import { zQuery } from './functions'
import { mayReadHunt } from './authorize'
import { huntIdOf, identFor, layoutRowsOf } from './reading'

const { zid } = ValidatorKit

/**
 * The quiz `quiz_id` without its questions, as the grid's frame, for someone on its hunt (the
 * ident the browser `browser_key` is now): its own fields, its questions' order by row id, and its
 * widgetings and columns in order. Each question is its own query (`questions.open`), so an edit to
 * one reruns that one alone. Null when there is no such quiz, or they are not on its hunt.
 */
export const open = zQuery({
  args:    { quiz_id: zid('quizzes'), browser_key: IdentingValidators.browserKey },
  handler: async (ctx, { quiz_id, browser_key }): Promise<QuizFrameT | null> => {
    const [quiz, ident] = await Promise.all([ctx.db.get('quizzes', quiz_id), identFor(ctx.db, browser_key)])
    const hunt_id = quiz && await huntIdOf(ctx.db, quiz)
    if (! hunt_id || ! await mayReadHunt(ctx.db, hunt_id, ident?._id ?? null)) { return null }
    const rows = await layoutRowsOf(ctx.db, quiz_id)
    return rows && frameOf(rows.quiz, rows.widgetings, rows.columns)
  },
})
