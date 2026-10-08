import * as Z from 'zod'
import _ from 'es-toolkit/compat'
import { Validator } from '../lib/validator'
import { ForcedLabelField, PositionField } from '../lib/jsonball'
import * as Labelmaker from '../lib/labelmaker'
import { StampFieldnames } from '../lib/stamps'
import * as UU from '../lib/useful'
import * as PA from '../lib/vv/patterns'
import { ColumnStageFieldnames, ColumnValidators, QuestionViewVals, QuestionWidgetLabel, WidgetingPartVals } from './column'
import { ArchivedField, PlaceField, Question, RankField, SecondaryField, VizField } from './question'
import { StalenessFieldnames, WidgetedValidators } from './widgeted'
import { EntryKindOncePerQuiz, type WidgetT } from './widget'

/**
 * The keys at the top of every bag a formula reads (`QuizBagValidators.quizBag`, which is held to
 * this list): where the quiz sits, its questions, the one being worked out, and the running
 * widgeting's own. Written here rather than read from the bag's validator, which is built on the
 * quiz's and so on the widgeting's.
 */
export const QuizBagKeys = ['hunt', 'realm', 'categories', 'quiz', 'qns', 'qn', 'qn_label', 'quiz_label', 'params', 'widgeting_label'] as const

/** Every key a widgeted holds, as the bag has it under `qn.<label>` or as its row stores it, and the two it is to carry for its staleness */
const WidgetedKeys: readonly string[] = [
  ...WidgetedValidators.widgeted.options.flatMap((option) => Object.keys(option.shape)),
  ...Object.keys(WidgetedValidators.stored.shape).filter((key) => ! key.startsWith('_')),
  ...StalenessFieldnames,
]

/**
 * The labels no widgeting may take, because something already answers to each beside it, in the
 * bag, in a column or in an export, grouped by what:
 *
 * * **a question's own**: its exposed fields, its rank and its viz flags (archived, secondary),
 *   its place, viz and stamps in a jsonball, the views of it, the questions themselves, its
 *   place in a recap (`number`), and the label an older export overrode it with (`forced_label`);
 * * **the bag's top level** (`QuizBagKeys`), but for `categories`, which the library's
 *   category-estimate widget is labelled, and so every widgeting of it;
 * * **a widgeted's keys**, so `qn.status` never sits beside `qn.foo.status`;
 * * **a column's fields**, so an export's columns and a bag never read alike;
 * * **a category-estimate widgeted's keys**: each persona's chance, the list and their average.
 */
export const ReservedWidgetingLabels: readonly string[] = _.uniq([
  ...Question.exposed, RankField, ArchivedField, SecondaryField, PositionField, VizField, ...StampFieldnames, ...QuestionViewVals, QuestionWidgetLabel, PlaceField, ForcedLabelField,
  ...QuizBagKeys.filter((key) => key !== 'categories'),
  ...WidgetedKeys,
  ...Object.keys(ColumnValidators.column.shape), ...ColumnStageFieldnames,
  ...WidgetingPartVals,
])

const Reserved = PA.reservedOf(ReservedWidgetingLabels, 'is a name a question, its cells or the bag already answer to: add to it, as my_label or label_2')

/**
 * Which level a widgeting runs at (its **tier**): `question`, once for each question, as every
 * widgeting has; or `quiz`, once for the quiz as a whole.
 */
export const WidgetingTierVals = ['question', 'quiz'] as const
export type WidgetingTier = typeof WidgetingTierVals[number]

/** The tier every widgeting runs at unless made to run once per quiz */
export const DefaultTier: WidgetingTier = 'question'

export const WidgetingValidators = Validator(({ obj, rec, oneof, label, labelshape, noteish, zod, uint, stamps, zid }) => {
  // Each field is named once, bare, then defaulted in the widgeting and made optional in its patch.
  const widgetingLabel = label.refine((val) => Reserved.rule(val), Reserved.msg)
    .describe('What the widgeting is called within its quiz, unique there and none of the names a question already answers to. Columns, the bag and exports name it by this.')
  const widget_label = label
    .describe('Which widget of the library it works, by label: labels are fixed once made, so exports round-trip with no id to translate.')
  const description = noteish
    .describe('What this widgeting is for in this quiz, in the author\'s words.')
  // A param is named by its widget's formulary, never by an author, so no word is reserved from it: an entry's `min`, say.
  const params = rec(labelshape, zod.json())
    .refine((val) => UU.jsonify(val).length <= PA.ParamsJson.max, PA.ParamsJson.msg)
    .describe('What it hands its widget beyond the bag, by name, held to its widget\'s formulary where a widgeting is written (`paramsOf`): an entry\'s constraints, say. Reaches the bag as `params`.')
  const tier = oneof(WidgetingTierVals)
    .describe('Which level it runs at: `question`, once for each question; or `quiz`, once for the quiz as a whole. Fixed once it is made, as the widget it works is.')

  const widgeting = obj({
    widget_label,
    label:       widgetingLabel,
    description: description.default(''),
    params:      params.default({}),
    tier:        tier.default(DefaultTier),
  })
    .describe('One widget put to work in one quiz, under a label of its own. A quiz keeps them in a list, which is their run order: each one\'s bag holds the widgeteds of those before it.')

  const widgetingPatch = obj({
    label:       widgetingLabel.optional(),
    description: description.optional(),
    params:      params.optional(),
  })
    .describe('The fields of one widgeting being revised. A key absent means "leave whatever is already there". The widget it works and its tier are not among them: a widgeting of another widget, or at another level, is another widgeting.')

  const row = obj({
    hunt_id:  zid('hunts')
      .describe('The hunt its quiz belongs to, copied from the quiz when the widgeting is made.'),
    quiz_id:  zid('quizzes')
      .describe('The quiz it belongs to.'),
    widget_label,
    label:    widgetingLabel,
    description,
    params,
    tier,
    position: uint.max(PA.WidgetingsPerQuiz.max)
      .describe('Its place in its quiz\'s run order, counting from zero.'),
    ...stamps,
  })
    .describe('One widgeting as the database holds it.')

  return { widgetingLabel, params, tier, widgeting, widgetingPatch, row }
})

export type WidgetingDNA   = Z.input<typeof WidgetingValidators.widgeting>
/**
 * One widget put to work in one quiz, under a label of its own: what the runner walks, in run
 * order. Each widgeting's bag holds the widgeteds of those before it.
 */
export type WidgetingT     = Z.output<typeof WidgetingValidators.widgeting>
export type WidgetingPatch = Z.output<typeof WidgetingValidators.widgetingPatch>
export type WidgetingRowT  = Z.output<typeof WidgetingValidators.row>

/** One widget put to work in one quiz */
export class Widgeting implements WidgetingT {
  declare widget_label: string
  declare label:        string
  declare description:  string
  declare params:       Record<string, Z.core.util.JSONType>
  declare tier:         WidgetingTier

  /** The fields a widgeting shows the outside world, whatever its formulary: what it came to, and whether it came to anything */
  static readonly exposed = ['status', 'value'] as const

  /**
   * Whether a widgeting of `widget` may run at `tier`. Every widget runs for each question; once for
   * the whole quiz, only a formula (`jsonata`) and an entry of a family that holds one value the
   * quiz can have (`EntryKindOncePerQuiz`: any but a question's category estimates). A model asked
   * from a cell has no cell to be asked from at the quiz's level.
   *
   * @example Widgeting.runsAt({ formulary: 'aibot', config: aibotConfig }, 'quiz')             // => false
   * @example Widgeting.runsAt({ formulary: 'entry', config: { entry_kind: 'text' } }, 'quiz')     // => true
   * @example Widgeting.runsAt({ formulary: 'entry', config: { entry_kind: 'boolean' } }, 'quiz')  // => true
   */
  static runsAt(widget: Pick<WidgetT, 'formulary' | 'config'>, tier: WidgetingTier): boolean {
    if (tier === 'question' || widget.formulary === 'jsonata') { return true }
    return widget.formulary === 'entry' && 'entry_kind' in widget.config && EntryKindOncePerQuiz[widget.config.entry_kind]
  }

  /**
   * Validated widgeting, with its description, params and tier defaulted.
   *
   * @param dna - The widget it works, and its label.
   * @returns A complete widgeting.
   * @throws When the label is taken by the questions themselves.
   *
   * @example Widgeting.fill({ widget_label: 'dumdum', label: 'dumdum' }).params  // => {}
   */
  static fill(dna: WidgetingDNA): WidgetingT {
    return WidgetingValidators.widgeting(dna)
  }

  /**
   * A widgeting of `widget`, labelled as the widget is, growing `_2`, `_3` while that label is
   * taken by a sibling or by the questions themselves.
   *
   * @param widget - The widget it puts to work.
   * @param taken - The labels the quiz's other widgetings already use.
   * @returns A widgeting ready to add to the quiz.
   *
   * @example Widgeting.forWidget({ label: 'notes' }, new Set()).label            // => 'notes_2'
   * @example Widgeting.forWidget({ label: 'dumdum' }, new Set(['dumdum'])).label  // => 'dumdum_2'
   */
  static forWidget(widget: Pick<WidgetT, 'label'>, taken: ReadonlySet<string>): WidgetingT {
    const label = Labelmaker.firstFree(widget.label, new Set([...taken, ...ReservedWidgetingLabels]))
    return this.fill({ widget_label: widget.label, label })
  }
}
