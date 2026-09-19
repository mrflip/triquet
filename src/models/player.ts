import * as Z from 'zod'
import { createInsertSchema } from 'drizzle-zod'
import { Validator } from '../lib/validator'
import { AskValidators } from './ask'
import { players } from '../db/schema'
import { BulkIshesPrompt, ClueingIshesPrompt, HintIshesPrompt, QuickGuessPrompt } from '../lib/ask/prompts'
import { MaxTokensForJob } from '../lib/ask/models'

/** Every player there is: the hasty guesser, and the number spotter */
export const PlayerLabelVals = ['dumdum', 'numnum'] as const
export type PlayerLabel = typeof PlayerLabelVals[number]

/** Which prompt a player is given, by what it is being shown: a clueing, a hint, or a whole quiz's worth at once */
export const PromptkindVals = ['clueing', 'hint', 'bulk'] as const
export type Promptkind = typeof PromptkindVals[number]
export type PlayerPrompts = Partial<Record<Promptkind, string>>

export const PlayerValidators = Validator(({ zod, oneof, noteish, titleish, uint }) => {
  const playerLabel = oneof(PlayerLabelVals)
    .describe('Which player: "dumdum" answers a clueing the way a fast, not-especially-careful player would; "numnum" lists every number-like span in a clueing or a hint.')

  const prompts = zod.partialRecord(oneof(PromptkindVals), noteish.min(1))
    .describe('The prompt template this player is given for each kind of text it can be shown, with `{{placeholders}}` still in it. A kind absent here is one the player is never asked about.')

  // drizzle-zod calls any function it is handed as a refinement, and our callable validators
  // are functions, so those are passed wrapped rather than bare.
  const player = createInsertSchema(players, {
    label:      playerLabel,
    title:      titleish,
    blurb:      noteish,
    model_tier: () => AskValidators.modelTier,
    max_tokens: uint.min(1)
      .describe('How much room the player is given to answer a single text.'),
    prompts,
  })
    .describe('Someone who can be put a question and answer it. Today every player is a model with a particular brief; the prompts are content, shown to the author verbatim in the Prompts used panel.')

  return { playerLabel, prompts, player }
})

export type PlayerDNA = Z.input<typeof PlayerValidators.player>
export type PlayerT   = Z.output<typeof PlayerValidators.player>

const SeedPlayerDNAs: readonly PlayerDNA[] = [
  {
    label:      'dumdum',
    title:      'Dumdum',
    blurb:      'Answers the clueing on first instinct. A guess that differs from the intended title means the question has a second reading.',
    model_tier: 'quick',
    max_tokens: MaxTokensForJob.guess,
    prompts:    { clueing: QuickGuessPrompt },
  },
  {
    label:      'numnum',
    title:      'Numnum',
    blurb:      'Lists every span a reasonable player might read as a number, so the author can see what a hidden numeric puzzle totals.',
    model_tier: 'careful',
    max_tokens: MaxTokensForJob.ishes,
    prompts:    { clueing: ClueingIshesPrompt, hint: HintIshesPrompt, bulk: BulkIshesPrompt },
  },
]

/** The players every database holds, rewritten to match this build whenever it is opened */
export const SeedPlayers: readonly PlayerT[] = SeedPlayerDNAs.map((dna) => PlayerValidators.player(dna))
