import * as Z from 'zod'
import { Validator } from '../lib/validator'

/** How a span was written: in digits, or as words an attentive player would still total */
export const IshKindVals = ['numeral', 'wordish'] as const
export type IshKind = typeof IshKindVals[number]

/** Most spans one text can carry before the list stops being evidence and starts being noise */
export const IshesPerTextMax = 200

export const IshValidators = Validator(({ obj, oneof, str, textish, num }) => {
  const ishKind = oneof(IshKindVals)
    .describe('"numeral" when the span is written in digits, "wordish" when it reads as a number in words, as an ordinal, or as a magnitude phrase. The two are totalled separately so the author can compare the strict digits-only reading of a clue against the generous reading.')

  const spanText = 'The span exactly as it appears in the source text, preserving punctuation, currency, and script: "#17-19", "9,000+", "千", "douzaine", "Feb 27". Shown verbatim so the author can see precisely what the model latched onto and judge whether a player would too.'
  const spanValue = num
    .describe('What a reasonable player would add up for that span. Magnitude phrases carry their whole value ("300 million" is 300000000, not 300), and fractions stay fractional ("quarter" is 0.25). Zod rejects NaN and Infinity here without further checks.')

  const ishItem = obj({
    text:  textish.min(1).describe(spanText),
    value: spanValue,
    kind:  ishKind,
  })
    .describe('One number-like span found in a clueing or a hint.')

  const ishItemReply = obj({
    text:  str.min(1).describe(spanText),
    value: spanValue,
    kind:  ishKind,
  })
    .describe('One span as the model is asked to give it: any string at all, so the answer arrives to be judged rather than being refused on the way in. It is clipped and held to `ishItem` before anything keeps it.')

  return { ishKind, ishItem, ishItemReply }
})

export type IshItemDNA  = Z.input<typeof IshValidators.ishItem>
export type IshItemT    = Z.output<typeof IshValidators.ishItem>
