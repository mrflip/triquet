import { botFor } from '../ask/bots'
import { SeededAsks, guessValueOf, textOf, type SeededAsk } from './aibot'
import { JsonataFormulary } from './jsonata'
import type { AskedT } from './formularies'
import type { QuizPlace, RunSource, RunStep } from './runner'
import { ModelTierVals } from '../../models/ask'
import { BottingWidget, type AibotWidgetT, type JsonataWidgetT, type WidgetT } from '../../models/widget'
import type { BotSlot, BottingRowDNA } from '../../models/botting'
import type { ExpressionT } from '../../models/expression'
import type { GuessT } from '../../models/guess'
import type { IshesT, IshItemT } from '../../models/ish'
import type { LastErrT } from '../../models/ask'
import type { QuizT } from '../../models/quiz'
import type { JsonT, StoredWidgetedT, WidgetedHistoryT } from '../../models/widgeted'
import type { WidgetingT } from '../../models/widgeting'

/*
 * Today's rows, read in the shapes the runner takes, until the widgets, widgetings and widgeteds
 * tables replace them: a hunt's expressions and the three hard-coded bots stand in for the
 * library, a quiz's widgets for its widgetings, and the bots' replies a question carries for its
 * stored widgeteds.
 */

/** What each seeded `aibot` widget's input formula is: the text it is put, trimmed, and nothing for a blank one */
const InputFor: Readonly<Record<SeededAsk['textkind'], string>> = {
  clueing: "$trim(qn.clueing) != '' ? { 'clueing': $trim(qn.clueing) }",
  hint:    "$trim(qn.hint) != '' ? { 'hint': $trim(qn.hint) }",
}

/**
 * The three `aibot` widgets the hard-coded bots stand in for, by label: each bot's prompt for one
 * of its texts, its tier, and the room it is given.
 *
 * @example BotWidgets.find((widget) => widget.label === 'numnum_hint')?.config.model_tier  // => 'careful'
 */
export const BotWidgets: readonly AibotWidgetT[] = Object.entries(SeededAsks).map(([label, seeded]) => {
  const bot = botFor(seeded.bot_label)
  return {
    formulary:     'aibot',
    label,
    title:         bot.title,
    description:   bot.blurb,
    formula:       bot.prompts[seeded.textkind] ?? '',
    input_formula: InputFor[seeded.textkind],
    config:        { servicelabel: bot.servicelabel, model_tier: bot.model_tier, max_tokens: bot.max_tokens },
  }
})

/**
 * An expression, as the `jsonata` widget it stands in for: its formula over the whole bag.
 *
 * @example expressionWidgetOf(Expression.fill({ label: 'shout', formula: '$uppercase(qn.title)' })).input_formula  // => '$'
 */
export function expressionWidgetOf(expression: Pick<ExpressionT, 'label' | 'formula' | 'description'>): JsonataWidgetT {
  return {
    formulary:     'jsonata',
    label:         expression.label,
    title:         '',
    description:   expression.description,
    formula:       expression.formula,
    input_formula: JsonataFormulary.defaultInput,
    config:        {},
  }
}

/**
 * What a quiz is run from, read from today's rows: its widgets as widgetings, in the order it
 * keeps them, each with the expression or bot it works; and the bots' replies its questions carry
 * as the stored widgeteds.
 *
 * @param quiz - The quiz, its questions carrying the bots' replies.
 * @param expressions - The hunt's expressions, which its expressings name.
 * @param place - Where it sits.
 * @returns The source for `runQuiz`.
 *
 * @example runQuiz(sourceOf(quiz, hunt.expressions, place))
 */
export function sourceOf(quiz: QuizT, expressions: readonly ExpressionT[], place: QuizPlace): RunSource {
  const widgetForLabel = new Map(expressions.map((expression) => [expression.label, expressionWidgetOf(expression)]))
  const fieldFor = new Map<string, BotSlot['field']>()
  const steps = quiz.widgets.map((widget): RunStep => {
    if (widget.kind === 'expressing') {
      return { widgeting: widgetingOf(widget, widget.expression_label), widget: widgetForLabel.get(widget.expression_label) ?? null }
    }
    const slot = BottingWidget.slotOf(widget)
    fieldFor.set(widget.label, slot.field)
    const botWidget = botWidgetFor(slot)
    return { widgeting: widgetingOf(widget, botWidget.label), widget: botWidget }
  })
  return {
    quiz,
    place,
    steps,
    storedOf: (widgeting, question) => {
      const field = fieldFor.get(widgeting.label)
      return field === undefined ? null : historyOf(question[field])
    },
  }
}

/**
 * What one seeded `aibot` widget's ask came to, as the botting to record: the cell it lands in,
 * the text it was put, and the reply or the failure.
 *
 * @param widget - The seeded widget asked.
 * @param question_id - The question it was asked about.
 * @param asked - What `AibotFormulary.run` handed back.
 * @returns The botting, ready to send.
 *
 * @example bottingOf(dumdum, question._id, asked).reply_text  // => 'Leon'
 */
export function bottingOf(widget: Pick<AibotWidgetT, 'label'>, question_id: string, asked: AskedT): BottingRowDNA {
  const seeded = SeededAsks[widget.label]
  if (! seeded) { throw new Error(`"${widget.label}" is not one of the seeded bots`) }
  const { widgeted } = asked
  const meta = widgeted.result_meta
  const blank: BottingRowDNA = {
    question_id,
    bot_label:          seeded.bot_label,
    textkind:           seeded.textkind,
    asked_text:         textOf(asked.input, seeded),
    status:             'done',
    reply_text:         null,
    items:              [],
    message:            null,
    response:           null,
    truncated:          meta.truncated === true,
    model_tier_applied: ModelTierVals.find((tier) => tier === meta.model_tier_applied) ?? null,
    approx_tokens:      typeof meta.approx_tokens === 'number' ? meta.approx_tokens : null,
  }
  if (widgeted.status === 'errored') { return { ...blank, status: 'error', message: widgeted.message, response: meta.response ?? null } }
  const value = (widgeted.value ?? {}) as { guess?: string, explanation?: string, items?: IshItemT[] }
  if (seeded.job === 'ishes') { return { ...blank, items: value.items ?? [] } }
  return { ...blank, reply_text: [value.guess ?? '', value.explanation ?? ''].filter((line) => line !== '').join('\n') }
}

/** The `aibot` widget a botting's (bot, textkind) pair stands in for */
function botWidgetFor(slot: Pick<BotSlot, 'bot_label' | 'textkind'>): AibotWidgetT {
  const widget = BotWidgets.find((each) => {
    const seeded = SeededAsks[each.label]
    return seeded?.bot_label === slot.bot_label && seeded.textkind === slot.textkind
  })
  if (! widget) { throw new Error(`${slot.bot_label} is not put a ${slot.textkind}`) }
  return widget
}

/** A quiz's widget as the widgeting it stands in for, working the widget labelled `widget_label` */
function widgetingOf(widget: WidgetT, widget_label: string): WidgetingT {
  return { label: widget.label, widget_label, description: widget.description, params: {} }
}

/** The stored history a question's reply field stands in for: its answer, and a failure since */
function historyOf(held: GuessT | IshesT): WidgetedHistoryT | null {
  if (held === null) { return null }
  const failed = held.last_err ? failedRow(held.last_err) : null
  if (held.status === 'error') { return { newest: failed ?? failedRow({ message: held.message, response: null, at: held.updated_at }), ok: null } }
  const answered: StoredWidgetedT = {
    status:        'ok',
    value:         'text' in held ? guessValueOf(held.text) : { items: held.items },
    message:       null,
    result_meta:   metaOf(held),
    _creationTime: held.updated_at,
  }
  return { newest: failed ?? answered, ok: answered }
}

/** A cell's `last_err`, as the failed row it stands in for */
function failedRow(err: LastErrT): StoredWidgetedT {
  return { status: 'errored', value: null, message: err.message, result_meta: { response: err.response }, _creationTime: err.at }
}

/** How an answer was come by, leaving out what was never said */
function metaOf(held: Exclude<GuessT | IshesT, null>): Record<string, JsonT> {
  if (held.status !== 'done') { return {} }
  return {
    truncated: held.truncated,
    ...(held.model_tier_applied !== undefined && { model_tier_applied: held.model_tier_applied }),
    ...(held.approx_tokens !== undefined && { approx_tokens: held.approx_tokens }),
  }
}
