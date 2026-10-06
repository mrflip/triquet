import type * as Z from 'zod'
import { Validator } from '../lib/validator'
import { CategoryValidators, WheelSlotCount, type CategoryLabel } from './category'

/** How hard a question is for a player who knows its category: the three steps a persona's chance is read at */
export const DifficultyVals = ['easy', 'medium', 'hard'] as const
export type Difficulty = typeof DifficultyVals[number]

/** Each difficulty as a face, wherever the screen shows one: a slice of cake, a puzzled frown, a devil */
export const DifficultyGlyphs = { easy: '🍰', medium: '🤔', hard: '😈' } as const satisfies Record<Difficulty, string>

/** The difficulty an estimate is given when none is said */
export const DifficultyDefault: Difficulty = 'medium'

export const EstimateValidators = Validator(({ obj, arr, oneof, categoryLabel }) => {
  // Each field is named once, bare, and given its default where an estimate is filled.
  const difficulty = oneof(DifficultyVals)
    .describe('How hard the question is for a player who knows the category: `easy`, `medium` or `hard`.')
  const category = categoryLabel.nullable()
    .describe('The subject category the question draws on, by its label; null for no category in particular, which every persona answers as if it sat halfway between what they know best and least.')

  const estimate = obj({
    category,
    difficulty: difficulty.default(DifficultyDefault),
  })
    .describe('One guess at what a question draws on: a subject category, or none in particular, and how hard it is there.')

  const estimates = arr(estimate).min(1).max(WheelSlotCount)
    .check((context) => {
      const { value: listed } = context
      for (const [idx, { category: label }] of listed.entries()) {
        if (label === null && listed.length > 1) {
          context.issues.push({ code: 'custom', input: label, path: [idx, 'category'], message: 'An estimate of no category in particular stands alone, or not at all' })
        }
        if (label !== null && listed.findIndex((each) => each.category === label) < idx) {
          context.issues.push({ code: 'custom', input: label, path: [idx, 'category'], message: 'A category may be estimated only once for a question' })
        }
      }
    })
    .describe('What a question draws on: one estimate for each category it opens onto, each category once; or a lone estimate of no category in particular.')

  return { difficulty, estimate, estimates }
}, CategoryValidators)

export type EstimateDNA  = Z.input<typeof EstimateValidators.estimate>
/** One guess at what a question draws on: a category, or null for none in particular, and how hard it is there */
export type EstimateT    = Z.output<typeof EstimateValidators.estimate>
export type EstimatesDNA = Z.input<typeof EstimateValidators.estimates>
/** Every guess at what one question draws on: each category once, or a lone estimate of none in particular */
export type EstimatesT   = Z.output<typeof EstimateValidators.estimates>

/** One guess at what a question draws on, and how hard it is there */
export class Estimate {
  declare category:   CategoryLabel | null
  declare difficulty: Difficulty

  /**
   * Validated estimate, its difficulty defaulted to `medium`.
   *
   * @example Estimate.fill({ category: 'tv' })  // => { category: 'tv', difficulty: 'medium' }
   */
  static fill(dna: EstimateDNA): EstimateT {
    return EstimateValidators.estimate(dna)
  }

  /**
   * An estimate of no category in particular, at `difficulty`: what a question nobody has
   * placed is taken to draw on.
   *
   * @example Estimate.neutral()        // => { category: null, difficulty: 'medium' }
   * @example Estimate.neutral('hard')  // => { category: null, difficulty: 'hard' }
   */
  static neutral(difficulty: Difficulty = DifficultyDefault): EstimateT {
    return { category: null, difficulty }
  }
}
