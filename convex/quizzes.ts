import { frameOf, type QuizFrameT } from '../src/lib/rows'
import * as PA from '../src/lib/vv/patterns'
import { ActionValidators } from '../src/models/actions'
import type { QuizT } from '../src/models/quiz'
import type { SignalT } from '../src/models/signal'
import { zHuntQuery } from './functions'
import { affirmExportHunt, affirmReadHunt } from './authorize'
import { layoutOf, wholeQuizOf } from './reading'

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

/**
 * The affirmed quiz whole, for a smith of its hunt (`Approve.mayExportHunt`): its fields, its
 * questions in order with what each stored, and its widgetings and columns, as the export holds
 * it. One quiz of a smith's record of the hunt, the quiz's file in one result: a smith's browser
 * watches it for every quiz it does not have on screen. Null when there is no such quiz, the
 * asking actor is not a smith of its hunt, or what they affirm of themselves there is not so.
 */
export const whole = zHuntQuery({
  args:    { affirms: ActionValidators.quizAffirms },
  empty:   null,
  affirm:  async (ctx, { affirms }) => await affirmExportHunt(ctx.db, affirms, ctx.actor),
  handler: async (ctx): Promise<QuizT | null> => {
    const { quiz } = ctx.claims
    return quiz && await wholeQuizOf(ctx.db, quiz)
  },
})

/**
 * The change signal of every quiz of the affirmed hunt that has one, for a smith of it
 * (`Approve.mayExportHunt`, as `whole`): when each quiz's files last changed. A smith's browser
 * watches it beside the hunt, and fetches a quiz it does not have on screen (`whole`) once that
 * quiz's signal moves, rather than watching the quiz itself. Small rows, read by nothing else, so
 * a write to a quiz reruns this once per grain (`SignalGrainMs`) and no reader of the quiz itself.
 * A quiz with no signal has not been written since signals began. None when the asking actor is
 * not a smith of the hunt, or what they affirm of themselves there is not so: it says which quizzes
 * are being worked on, which is the smiths' business alone.
 */
export const signals = zHuntQuery({
  args:    { affirms: ActionValidators.huntAffirms },
  empty:   [],
  affirm:  async (ctx, { affirms }) => await affirmExportHunt(ctx.db, affirms, ctx.actor),
  handler: async (ctx): Promise<SignalT[]> => {
    // A hunt has one realm, `home` (`RealmValidators`), so its quizzes are capped as a realm's are.
    const rows = await ctx.db.query('signals').withIndex('by_hunt_id', (cvx) => cvx.eq('hunt_id', ctx.claims.hunt_id)).take(PA.QuizzesPerRealm.max)
    return rows.map(({ quiz_id, changed_at }) => ({ quiz_id, changed_at }))
  },
})
