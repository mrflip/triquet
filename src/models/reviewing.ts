import type * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as PA from '../lib/vv/patterns'

export const ReviewingValidators = Validator(({ obj, uint, num, noteish, textish, bool, stamps, zid }) => {
  // Each field is named once, without its default, and then defaulted in the row and made
  // optional in the patch: see the patch pattern in `notes/guidelines.md`.
  const get_rate = uint.max(100).nullable()
    .describe('The reviewer\'s own estimate of how likely they would have been to get it, as a percentage; null when they have not said.')
  const guesses = noteish
    .describe('What the reviewer guessed on the way to an answer, freeform.')
  const comments = textish
    .describe('What the reviewer made of the question: the one field of a reviewing that may run long.')
  const minutes = num.min(PA.Minutes.min).max(PA.Minutes.max).nullable()
    .describe('About how many minutes the reviewer spent on it, fractions allowed; null when they have not said.')
  const keep_it = bool
    .describe('The reviewer would keep this question as it is: one of their top 3. Never raised alongside elimination_candidate.')
  const needs_fact_check = bool
    .describe('The reviewer doubts a fact the question rests on.')
  const elimination_candidate = bool
    .describe('The reviewer would cut this question, were one to go: one of their meh 3. Never raised alongside keep_it.')
  const peeked = bool
    .describe('Whether the reviewer has revealed the answer: set the first time they do, and never cleared. The reviewer\'s own record, shown to them rather than to the smiths.')

  const row = obj({
    hunt_id:               zid('hunts')
      .describe('The hunt of the review it is part of, copied from the review when the reviewing is made.'),
    quiz_id:               zid('quizzes')
      .describe('The quiz of the review it is part of, copied from the review when the reviewing is made.'),
    ident_id:              zid('idents')
      .describe('Who wrote the review it is part of, copied from the review when the reviewing is made.'),
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
    ...stamps,
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
    .refine((patch) => ! (patch.keep_it && patch.elimination_candidate), { message: 'A question is a top pick or a meh pick, never both.', path: ['elimination_candidate'] })
    .describe('The fields of one reviewing being revised. A key absent from a patch means "leave whatever is already there", so no field here carries a default.')

  return { row, reviewingPatch }
})

export type ReviewingDNA   = Z.input<typeof ReviewingValidators.row>
export type ReviewingRowT  = Z.output<typeof ReviewingValidators.row>
export type ReviewingPatch = Z.output<typeof ReviewingValidators.reviewingPatch>

/** What a reviewing copies from its review: the review's row id, hunt, quiz and writer */
export type ReviewOfReviewingT = { _id: ReviewingDNA['review_id'] } & Pick<ReviewingDNA, 'hunt_id' | 'quiz_id' | 'ident_id'>

/** The flags a reviewer may raise on a question, each with the face it shows as, the word beside it, and what it means */
export const ReviewingFlags = [
  { flag: 'keep_it',               emoji: '😍', word: `top ${String(PA.PicksPerReview.max)}`, title: 'Keep it: one of the top picks' },
  { flag: 'needs_fact_check',      emoji: '🤨', word: 'needs fact check',                     title: 'Needs fact check' },
  { flag: 'elimination_candidate', emoji: '😐', word: `meh ${String(PA.PicksPerReview.max)}`, title: 'Elimination candidate: one of the meh picks' },
] as const satisfies readonly { flag: keyof ReviewingPatch, emoji: string, word: string, title: string }[]

/**
 * The flags that pick a question out of a reviewer's quiz, each paired with its rival: a question
 * is a top pick or a meh pick, never both, and a review makes at most `PA.PicksPerReview.max` of
 * each.
 */
export const PickFlags = { keep_it: 'elimination_candidate', elimination_candidate: 'keep_it' } as const
export type PickFlag = keyof typeof PickFlags

/** One review's verdict on one question: a get rate, guesses, comments, minutes and three flags */
export class Reviewing implements ReviewingRowT {
  declare hunt_id:               ReviewingRowT['hunt_id']
  declare quiz_id:               ReviewingRowT['quiz_id']
  declare ident_id:              ReviewingRowT['ident_id']
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
  declare created_at:            number
  declare updated_at:            number

  /**
   * The reviewing a review has of a question before the reviewer has said anything about it,
   * carrying the review's hunt, quiz and writer.
   *
   * @param review - Whose review: its row id, hunt, quiz and writer.
   * @param question_id - Which question.
   * @returns A row with nothing written, no flag raised, and the answer not yet seen.
   *
   * @example Reviewing.blank(review, question._id).get_rate  // => null
   */
  static blank(review: ReviewOfReviewingT, question_id: ReviewingDNA['question_id']): ReviewingRowT {
    const { _id: review_id, hunt_id, quiz_id, ident_id } = review
    return ReviewingValidators.row({ hunt_id, quiz_id, ident_id, review_id, question_id })
  }

  /**
   * `patch` with the rival of each pick it raises lowered, so a question is never picked both ways.
   *
   * @param patch - What the reviewer changed.
   * @returns The patch as it should be written; unchanged when it raises no pick.
   *
   * @example Reviewing.unrivalled({ keep_it: true })  // => { keep_it: true, elimination_candidate: false }
   * @example Reviewing.unrivalled({ keep_it: false }) // => { keep_it: false }
   */
  static unrivalled(patch: ReviewingPatch): ReviewingPatch {
    const raised = (Object.keys(PickFlags) as PickFlag[]).filter((flag) => patch[flag] === true)
    return { ...patch, ...Object.fromEntries(raised.map((flag) => [PickFlags[flag], false])) }
  }

  /**
   * How many questions other than `question_id` a review has picked by `flag`: what stands
   * between a reviewer and raising it on this one.
   *
   * @param reviewings - The review's reviewings.
   * @param flag - Which pick.
   * @param question_id - The question about to be picked, which is not counted.
   * @returns The count.
   *
   * @example Reviewing.pickedElsewhere(reviewings, 'keep_it', question._id) >= PA.PicksPerReview.max
   */
  static pickedElsewhere(reviewings: readonly ({ question_id: string } & Pick<ReviewingRowT, PickFlag>)[], flag: PickFlag, question_id: string): number {
    return reviewings.filter((reviewing) => reviewing[flag] && reviewing.question_id !== question_id).length
  }
}
