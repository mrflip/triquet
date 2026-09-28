import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { AskValidators } from './ask'
import { ServicelabelVals } from '../lib/credentials'
import { BulkIshesPrompt, ClueingIshesPrompt, HintIshesPrompt, QuickGuessPrompt } from '../lib/ask/prompts'
import { MaxTokensForJob } from '../lib/ask/models'
import { BotLabelVals } from './bot-label'

export { BotLabelVals, type BotLabel } from './bot-label'

/** Which prompt a bot is given, by what it is being shown: a clueing, a hint, or a whole quiz's worth at once */
export const PromptkindVals = ['clueing', 'hint', 'bulk'] as const
export type Promptkind = typeof PromptkindVals[number]
export type BotPrompts = Partial<Record<Promptkind, string>>

export const BotValidators = Validator(({ obj, zod, oneof, noteish, titleish, uint }) => {
  const botLabel = oneof(BotLabelVals)
    .describe('Which bot: "dumdum" answers a clueing the way a fast, not-especially-careful bot would; "numnum" lists every number-like span in a clueing or a hint.')

  const servicelabel = oneof(ServicelabelVals)
    .describe('Which outside service serves this bot, and so whose credentials it needs before it can play.')

  const prompts = zod.partialRecord(oneof(PromptkindVals), noteish.min(1))
    .describe('The prompt template this bot is given for each kind of text it can be shown, with `{{placeholders}}` still in it. A kind absent here is one the bot is never asked about.')

  const bot = obj({
    label:        botLabel,
    title:        titleish,
    blurb:        noteish,
    servicelabel,
    model_tier:   AskValidators.model_tier,
    max_tokens:   uint.min(1)
      .describe('How much room the bot is given to answer a single text.'),
    prompts,
  })
    .describe('Someone who can be put a question and answer it. Today every bot is a model with a particular brief; the prompts are content, shown to the author verbatim in the Prompts used panel.')

  return { botLabel, servicelabel, prompts, bot }
})

export type BotDNA = Z.input<typeof BotValidators.bot>
export type BotT   = Z.output<typeof BotValidators.bot>

const SeedBotDNAs: readonly BotDNA[] = [
  {
    label:      'dumdum',
    title:      'Dumdum',
    blurb:      'Answers the clueing on first instinct. A guess that differs from the intended title means the question has a second reading.',
    servicelabel: 'claude',
    model_tier: 'quick',
    max_tokens: MaxTokensForJob.guess,
    prompts:    { clueing: QuickGuessPrompt },
  },
  {
    label:      'numnum',
    title:      'Numnum',
    blurb:      'Lists every span a reasonable player might read as a number, so the author can see what a hidden numeric puzzle totals.',
    servicelabel: 'claude',
    model_tier: 'careful',
    max_tokens: MaxTokensForJob.ishes,
    prompts:    { clueing: ClueingIshesPrompt, hint: HintIshesPrompt, bulk: BulkIshesPrompt },
  },
]

/** Every bot there is, with the brief this build gives each */
export const SeedBots: readonly BotT[] = SeedBotDNAs.map((dna) => BotValidators.bot(dna))
