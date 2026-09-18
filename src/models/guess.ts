import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { AskValidators } from './ask'

export const GuessValidators = Validator(({ obj, str, bool, timestamp, lit, discrim }) => {
  const guessDone = obj({
    status:             lit('done'),
    text:               str
      .describe('The model\'s answer, as one line, verbatim and untrimmed of its own wording. The author compares this against the intended title by eye; the tool never scores the comparison for them.'),
    model_tier_applied: AskValidators.modelTier.optional(),
    truncated:          bool.default(false),
    approx_tokens:      AskValidators.approxTokens.optional(),
    updated_at:         timestamp,
  })

  const guess = discrim('status', [guessDone, AskValidators.askError]).nullable()
    .describe('What a fast, not-especially-careful reader answered, or null when never asked. This is the ambiguity signal: a guess that differs from the intended title means the question has a second reading the author could not see from the inside.')

  return { guessDone, guess }
})

export type GuessDoneT = Z.output<typeof GuessValidators.guessDone>
export type GuessDNA   = Z.input<typeof GuessValidators.guess>
export type GuessT     = Z.output<typeof GuessValidators.guess>
