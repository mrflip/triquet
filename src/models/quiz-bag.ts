import * as Z from 'zod'
import { Validator, plain } from '../lib/validator'
import { Hunt, HuntValidators } from './hunt'
import { Question, QuestionValidators, RankField } from './question'
import { Quiz, QuizValidators } from './quiz'
import { Realm, RealmValidators } from './realm'
import { WidgetedValidators } from './widgeted'

/** Fields named as a list in words: `label and title`, `label, smiths_note, and title` */
const FieldList = new Intl.ListFormat('en', { type: 'conjunction' })

export const QuizBagValidators = Validator(({ obj, arr, num, str, bool, uint, label, titleish, union, rec, zod }) => {
  const exposedQuestion = QuestionValidators.question.pick(maskOf(Question.exposed))
  const bagQuestion = exposedQuestion
    .extend({
      label:         label
        .describe('The question\'s label: what `chains_to` in another question refers to.'),
      chains_to:     label.nullable()
        .describe('The label of the question this one chains to, or null. Look it up with `qns[label = $$.qn.chains_to]`.'),
      [RankField]:   uint.min(1).nullable()
        .describe('This question\'s 1-based place once the quiz is put in Q# order (ties broken by title); null when it has no Q#.'),
    })
    .catchall(WidgetedValidators.widgeted
      .describe('What a widgeting before this one in the run order came to for this question, under that widgeting\'s label: `qn.numnum_clueing.value.items`, say.'))
    .describe('One question as a formula sees it: only its exposed fields, no id, and its chain named by label; and the widgeted of every widgeting before the one being worked out, each under its label.')

  const bagQuiz = QuizValidators.row.pick(maskOf(Quiz.exposed))
    .extend({
      label: label
        .describe('The quiz\'s label: the last part of its address.'),
      title: titleish
        .describe('What the author calls the quiz.'),
    })
    .describe(`The quiz itself: only ${listOf(Quiz.exposed)}.`)

  const bagHunt = HuntValidators.row.pick(maskOf(Hunt.exposed))
    .extend({
      label: label
        .describe('The hunt\'s label: the first part of the quiz\'s address.'),
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
    params:          rec(label, zod.json())
      .describe('What the widgeting being worked out hands its widget, by name. Empty unless it says otherwise.'),
    widgeting_label: label
      .describe('The label of the widgeting being worked out.'),
  })
    .describe('The document a formula reads: its top-level keys are what the formula can name directly, e.g. `qn.clueing`.')

  const formulaResult = union([str, num, bool])
    .nullable()
    .describe('What a formula comes to for one question, as a cell shows it. Nothing at all (JSONata `undefined`), null, and an empty string all show as a muted dash, which means "nothing to say here", not zero. (A list or an object is shown as its JSON text, which is rarely what is wanted in a column, so it is not part of the intended output.)')

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
