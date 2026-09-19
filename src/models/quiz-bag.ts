import * as Z from 'zod'
import { Validator, plain } from '../lib/validator'
import { QuestionValidators } from './question'
import { QuizValidators } from './quiz'

export const QuizBagValidators = Validator(({ obj, arr, num, str, bool, uint, label, titleish, union }) => {
  const bagQuestion = QuestionValidators.question
    .omit({ id: true, forced_label: true })
    .extend({
      label:     label
        .describe('The question\'s label, the one in force: what `chains_to` in another question refers to.'),
      chains_to: label.nullable()
        .describe('The label of the question this one chains to, or null. Look it up with `qns[label = $$.qn.chains_to]`.'),
      rank:      uint.min(1).nullable()
        .describe('This question\'s 1-based place once the quiz is put in Q# order (ties broken by title); null when it has no Q#.'),
    })
    .describe('One question as a formula sees it: no id, and its chain named by label.')

  const bagQuiz = obj({
    title:           titleish,
    label:           label
      .describe('The quiz\'s label, the one in force.'),
    version:         label,
    locked:          bool,
    last_sortkey:    QuizValidators.sortkey.nullable(),
    bulk_ishes_last: QuizValidators.bulkIshesRun,
  })
    .describe('The quiz itself, without its questions and its computed columns.')

  const quizBag = obj({
    quiz:       bagQuiz,
    qns:        arr(bagQuestion)
      .describe('Every question in the quiz, in the quiz\'s order.'),
    qn:         bagQuestion
      .describe('The question the formula is being worked out for: the same object as one of `qns`.'),
    qn_label:   label
      .describe('The label of `qn`.'),
    quiz_label: label
      .describe('The label of the quiz.'),
  })
    .describe('The document a formula reads: its top-level keys are what the formula can name directly, e.g. `qn.clueing`.')

  const shown = union([str, num, bool])
    .describe('What a cell shows. (A list or an object would be shown as its JSON text, which is rarely what is wanted, so it is not part of the intended output.)')
  const formulaResult = union([
    shown,
    obj({ value: shown.nullable().optional(), stale: bool.optional() })
      .strict()
      .describe('A value with a mark for whether it is out of date: `stale: true` greys it. Any other keys are not accepted.'),
  ])
    .nullable()
    .describe('What a formula comes to for one question. Nothing at all (JSONata `undefined`), null, and an empty string all show as a muted dash, which means "nothing to say here", not zero.')

  return { bagQuestion, bagQuiz, quizBag, formulaResult }
})

export type QuizBagT = Z.output<typeof QuizBagValidators.quizBag>

/** JSON Schema for the document a formula reads */
export function inputSchema(): Z.core.JSONSchema.BaseSchema {
  return Z.toJSONSchema(plain(QuizBagValidators.quizBag), { io: 'output', unrepresentable: 'any' })
}

/** JSON Schema for what a formula may come to */
export function outputSchema(): Z.core.JSONSchema.BaseSchema {
  return Z.toJSONSchema(plain(QuizBagValidators.formulaResult), { io: 'output', unrepresentable: 'any' })
}
