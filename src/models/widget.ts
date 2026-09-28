import * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as Labelmaker from '../lib/labelmaker'
import { TextkindVals, type Textkind } from '../lib/ask/contract'
import { BotLabelVals, type BotLabel } from './bot-label'
import { BotSlots, type BotSlot } from './botting'
import type { ExpressionT } from './expression'

/** Whether the tool puts `bot_label` the question's `textkind` text */
function isBotSlot(bot_label: BotLabel, textkind: Textkind): boolean {
  return BotSlots.some((slot) => slot.bot_label === bot_label && slot.textkind === textkind)
}

/** The widget every quiz has without being told: the questions' own fields. No quiz may label one of its own this. */
export const QuestionWidgetLabel = 'question'

export const WidgetValidators = Validator(({ obj, oneof, lit, label, noteish, discrim, uint, zid }) => {
  const widgetLabel = label
    .describe('What the widget is called within its quiz, unique there and never `question`, which is the questions\' own widget. Columns name the widgets they show by this label.')
  const description = noteish
    .describe('What this widget is for in this quiz, in the author\'s words.')

  const expressing = obj({
    kind:             lit('expressing'),
    label:            widgetLabel,
    expression_label: label
      .describe('Which of the hunt\'s expressions works out this widget\'s value for every question.'),
    description:      description.default(''),
  })
    .describe('One expression put to work in one quiz: for every question, the value its formula comes to.')

  const botLabel = oneof(BotLabelVals)
    .describe('Which bot is put the quiz\'s questions.')
  const textkind = oneof(TextkindVals)
    .describe('Which of a question\'s texts the bot is shown.')

  const botting = obj({
    kind:          lit('botting'),
    label:         widgetLabel,
    bot_label:  botLabel,
    textkind,
    description:   description.default(''),
  })
    .check((context) => {
      const { bot_label, textkind: kindShown } = context.value
      if (! isBotSlot(bot_label, kindShown)) {
        context.issues.push({ code: 'custom', input: kindShown, path: ['textkind'], message: `${bot_label} is not put a ${kindShown} in this tool` })
      }
    })
    .describe('A connection from a quiz to a bot: what the bot answered for each question, shown for the text given. The answers are kept on the questions, so removing this only stops showing them.')

  const widget = discrim('kind', [expressing, botting])
    .describe('One of a quiz\'s widgets: something that has a value for every question, which a column can show. A quiz keeps them in a list, and the list is their order.')

  const expressingPatch = obj({
    label:            widgetLabel.optional(),
    expression_label: label.optional(),
    description:      description.optional(),
  })
    .describe('The fields of one expressing widget being revised. A key absent means "leave whatever is already there".')

  const bottingPatch = obj({
    label:        widgetLabel.optional(),
    bot_label: oneof(BotLabelVals).optional(),
    textkind:     oneof(TextkindVals).optional(),
    description:  description.optional(),
  })
    .describe('The fields of one botting widget being revised. A key absent means "leave whatever is already there".')

  const rowFields = {
    quiz_id:  zid('quizzes')
      .describe('The quiz this widget belongs to.'),
    position: uint
      .describe('The widget\'s place among its quiz\'s widgets, counting from zero.'),
  }
  const row = discrim('kind', [expressing.extend(rowFields), botting.extend(rowFields)])
    .describe('One widget as the database holds it: the fields of its own kind, and its place in its quiz.')

  return { widgetLabel, expressing, botting, widget, expressingPatch, bottingPatch, row }
})

export type ExpressingDNA   = Z.input<typeof WidgetValidators.expressing>
export type ExpressingT     = Z.output<typeof WidgetValidators.expressing>
export type BottingWidgetDNA = Z.input<typeof WidgetValidators.botting>
export type BottingWidgetT  = Z.output<typeof WidgetValidators.botting>
export type WidgetDNA       = Z.input<typeof WidgetValidators.widget>
export type WidgetT         = Z.output<typeof WidgetValidators.widget>
export type ExpressingPatch = Z.output<typeof WidgetValidators.expressingPatch>
export type BottingPatch    = Z.output<typeof WidgetValidators.bottingPatch>

/** One expression put to work in one quiz */
export class Expressing implements ExpressingT {
  declare kind:             'expressing'
  declare label:            string
  declare expression_label: string
  declare description:      string

  /** The fields a widget of this kind shows the outside world: the value it comes to */
  static readonly exposed = ['value'] as const

  /**
   * Validated expressing widget, with the description defaulted.
   *
   * @param dna - A label and the expression it works.
   * @returns A complete widget.
   *
   * @example Expressing.fill({ kind: 'expressing', label: 'letters', expression_label: 'answer_letter_count' })
   */
  static fill(dna: ExpressingDNA): ExpressingT {
    return WidgetValidators.expressing(dna)
  }

  /**
   * A widget working `expression`, labelled after it, under a label no sibling has.
   * A label already taken gains a short random suffix.
   *
   * @param expression - What the widget works out.
   * @param taken - The labels the quiz's other widgets already use.
   * @returns A widget ready to add to the quiz.
   *
   * @example Expressing.forExpression(expression, new Set(['clueing_full']))
   */
  static forExpression(expression: Pick<ExpressionT, 'label'>, taken: ReadonlySet<string>): ExpressingT {
    const label = taken.has(expression.label) ? Labelmaker.appendFallback(expression.label) : expression.label
    return this.fill({ kind: 'expressing', label, expression_label: expression.label })
  }
}

/** A connection from a quiz to a bot */
export class BottingWidget implements BottingWidgetT {
  declare kind:         'botting'
  declare label:        string
  declare bot_label: BotLabel
  declare textkind:     Textkind
  declare description:  string

  /**
   * Validated botting widget, with the description defaulted.
   *
   * @param dna - A label, a bot, and which text the bot is shown.
   * @returns A complete widget.
   * @throws When the tool does not put that bot that text.
   *
   * @example BottingWidget.fill({ kind: 'botting', label: 'dumdum', bot_label: 'dumdum', textkind: 'clueing' })
   */
  static fill(dna: BottingWidgetDNA): BottingWidgetT {
    return WidgetValidators.botting(dna)
  }

  /**
   * The cell of a question this widget shows: which of its played fields holds the answer.
   *
   * @param widget - A botting widget.
   * @returns The slot: `guess`, `clueing_ishes` or `hint_ishes`.
   *
   * @example BottingWidget.slotOf({ bot_label: 'numnum', textkind: 'hint' }).field  // => 'hint_ishes'
   */
  static slotOf(widget: Pick<BottingWidgetT, 'bot_label' | 'textkind'>): BotSlot {
    const slot = BotSlots.find((each) => each.bot_label === widget.bot_label && each.textkind === widget.textkind)
    if (! slot) { throw new Error(`${widget.bot_label} is not put a ${widget.textkind}`) }
    return slot
  }

  /**
   * The fields of a bot's answer the outside world sees: the answer itself, and whether it is
   * out of date. Not what it cost, which model made it, when, or how it failed.
   *
   * @param widget - A botting widget.
   * @returns Field names, alphabetical.
   *
   * @example BottingWidget.exposed({ bot_label: 'dumdum', textkind: 'clueing' })  // => ['status', 'text']
   */
  static exposed(widget: Pick<BottingWidgetT, 'bot_label' | 'textkind'>): readonly string[] {
    return this.slotOf(widget).field === 'guess' ? ['status', 'text'] : ['items', 'stale', 'status']
  }
}

/** The widgets of `widgets` that are expressings */
export function expressingsOf(widgets: readonly WidgetT[]): ExpressingT[] {
  return widgets.filter((widget): widget is ExpressingT => widget.kind === 'expressing')
}

/** The widgets of `widgets` that are bottings */
export function bottingsOf(widgets: readonly WidgetT[]): BottingWidgetT[] {
  return widgets.filter((widget): widget is BottingWidgetT => widget.kind === 'botting')
}
