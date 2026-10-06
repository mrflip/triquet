import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { PositionField } from '../lib/jsonball'
import * as Labelmaker from '../lib/labelmaker'
import { StampFieldnames } from '../lib/stamps'
import * as UU from '../lib/useful'
import * as PA from '../lib/vv/patterns'
import { QuestionViewVals, QuestionWidgetLabel } from './column'
import { Question, RankField, VizField } from './question'
import type { WidgetT } from './widget'

/**
 * The labels no widgeting may take, because a question already answers to each in the bag, in a
 * column's source or in an export: its exposed fields, its rank, its place, viz and stamps in a
 * jsonball, the views of it, and the questions themselves.
 */
export const ReservedWidgetingLabels: readonly string[] = [...Question.exposed, RankField, PositionField, VizField, ...StampFieldnames, ...QuestionViewVals, QuestionWidgetLabel]

const Reserved = PA.reservedOf(ReservedWidgetingLabels)

/**
 * Which level a widgeting runs at (its **tier**): `question`, once for each question, as every
 * widgeting has; or `quiz`, once for the quiz as a whole.
 */
export const WidgetingTierVals = ['question', 'quiz'] as const
export type WidgetingTier = typeof WidgetingTierVals[number]

/** The tier every widgeting runs at unless made to run once per quiz */
export const DefaultTier: WidgetingTier = 'question'

export const WidgetingValidators = Validator(({ obj, rec, oneof, label, noteish, zod, uint, stamps, zid }) => {
  // Each field is named once, bare, then defaulted in the widgeting and made optional in its patch.
  const widgetingLabel = label.regex(Reserved.re, Reserved.msg)
    .describe('What the widgeting is called within its quiz, unique there and none of the names a question already answers to. Columns, the bag and exports name it by this.')
  const widget_label = label
    .describe('Which widget of the library it works, by label: labels are fixed once made, so exports round-trip with no id to translate.')
  const description = noteish
    .describe('What this widgeting is for in this quiz, in the author\'s words.')
  const params = rec(label, zod.json())
    .refine((val) => UU.jsonify(val).length <= PA.ParamsJson.max, PA.ParamsJson.msg)
    .describe('What it hands its widget beyond the bag, by name; reaches the bag as `params`. Unused by every widget so far.')
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

  return { widgetingLabel, tier, widgeting, widgetingPatch, row }
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
