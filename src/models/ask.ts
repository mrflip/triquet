import { Validator } from '../lib/validator'

/** Which model tier answered an ask */
export const ModelTierVals = ['quick', 'careful'] as const
export type ModelTier = typeof ModelTierVals[number]

export const AskValidators = Validator(({ oneof, uint }) => {
  const model_tier = oneof(ModelTierVals).default('quick')
    .describe('Which tier answered: "quick" for the deliberately hasty first-instinct guess, "careful" for the more thorough ish extraction. Stored per result so an older result stays honestly labelled even after the app changes which tier it asks for a given job. Defaults to "quick" -- the tier the app reaches for when nothing says otherwise.')

  const approxTokens = uint
    .describe('Rough size of one ask plus its answer, estimated from character count because the page cannot observe real usage. Displayed as "~N tok" so the author can see what a habit of refreshing costs them. Never presented as exact.')

  return { model_tier, approxTokens }
})
