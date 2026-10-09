import * as Z from 'zod'
import _ from 'es-toolkit/compat'
import { Validator, plain } from '../lib/validator'
import * as Rank from '../lib/rank'
import * as Stamps from '../lib/stamps'
import * as Wheel from '../lib/wheel'
import { QuestionBodyFieldnames, QuizBodyFieldnames, type CategoryBodyT, type HuntBodyT, type QuestionBodyT, type QuizOwnBodyT, type RealmBodyT, type WidgetedBodyT } from '../lib/jsonball'
import { DefaultBranch, HuntValidators } from './hunt'
import { ArchivedField, Question, QuestionValidators, RankField, SecondaryField, type QuestionT } from './question'
import { Category, CategoryValidators, type CategoryLabel, type WheelT } from './category'
import { QuizValidators, type QuizT } from './quiz'
import { RealmValidators } from './realm'
import type { WidgetedT } from './widgeted'

/** Fields named as a list in words: `label and title`, `label, smiths_note, and title` */
const FieldList = new Intl.ListFormat('en', { type: 'conjunction' })

/*
 * The bag: the document a formula reads, and a template less what only a running widgeting has.
 * It holds a quiz in the shape its export does (`Jsonball`): each question by its label, in the
 * quiz's order, with its place, its own fields, its viz and its stamps; the quiz's own fields; the
 * hunt's; its categories by label. `Bagged` makes each piece, for the bag and the ball alike. The
 * bag adds what is worked out (a question's rank, whether it is archived or an alternate, an
 * estimate's parts), the question being worked out, and the labels of where it sits at its top
 * (`question_label`, `quiz_label` and the rest); the ball adds the quiz's layout. Neither holds a
 * failure: a widgeted is its `status` and `value`.
 */

export const QuizBagValidators = Validator(({ obj, num, str, bool, uint, lit, label, titleish, union, rec, discrim, zod }) => {
  const stamp = str.nullable()
    .describe('A stamp as a person reads it, ISO-8601 in UTC; null for a thing built rather than read.')

  const bagWidgeted = discrim('status', [
    obj({ status: lit('ok'),      value: zod.json() }),
    obj({ status: lit('errored'), value: lit(null) }),
    obj({ status: lit('missing'), value: lit(null) }),
  ])
    .describe('What a widgeting came to: `ok` with a `value`, `errored` (its failure is the cell\'s to show, not the bag\'s), or `missing`. Read `value` only when `status` is `ok`.')

  const bagQuestion = QuestionValidators.question.pick(maskOf(QuestionBodyFieldnames))
    .extend({
      position:         uint
        .describe('The question\'s place in the quiz\'s order, counting from 0.'),
      label:            label
        .describe('The question\'s label: what it is keyed by in `questions`, and what `chains_to` in another question refers to.'),
      chains_to:        label.nullable()
        .describe('The label of the question this one chains to, or null. Look it up in `questions`: `question.chains_to ? $lookup(questions, question.chains_to)` (`$lookup` refuses a null label).'),
      created_at:       stamp,
      updated_at:       stamp,
      [RankField]:      uint.min(1).nullable()
        .describe('This question\'s 1-based place once the quiz is put in Q# order (ties broken by title); null when it has no Q#, or is archived. Worked out, so in the bag alone.'),
      [ArchivedField]:  bool
        .describe('Whether the question is archived (its `viz`): put away from every screen and from everything handed to players, but kept with the quiz.'),
      [SecondaryField]: bool
        .describe('Whether the question is an alternate (its `viz`): a spare offered beside its peers, sorted after them, and left out when the quiz goes live.'),
    })
    .catchall(bagWidgeted
      .describe('What a widgeting before this one in the run order came to for this question, under that widgeting\'s label: `question.numnum_clueing.value.items`, say. A category-estimate entry\'s carries more beside its status and value: `estimates` (its list, a question nobody has placed reading as one estimate of no category in particular), each persona\'s chance at the question, 0 to 1, as `masie`, `artie` and `poppy`, and their `average`: `question.category_data.average`, say.'))
    .describe('One question, as its export holds it: its place, its label, its own fields, its viz, its chain by label and its stamps; its rank and its viz as two yes-or-nos beside them; and the widgeted of every widgeting before the one being worked out, each under its label.')

  const bagQuiz = QuizValidators.row.pick(maskOf(QuizBodyFieldnames))
    .extend({
      label:          label
        .describe('The quiz\'s label: the last part of its address.'),
      title:          titleish
        .describe('What the author calls the quiz.'),
      recap_template: str.nullable()
        .describe('The quiz\'s own recap template; null for one that follows the default.'),
      created_at:     stamp,
      updated_at:     stamp,
    })
    .catchall(bagWidgeted
      .describe('What a widgeting run once for the whole quiz, before the one being worked out, came to, under that widgeting\'s label: `quiz.playtesters.value`, say.'))
    .describe(`The quiz itself, as its export holds its own fields: ${listOf(['label', ...QuizBodyFieldnames, 'recap_template', 'created_at', 'updated_at'])}; and the widgeted of every widgeting run once for the whole quiz before the one being worked out, each under its label.`)

  const bagHunt = HuntValidators.row.pick({ branch: true })
    .extend({
      label:      label
        .describe('The hunt\'s label: the first part of the quiz\'s address.'),
      title:      titleish
        .describe('What the hunt is called on screen; never blank, since a hunt with no title of its own shows its label titleized.'),
      created_at: stamp,
      updated_at: stamp,
    })
    .describe('The hunt the quiz belongs to, as its export holds its own fields: its label, title, branch and stamps.')

  const bagRealm = RealmValidators.row.pick({ label: true })
    .extend({
      label: label
        .describe('The realm\'s label: the middle part of the quiz\'s address. Every hunt has `home`.'),
      title: titleish
        .describe('What the realm is called on screen; never blank, since a realm with no title of its own shows its label titleized.'),
    })
    .describe('The realm, within its hunt, that the quiz sits in: its label and its title.')

  const bagCategory = obj({
    label:    CategoryValidators.categoryLabel,
    title:    str
      .describe('The category as its tile names it on screen: `Math & Econ`, `TV`.'),
    position: uint.nullable()
      .describe('The slot of the hunt\'s wheel the category holds, counting from 0; null for one in the pool.'),
  })
    .describe('One of the subject categories a question may draw on.')

  const quizBag = obj({
    hunt:            bagHunt,
    realm:           bagRealm,
    categories:      rec(CategoryValidators.categoryLabel, bagCategory)
      .describe('The hunt\'s subject categories, each under its label, in its total order (round its wheel from the top, so neighbours are kin, then the pool): `categories.*` lists them.'),
    quiz:            bagQuiz,
    questions:       rec(label, bagQuestion)
      .describe('Every question in the quiz, each under its label, in the quiz\'s order, the archived among them (test `archived` to leave them out): `$lookup(questions, \'q_7\')` finds one, and `questions.*` lists them.'),
    question:        union([bagQuestion, obj({}).strict()])
      .describe('The question the formula is being worked out for: the same object as the one of `questions` under its label. Empty for a widgeting run once for the whole quiz, which is worked out for no question.'),
    hunt_label:      label
      .describe('The label of the hunt.'),
    realm_label:     label
      .describe('The label of the realm.'),
    quiz_label:      label
      .describe('The label of the quiz.'),
    question_label:  label.or(zod.literal(''))
      .describe('The label of `question`; blank for a widgeting run once for the whole quiz.'),
    params:          rec(label, zod.json())
      .describe('What the widgeting being worked out hands its widget, by name. Empty unless it says otherwise.'),
    widgeting_label: label
      .describe('The label of the widgeting being worked out.'),
  })
    .describe('The document a formula reads: its top-level keys are what the formula can name directly, e.g. `question.clueing`.')

  const formulaResult = union([str, num, bool])
    .nullable()
    .describe('What a formula comes to for one question, as a cell shows it. Nothing at all (JSONata `undefined`), null, and an empty string all show as a muted dash, which means "nothing to say here", not zero. (A list or an object is shown as its JSON text, which is rarely what is wanted in a column, so it is not part of the intended output.)')

  return { bagWidgeted, bagQuestion, bagHunt, bagRealm, bagCategory, bagQuiz, quizBag, formulaResult }
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

/** What `Bagged.keyed` made, by the list it was made from, so the bags sharing one list share one */
const KeyedOf = new WeakMap<readonly Record<string, unknown>[], Readonly<Record<string, Record<string, unknown>>>>()

/**
 * The pieces of the bag, and of the jsonball, each made in one place: a question, the quiz's own
 * fields, the hunt's, the realm's, its categories, and what a widgeting came to, each as both
 * hold it. The runner adds what it works out (`Runner.runQuiz`), and the export the quiz's layout
 * (`Exporting.quizBodyOf`).
 */
export const Bagged = Object.freeze({
  /**
   * A question as its ball and the bag hold it, before anything is worked out beside it: its
   * place, its label, its own fields and viz, its chain by label, its stamps as a person reads them.
   *
   * @param question - The question.
   * @param position - Its place in the quiz's order, counting from 0.
   * @param chained - The label of the question it chains to, among its quiz's; null for none.
   *
   * @example Bagged.question(leon, 0, 'nantes')  // => { position: 0, label: 'leon', qnum: '1', ..., viz: 'normal', chains_to: 'nantes', created_at: '2026-10-05T12:00:00.000Z', updated_at: ... }
   */
  question(question: QuestionT, position: number, chained: string | null): QuestionBodyT {
    return { position, label: question.label, ..._.pick(question, QuestionBodyFieldnames), chains_to: chained, ...Stamps.isoStampsOf(question) }
  },

  /**
   * Every question of a quiz, in its order, as `question` makes each: each chain named by the
   * label of the question it points at among them, and one to a question they do not hold named
   * as none.
   *
   * @example Bagged.questions([leon, nantes]).map(({ label, position }) => [label, position])  // => [['leon', 0], ['nantes', 1]]
   */
  questions(questions: readonly QuestionT[]): QuestionBodyT[] {
    const labelForId = new Map(questions.map((question) => [question._id, question.label]))
    return questions.map((question, ii) => Bagged.question(question, ii, question.chains_to === null ? null : labelForId.get(question.chains_to) ?? null))
  },

  /**
   * What the bag works out beside each of a quiz's questions, in its order: its rank, and its viz
   * as two yes-or-nos (`archived`, `secondary`). Worked out from fields the ball holds, so the
   * ball holds none of them.
   *
   * @example Bagged.workedOut([leon])  // => [{ rank: 1, archived: false, secondary: false }]
   */
  workedOut(questions: readonly QuestionT[]): Record<string, unknown>[] {
    const ranks = Rank.ranksOf(questions)
    return questions.map((question) => ({
      [RankField]:      ranks.get(question._id) ?? null,
      [ArchivedField]:  Question.isArchived(question),
      [SecondaryField]: Question.isSecondary(question),
    }))
  },

  /**
   * The quiz's own fields as its ball and the bag hold them: its label, its fields, its recap
   * template (null for the default), its stamps; never its questions, widgetings or columns.
   *
   * @example Bagged.quiz(quiz).recap_template  // => null
   */
  quiz(quiz: QuizT): QuizOwnBodyT {
    return { label: quiz.label, ..._.pick(quiz, QuizBodyFieldnames), recap_template: quiz.recap_template ?? null, ...Stamps.isoStampsOf(quiz) }
  },

  /**
   * The hunt's own fields as its ball and the bag hold them: its label, its title as shown, its
   * branch (`main` for one that names none), its stamps as a person reads them.
   *
   * @example Bagged.hunt({ label: 'deep_lake', title: 'Deep Lake' })  // => { label: 'deep_lake', title: 'Deep Lake', branch: 'main', created_at: null, updated_at: null }
   */
  hunt(hunt: Pick<HuntBodyT, 'label' | 'title'> & { branch?: string, created_at?: number | null, updated_at?: number | null }): HuntBodyT {
    return { label: hunt.label, title: hunt.title, branch: hunt.branch ?? DefaultBranch, ...Stamps.isoStampsOf(_.pick(hunt, Stamps.StampFieldnames)) }
  },

  /**
   * The realm as the bag holds it: its label, and its title as shown.
   *
   * @example Bagged.realm({ label: 'home', title: 'Home' })  // => { label: 'home', title: 'Home' }
   */
  realm(realm: RealmBodyT): RealmBodyT {
    return { label: realm.label, title: realm.title }
  },

  /**
   * The hunt's categories as its ball and the bag hold them: each by its label, with its title
   * and the slot of the wheel it holds (null for one in the pool), in the wheel's total order.
   *
   * @example Bagged.categories(Wheel.defaultWheel()).math_econ  // => { label: 'math_econ', title: 'Math & Econ', position: 0 }
   */
  categories(wheel: WheelT): Record<CategoryLabel, CategoryBodyT> {
    return Object.fromEntries(Wheel.orderOf(wheel).map((label) => {
      const slot = wheel.indexOf(label)
      return [label, { label, title: Category.titleOf(label), position: slot === -1 ? null : slot }]
    })) as Record<CategoryLabel, CategoryBodyT>
  },

  /**
   * What a widgeting came to, as the ball and the bag hold it: its status and value, never its
   * failure.
   *
   * @example Bagged.widgeted({ status: 'ok', value: 3, err: null })  // => { status: 'ok', value: 3 }
   */
  widgeted(widgeted: WidgetedT): WidgetedBodyT {
    return { status: widgeted.status, value: widgeted.value }
  },

  /**
   * Questions as the bag holds them, each under its label in the order given: made once per list,
   * so every bag over the same questions shares one, and a formula finds a question by its label
   * at once rather than by searching.
   *
   * @example Bagged.keyed([{ label: 'leon', title: 'Leon' }]).leon.title  // => 'Leon'
   */
  keyed(questions: readonly Record<string, unknown>[]): Readonly<Record<string, Record<string, unknown>>> {
    const known = KeyedOf.get(questions)
    if (known !== undefined) { return known }
    const keyed = Object.fromEntries(questions.map((question) => [String(question.label), question]))
    KeyedOf.set(questions, keyed)
    return keyed
  },
})

/** JSON Schema for the document a formula reads */
export function inputSchema(): Z.core.JSONSchema.BaseSchema {
  return Z.toJSONSchema(plain(QuizBagValidators.quizBag), { io: 'output', unrepresentable: 'any' })
}

/** JSON Schema for what a formula may come to */
export function outputSchema(): Z.core.JSONSchema.BaseSchema {
  return Z.toJSONSchema(plain(QuizBagValidators.formulaResult), { io: 'output', unrepresentable: 'any' })
}
