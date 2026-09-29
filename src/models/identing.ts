import type * as Z from 'zod'
import { Validator } from '../lib/validator'

export const IdentingValidators = Validator(({ obj, uuid, zid }) => {
  const browserKey = uuid
    .describe('The key this browser minted for itself on its first visit and keeps: what it says it is, for the trial, until it has an account to say so. Not a secret: it names the ident the browser took on last, whose places on hunts say what it may do, and anyone may take on any ident.')

  const row = obj({
    browser_key: browserKey,
    ident_id:    zid('idents')
      .describe('The ident this browser took on.'),
  })
    .describe('One time a browser took on an ident. The browser\'s newest identing is the ident it is now; the older ones are its history.')

  return { browserKey, row }
})

export type IdentingRowT = Z.output<typeof IdentingValidators.row>
