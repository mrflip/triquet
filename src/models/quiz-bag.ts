import * as Z from 'zod'
import { Validator, plain } from '../lib/validator'
import { IshValidators } from './ish'
import { Hunt, HuntValidators } from './hunt'
import { Question, QuestionValidators } from './question'
import { Quiz, QuizValidators } from './quiz'
import { Realm, RealmValidators } from './realm'

/** Fields named as a list in words: `label and title`, `label, smiths_note, and title` */
const FieldList = new Intl.ListFormat('en', { type: 'conjunction' })

export const QuizBagValidators = Validator(({ obj, arr, num, str, bool, oneof, uint, textish, label, titleish, union }) => {
  const played = oneof(['done', 'error'])
    .describe('Whether the bot answered: `done`, or `error` when asking failed and there was never an answer.')

  const guess = obj({ status: played, text: textish.optional() })
    .nullable()
    .describe('What a fast, not-especially-careful reader answered for the question\'s clueing; null when never asked. Nothing about cost, model, time or failure is shown.')

  const ishes = obj({ status: played, items: arr(IshValidators.ishItem).optional(), stale: bool.optional() })
    .nullable()
    .describe('Every number-like span a bot found in one text, and whether that text has been edited since (`stale`); null when never asked. Nothing about cost, model, time or failure is shown.')

  const exposedQuestion = QuestionValidators.question.pick(maskOf(Question.exposed))
  const bagQuestion = exposedQuestion
    .extend({
      label:         label
        .describe('The question\'s label, the one in force: what `chains_to` in another question refers to.'),
      chains_to:     label.nullable()
        .describe('The label of the question this one chains to, or null. Look it up with `qns[label = $$.qn.chains_to]`.'),
      rank:          uint.min(1).nullable()
        .describe('This question\'s 1-based place once the quiz is put in Q# order (ties broken by title); null when it has no Q#.'),
      guess,
      clueing_ishes: ishes.describe('What the number spotter found in the clueing.'),
      hint_ishes:    ishes.describe('What the number spotter found in this question\'s own hint.'),
    })
    .describe('One question as a formula sees it: only its exposed fields, no id, and its chain named by label.')

  const bagQuiz = QuizValidators.row.pick(maskOf(Quiz.exposed))
    .extend({
      label: label
        .describe('The quiz\'s label, the one in force: the last part of its address.'),
      title: titleish
        .describe('What the author calls the quiz.'),
    })
    .describe(`The quiz itself: only ${listOf(Quiz.exposed)}.`)

  const bagHunt = HuntValidators.row.pick(maskOf(Hunt.exposed))
    .extend({
      label: label
        .describe('The hunt\'s label, the one in force: the first part of the quiz\'s address.'),
      title: titleish
        .describe('What the hunt is called on screen; never blank, since a hunt with no title of its own shows its label titleized.'),
    })
    .describe(`The hunt the quiz belongs to: only ${listOf(Hunt.exposed)}.`)

  const bagRealm = RealmValidators.row.pick(maskOf(Realm.exposed))
    .extend({
      label: label
        .describe('The realm\'s label: the middle part of the quiz\'s address. Every hunt has `home`.'),
      title: titleish
        .describe('What the realm is called on screen; never blank, since a realm with no title of its own shows its label titleized.'),
    })
    .describe(`The realm, within its hunt, that the quiz sits in: only ${listOf(Realm.exposed)}.`)

  const quizBag = obj({
    hunt:       bagHunt,
    realm:      bagRealm,
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

  return { bagQuestion, bagHunt, bagRealm, bagQuiz, quizBag, formulaResult }
})

/** A Zod `pick` mask naming every field of `fields` */
function maskOf<FT extends string>(fields: readonly FT[]): Record<FT, true> {
  return Object.fromEntries(fields.map((field) => [field, true])) as Record<FT, true>
}

/** `fields` as a list in words */
function listOf(fields: readonly string[]): string {
  return FieldList.format(fields)
}

export type QuizBagT = Z.output<typeof QuizBagValidators.quizBag>

/** JSON Schema for the document a formula reads */
export function inputSchema(): Z.core.JSONSchema.BaseSchema {
  return Z.toJSONSchema(plain(QuizBagValidators.quizBag), { io: 'output', unrepresentable: 'any' })
}

/** JSON Schema for what a formula may come to */
export function outputSchema(): Z.core.JSONSchema.BaseSchema {
  return Z.toJSONSchema(plain(QuizBagValidators.formulaResult), { io: 'output', unrepresentable: 'any' })
}
