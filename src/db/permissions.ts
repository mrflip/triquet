import { schema as JZS } from 'jazz-tools'
import { app } from './schema'

/**
 * Who may read and write which rows: the only place authorization is written.
 *
 * Every row belongs to the account that made it, and no other account can see or touch it.
 * Ownership is the account's, not the identity's, so an identity linked to the account later
 * (signing in, on another device) holds everything the account made before it.
 */
export default JZS.definePermissions(app, ({ policy, session }) => {
  const ownAccount = { '$createdBy.account': session.user.account }
  const { workspaces, expressions, quizzes, widgets, columns, questions, bottings } = policy

  workspaces.allowRead.where(ownAccount)
  workspaces.allowInsert.where(ownAccount)
  workspaces.allowUpdate.where(ownAccount)
  workspaces.allowDelete.where(ownAccount)

  expressions.allowRead.where(ownAccount)
  expressions.allowInsert.where(ownAccount)
  expressions.allowUpdate.where(ownAccount)
  expressions.allowDelete.where(ownAccount)

  quizzes.allowRead.where(ownAccount)
  quizzes.allowInsert.where(ownAccount)
  quizzes.allowUpdate.where(ownAccount)
  quizzes.allowDelete.where(ownAccount)

  widgets.allowRead.where(ownAccount)
  widgets.allowInsert.where(ownAccount)
  widgets.allowUpdate.where(ownAccount)
  widgets.allowDelete.where(ownAccount)

  columns.allowRead.where(ownAccount)
  columns.allowInsert.where(ownAccount)
  columns.allowUpdate.where(ownAccount)
  columns.allowDelete.where(ownAccount)

  questions.allowRead.where(ownAccount)
  questions.allowInsert.where(ownAccount)
  questions.allowUpdate.where(ownAccount)
  questions.allowDelete.where(ownAccount)

  bottings.allowRead.where(ownAccount)
  bottings.allowInsert.where(ownAccount)
  bottings.allowUpdate.where(ownAccount)
  bottings.allowDelete.where(ownAccount)
})
