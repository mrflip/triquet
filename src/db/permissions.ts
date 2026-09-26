import { schema as JZS } from 'jazz-tools'
import { app } from './schema'

/**
 * Who may read and write which rows: the only place authorization is written.
 *
 * Every row belongs to the account that made it, and no one else can see it.
 */
export default JZS.definePermissions(app, ({ policy }) => {
  policy.workspaces.managedByCreator()
  policy.expressions.managedByCreator()
  policy.quizzes.managedByCreator()
  policy.widgets.managedByCreator()
  policy.columns.managedByCreator()
  policy.questions.managedByCreator()
  policy.playings.managedByCreator()
})
