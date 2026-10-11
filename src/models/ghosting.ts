import type * as Z from 'zod'
import { Validator } from '../lib/validator'
import { UserValidators } from './user'

export const GhostingValidators = Validator(({ obj, zid }) => {
  const row = obj({
    userlabel:    UserValidators.heldUserlabel
      .describe('The userlabel retired: held reserved, so no user may take it, until it is released.'),
    user_id:      zid('users')
      .describe('The user that held it, merged away: marked, never deleted.'),
    into_user_id: zid('users')
      .describe('The user it merged into, which carries on.'),
    account_id:   zid('authAccounts')
      .describe('The account whose sign-in caused the merge: a Google account the merged-into user already had.'),
  })
    .describe('One userlabel retired by a merge, held reserved until it can be released. Appended, never edited. The Coach\'s word.')

  return { row }
})

export type GhostingRowT = Z.output<typeof GhostingValidators.row>
