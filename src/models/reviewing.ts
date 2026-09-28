import type * as Z from 'zod'
import { Validator } from '../lib/validator'

export const ReviewingValidators = Validator(({ obj, uint, num, noteish, textish, bool, zid }) => {
  // Each field is named once, without its default, and then defaulted in the row and made
  // optional in the patch: see the patch pattern in `notes/guidelines.md`.
  const get_rate = uint.max(100).nullable()
    .describe('The reviewer\'s own estimate of how likely they would have been to get it, as a percentage; null when they have not said.')
  const guesses = noteish
    .describe('What the reviewer guessed on the way to an answer, freeform.')
  const comments = textish
    .describe('What the reviewer made of the question: the one field of a reviewing that may run long.')
  const minutes = num.nonnegative().nullable()
    .describe('About how many minutes the reviewer spent on it, fractions allowed; null when they have not said.')
  const keep_it = bool
    .describe('The reviewer would keep this question as it is.')
  const needs_fact_check = bool
    .describe('The reviewer doubts a fact the question rests on.')
  const elimination_candidate = bool
    .describe('The reviewer would cut this question, were one to go.')
  const peeked = bool
    .describe('Whether the reviewer has revealed the answer: set the first time they do, and never cleared. The reviewer\'s own record, shown to them rather than to the smiths.')

  const row = obj({
    review_id:             zid('reviews')
      .describe('The review this verdict is part of.'),
    question_id:           zid('questions')
      .describe('The question it is a verdict on.'),
    get_rate:              get_rate.default(null),
    guesses:               guesses.default(''),
    comments:              comments.default(''),
    minutes:               minutes.default(null),
    keep_it:               keep_it.default(false),
    needs_fact_check:      needs_fact_check.default(false),
    elimination_candidate: elimination_candidate.default(false),
    peeked:                peeked.default(false),
  })
    .describe('One review\'s verdict on one question: at most one per review and question, made the first time the reviewer writes to that question.')

  // The ids and `peeked` are absent: a reviewing is never moved, and only revealing the answer
  // sets `peeked`.
  const reviewingPatch = obj({
    get_rate:              get_rate.optional(),
    guesses:               guesses.optional(),
    comments:              comments.optional(),
    minutes:               minutes.optional(),
    keep_it:               keep_it.optional(),
    needs_fact_check:      needs_fact_check.optional(),
    elimination_candidate: elimination_candidate.optional(),
  })
    .describe('The fields of one reviewing being revised. A key absent from a patch means "leave whatever is already there", so no field here carries a default.')

  return { row, reviewingPatch }
})

export type ReviewingDNA   = Z.input<typeof ReviewingValidators.row>
export type ReviewingRowT  = Z.output<typeof ReviewingValidators.row>
export type ReviewingPatch = Z.output<typeof ReviewingValidators.reviewingPatch>

/** The flags a reviewer may raise on a question, each with the emoji it shows as and what it means */
export const ReviewingFlags = [
  { flag: 'keep_it',               emoji: '👍', title: 'Keep it' },
  { flag: 'needs_fact_check',      emoji: '🔍', title: 'Needs fact check' },
  { flag: 'elimination_candidate', emoji: '✂️', title: 'Elimination candidate' },
] as const satisfies readonly { flag: keyof ReviewingPatch, emoji: string, title: string }[]

/** One review's verdict on one question: a get rate, guesses, comments, minutes and three flags */
export class Reviewing implements ReviewingRowT {
  declare review_id:             ReviewingRowT['review_id']
  declare question_id:           ReviewingRowT['question_id']
  declare get_rate:              number | null
  declare guesses:               string
  declare comments:              string
  declare minutes:               number | null
  declare keep_it:               boolean
  declare needs_fact_check:      boolean
  declare elimination_candidate: boolean
  declare peeked:                boolean

  /**
   * The reviewing a review has of a question before the reviewer has said anything about it.
   *
   * @param review_id - Whose review.
   * @param question_id - Which question.
   * @returns A row with nothing written, no flag raised, and the answer not yet seen.
   *
   * @example Reviewing.blank(review._id, question._id).get_rate  // => null
   */
  static blank(review_id: ReviewingDNA['review_id'], question_id: ReviewingDNA['question_id']): ReviewingRowT {
    return ReviewingValidators.row({ review_id, question_id })
  }
}
