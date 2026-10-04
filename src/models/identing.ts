import type * as Z from 'zod'
import { Validator } from '../lib/validator'

export const IdentingValidators = Validator(({ obj, zid }) => {
  const row = obj({
    user_id:  zid('users')
      .describe('The session that asserted the username: its Convex Auth user.'),
    ident_id: zid('idents')
      .describe('The ident it took on.'),
  })
    .describe('One time a session asserted a username. Its newest identing is the ident it is now; the older ones are its history.')

  return { row }
})

export type IdentingRowT = Z.output<typeof IdentingValidators.row>
