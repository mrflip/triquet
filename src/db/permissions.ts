import { schema as JZS } from 'jazz-tools'
import { app } from './schema'

/**
 * Who may read and write which rows: the only place authorization is written.
 *
 * For the playtesting trial the hunt tables are open to every account: anyone who can reach the
 * app can read and change any hunt. A hunt is found by its address, and an address is not a
 * secret. Membership and roles come next, and the policy that enforces them after that.
 *
 * Two tables are not open. An identing -- which ident this account has taken on -- is visible
 * only to the account that wrote it, as it is that account's own history. An ident may be made
 * by anyone but never changed or removed, so an ident someone has taken on cannot be pulled
 * from under them.
 */
export default JZS.definePermissions(app, ({ policy, session }) => {
  const ownAccount = { '$createdBy.account': session.user.account }
  const { idents, identings, hunts, realms, expressions, quizzes, widgets, columns, questions, bottings, reviews } = policy

  identings.allowRead.where(ownAccount)
  identings.allowInsert.where(ownAccount)
  identings.allowUpdate.where(ownAccount)
  identings.allowDelete.where(ownAccount)

  idents.allowRead.always()
  idents.allowInsert.always()
  idents.allowUpdate.never()
  idents.allowDelete.never()

  for (const table of [hunts, realms, expressions, quizzes, widgets, columns, questions, bottings, reviews]) {
    table.allowRead.always()
    table.allowInsert.always()
    table.allowUpdate.always()
    table.allowDelete.always()
  }
})
