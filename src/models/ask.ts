import * as Z from 'zod'
import { Validator } from '../lib/validator'

/** Which model tier answered an ask */
export const ModelTierVals = ['quick', 'careful'] as const
export type ModelTier = typeof ModelTierVals[number]

export const AskValidators = Validator(({ obj, oneof, str, uint, timestamp, lit }) => {
  const modelTier = oneof(ModelTierVals)
    .describe('Which tier answered: "quick" for the deliberately hasty first-instinct guess, "careful" for the more thorough ish extraction. Stored per result so an older result stays honestly labelled even after the app changes which tier it asks for a given job.')

  const approxTokens = uint
    .describe('Rough size of one ask plus its answer, estimated from character count because the page cannot observe real usage. Displayed as "~N tok" so the author can see what a habit of refreshing costs them. Never presented as exact.')

  const askError = obj({
    status:     lit('error'),
    message:    str.min(1)
      .describe('Plain-language reason the ask failed, written for the author rather than copied from an error code. Displayed in place of the result, with an invitation to try again.'),
    updated_at: timestamp,
  })
    .describe('A failed ask, kept in place of whatever was there before so the failure is visible rather than leaving a silently empty cell.')

  return { modelTier, approxTokens, askError }
})

export type AskErrorDNA = Z.input<typeof AskValidators.askError>
export type AskErrorT   = Z.output<typeof AskValidators.askError>

/** One failed ask, stamped now */
export function askError(message: string, updated_at: number = Date.now()): AskErrorT {
  return AskValidators.askError({ status: 'error', message, updated_at })
}
