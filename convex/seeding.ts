import { ValidatorKit } from '../src/lib/validator'
import { QuestionWidgetLabel } from '../src/models/column'
import { DefaultWidgetings, SeedWidgets } from '../src/models/seeds'
import type { Doc } from './_generated/dataModel'
import { zInternalMutation } from './functions'
import { huntsOf, layoutRowsOf, realmsOf } from './reading'
import { insertAbsentWidgets, insertLayout, updateColumn, type Writer } from './writing/quiz_writing'

const { obj, arr, str, label } = ValidatorKit

/** The column source the BUT NOT ishes had while they were a view of the question, and the widgeting that shows them now */
const ButnotIshesView = `${QuestionWidgetLabel}.butnot_ishes`
const ButnotIshesLabel = 'butnot_ishes'

/** Every column source that says a quiz was laid out with the default set: a default widgeting's label, or the old view */
const DefaultSources: ReadonlySet<string> = new Set([...DefaultWidgetings.map((widgeting) => widgeting.label), ButnotIshesView])

/**
 * Seed the library and the quizzes laid out before it: insert each seed widget whose label the
 * library lacks; and give each quiz with no widgetings whose columns name any of the default set
 * the whole default set, re-pointing a column that showed the old BUT NOT ishes view to the
 * widgeting that shows them now. A quiz whose columns name none of it is left alone, so the
 * mutation is harmless to run again.
 *
 * The whole set rather than only what the columns name: a column can be removed while its
 * widgeting is kept, so a quiz showing a sum may not show the number spotter the sum reads.
 *
 * @returns The labels of the widgets added, and each quiz given widgetings, as `hunt/realm/quiz`.
 *
 * @example npx convex run seeding:seedWidgets
 */
export const seedWidgets = zInternalMutation({
  args:    {},
  returns: obj({ widgets: arr(label), quizzes: arr(str) }),
  handler: async (ctx) => {
    const widgets = await insertAbsentWidgets(ctx.db, SeedWidgets)
    const hunts = await huntsOf(ctx.db)
    const quizzes: string[] = []
    for (const hunt of hunts) {
      const realms = await realmsOf(ctx.db, hunt._id)
      for (const { realm, quizzes: rows } of realms) {
        for (const quiz of rows) {
          if (await seedQuiz(ctx.db, quiz)) { quizzes.push(`${hunt.label}/${realm.label}/${quiz.label}`) }
        }
      }
    }
    return { widgets, quizzes }
  },
})

/** Give `quiz` the default widgetings, when it has none and its columns name any of them; whether it was given them */
async function seedQuiz(db: Writer, quiz: Doc<'quizzes'>): Promise<boolean> {
  const rows = await layoutRowsOf(db, quiz._id)
  if (! rows || rows.widgetings.length > 0 || rows.columns.every((column) => ! DefaultSources.has(column.source))) { return false }
  await insertLayout(db, quiz._id, { widgetings: [...DefaultWidgetings], columns: [] })
  for (const column of rows.columns) {
    if (column.source === ButnotIshesView) { await updateColumn(db, column, { source: ButnotIshesLabel }) }
  }
  return true
}
