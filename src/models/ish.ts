import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { AskValidators } from './ask'

/** How a span was written: in digits, or as words an attentive player would still total */
export const IshKindVals = ['numeral', 'wordish'] as const
export type IshKind = typeof IshKindVals[number]

/** Most spans one text can carry before the list stops being evidence and starts being noise */
export const IshesPerTextMax = 200

export const IshValidators = Validator(({ obj, arr, oneof, str, num, bool, timestamp, lit, discrim }) => {
  const ishKind = oneof(IshKindVals)
    .describe('"numeral" when the span is written in digits, "wordish" when it reads as a number in words, as an ordinal, or as a magnitude phrase. The two are totalled separately so the author can compare the strict digits-only reading of a clue against the generous reading.')

  const ishItem = obj({
    text:  str.min(1)
      .describe('The span exactly as it appears in the source text, preserving punctuation, currency, and script: "#17-19", "9,000+", "千", "douzaine", "Feb 27". Shown verbatim so the author can see precisely what the model latched onto and judge whether a player would too.'),
    value: num
      .describe('What a reasonable player would add up for that span. Magnitude phrases carry their whole value ("300 million" is 300000000, not 300), and fractions stay fractional ("quarter" is 0.25). Zod rejects NaN and Infinity here without further checks.'),
    kind:  ishKind,
  })
    .describe('One number-like span found in a clueing or a hint.')

  const ishesDone = obj({
    status:             lit('done'),
    items:              arr(ishItem).max(IshesPerTextMax).default([])
      .describe('Every span found, in the order it appears in the source text. An empty array is a real answer meaning "nothing here reads as a number", and is displayed as "None found" rather than as a blank cell.'),
    model_tier_applied: AskValidators.modelTier.optional(),
    truncated:          bool.default(false)
      .describe('True when the answer was cut short before it finished. Shown as "· cut short" so a suspiciously small list is never mistaken for a complete one.'),
    approx_tokens:      AskValidators.approxTokens.optional()
      .describe('Present for a single-cell ask. Deliberately absent for a result that came from one batched request covering many cells, because attributing a share of that cost to one cell would be a made-up number.'),
    stale:              bool.default(false)
      .describe('True when the text this was extracted from has been edited since. The result stays on screen, greyed and italic, rather than vanishing -- a slightly-out-of-date total is more useful to the author than an empty cell, as long as it is honestly marked.'),
    updated_at:         timestamp,
  })

  const ishes = discrim('status', [ishesDone, AskValidators.askError]).nullable()
    .describe('The extraction for one piece of text, or null when it has never been asked for. Null, an error, and a successful empty list are three genuinely different states and each reads differently on screen.')

  return { ishKind, ishItem, ishesDone, ishes }
})

/**
 * `ishes`, marked as no longer matching the text it came from.
 *
 * A stale result stays on screen, greyed and italic, rather than vanishing: a slightly
 * out-of-date total is more useful to the author than an empty cell, as long as it says so.
 *
 * @param ishes - The extraction, in whatever state it is in.
 * @returns The same extraction marked stale; unchanged when there is nothing to mark.
 *
 * @example markIshesStale({ status: 'done', items: [], stale: false, ... }).stale  // => true
 */
export function markIshesStale(ishes: IshesT): IshesT {
  if (ishes?.status !== 'done' || ishes.stale) { return ishes }
  return { ...ishes, stale: true }
}

export type IshItemDNA  = Z.input<typeof IshValidators.ishItem>
export type IshItemT    = Z.output<typeof IshValidators.ishItem>
export type IshesDoneT  = Z.output<typeof IshValidators.ishesDone>
export type IshesDNA    = Z.input<typeof IshValidators.ishes>
export type IshesT      = Z.output<typeof IshValidators.ishes>
