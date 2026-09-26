import * as Z from 'zod'
import { Validator } from '../lib/validator'

/** Which model tier answered an ask */
export const ModelTierVals = ['quick', 'careful'] as const
export type ModelTier = typeof ModelTierVals[number]

export const AskValidators = Validator(({ obj, oneof, noteish, uint, timestamp, lit, zod }) => {
  const modelTier = oneof(ModelTierVals).default('quick')
    .describe('Which tier answered: "quick" for the deliberately hasty first-instinct guess, "careful" for the more thorough ish extraction. Stored per result so an older result stays honestly labelled even after the app changes which tier it asks for a given job. Defaults to "quick" -- the tier the app reaches for when nothing says otherwise.')

  const approxTokens = uint
    .describe('Rough size of one ask plus its answer, estimated from character count because the page cannot observe real usage. Displayed as "~N tok" so the author can see what a habit of refreshing costs them. Never presented as exact.')

  const lastErr = obj({
    message:  noteish.min(1)
      .describe('Plain-language reason the ask failed, written for the author rather than copied from an error code. Shown when the badge is hovered.'),
    response: zod.json()
      .describe('The error response as it came back, as JSON, shown when the badge is clicked so the author can see what really happened.'),
    at:       timestamp,
  })
    .describe('The most recent failed ask for a cell. A failure never replaces a value the cell already has: it rides along on it, and any success clears it.')

  const askError = obj({
    status:     lit('error'),
    message:    noteish.min(1)
      .describe('Plain-language reason the ask failed, shown in place of a result that has never existed, with an invitation to try again.'),
    updated_at: timestamp,
    last_err:   lastErr,
  })
    .describe('A cell whose ask failed before it ever had a value. Once a cell has a value, a failure is only ever its `last_err`.')

  return { modelTier, approxTokens, lastErr, askError }
})

export type LastErrT    = Z.output<typeof AskValidators.lastErr>
export type AskErrorDNA = Z.input<typeof AskValidators.askError>
export type AskErrorT   = Z.output<typeof AskValidators.askError>

/** One failed ask for a cell that has nothing else to show, stamped now */
export function askError(err: LastErrT): AskErrorT {
  return AskValidators.askError({ status: 'error', message: err.message, updated_at: err.at, last_err: err })
}
