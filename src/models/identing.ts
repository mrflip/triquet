import type * as Z from 'zod'
import { Validator } from '../lib/validator'

export const IdentingValidators = Validator(({ obj, rowid }) => {
  const row = obj({
    ident_id: rowid
      .describe('The ident this account took on.'),
  })
    .describe('One time an account took on an ident. The account\'s newest identing is the ident it is now; the older ones are its history. Only the account itself can see them.')

  return { row }
})

export type IdentingRowT = Z.output<typeof IdentingValidators.row>
