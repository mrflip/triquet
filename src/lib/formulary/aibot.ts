import * as UU from '../useful'
import * as Errs from '../ask/errs'
import { askModel } from '../ask/port'
import { AskFailureNotices } from '../notices'
import { JsonataFormulary } from './jsonata'
import { AibotDefaultInput, WidgetValidators, type WidgetT } from '../../models/widget'
import type { AskFailedT, AskRequestDNA, GuessReplyT, IshesReplyT, Textkind } from '../ask/contract'
import type { JsonT, WidgetedRecordT } from '../../models/widgeted'
import type { WidgetingT } from '../../models/widgeting'
import type { AdviceSubject, AskedT, InputOutcome } from './formularies'
import type { QuizBag } from './runner'

/** Which of the ask route's fixed asks one seeded `aibot` widget is put as, until the route takes a rendered prompt */
export type SeededAsk = {
  job:      'guess' | 'ishes'
  /** Which of the question's texts it is put, and so which key of its input holds it */
  textkind: Textkind
}

/**
 * The three seeded `aibot` widgets, by label, and the fixed ask each is put as: a temporary
 * mapping, while the ask route still takes fixed asks rather than a rendered prompt. Any other
 * `aibot` widget cannot be asked yet.
 */
export const SeededAsks: Readonly<Record<string, SeededAsk>> = {
  dumdum:         { job: 'guess', textkind: 'clueing' },
  numnum_clueing: { job: 'ishes', textkind: 'clueing' },
  numnum_hint:    { job: 'ishes', textkind: 'hint' },
}

/**
 * The formulary of a prompt put to a model, asked from the cell and appended to its history:
 * what a bot was.
 *
 * Its input formula comes to the small object the prompt is filled in from; an input of
 * nothing is not asked about. It is never run on render: the runner reads what was recorded.
 */
// A class of statics with no instances, as every formulary is.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AibotFormulary {
  static readonly kind = 'aibot'
  static readonly defaultInput = AibotDefaultInput
  static readonly refresh = 'click'
  static readonly store = 'append'
  static readonly config = WidgetValidators.aibotConfig

  /**
   * Whether the widget can be asked: a prompt, and an input formula that reads. Null when it
   * can, else a sentence naming the problem.
   *
   * @example AibotFormulary.check({ formula: '', input_formula: '$', ... })  // => 'The prompt is empty'
   */
  static check(widget: Pick<WidgetT, 'formula' | 'input_formula'>): string | null {
    const inputIssue = JsonataFormulary.check({ formula: '$', input_formula: widget.input_formula })
    if (inputIssue !== null) { return inputIssue }
    return widget.formula.trim() === '' ? 'The prompt is empty' : null
  }

  /**
   * What the prompt is filled in from for the question `bag` is for: its input formula worked
   * out, which must come to an object, or to nothing.
   *
   * @param widget - Its input formula.
   * @param bag - The question's bag, as the widgeting sees it.
   * @returns What it came to.
   *
   * @example AibotFormulary.input({ input_formula: "{ 'clueing': qn.clueing }" }, bag)  // => { status: 'ok', input: { clueing: 'Who?' } }
   */
  static input(widget: Pick<WidgetT, 'input_formula'>, bag: QuizBag): InputOutcome {
    const outcome = JsonataFormulary.input(widget, bag)
    if (outcome.status !== 'ok' || isObject(outcome.input)) { return outcome }
    return { status: 'errored', message: 'The input formula has to come to an object, for the prompt to be filled in from', stops: false }
  }

  /**
   * Put the widget's prompt to the model for the question `bag` is for, and hand back what to
   * record. Never throws: a failure comes back as an `errored` widgeted to record.
   *
   * The seeded widgets are put as the ask route's fixed asks (`SeededAsks`), with the text their
   * input holds; the route fills in the prompt.
   *
   * @param widget - The widget.
   * @param widgeting - The widgeting working it.
   * @param bag - The question's bag, as the widgeting sees it.
   * @returns What it was put and what came of it; null when its input came to nothing, or failed, and so nothing was asked.
   *
   * @example await AibotFormulary.run(dumdum, widgeting, bag)  // => { input: { clueing: 'Who?' }, widgeted: { status: 'ok', value: { guess: 'Leon', explanation: '' }, ... } }
   */
  static async run(widget: WidgetT, widgeting: WidgetingT, bag: QuizBag): Promise<AskedT | null> {
    const outcome = this.input(widget, bag)
    if (outcome.status !== 'ok') { return null }
    const input = outcome.input as Record<string, unknown>
    const seeded = SeededAsks[widget.label]
    if (! seeded) { return { input, widgeted: failedRecord({ ok: false, failurekind: 'unavailable' }) } }
    const reply = await askModel(requestFor(seeded, input))
    const failed = Errs.failureOf(reply, seeded.job)
    if (failed !== null || ! reply.ok) { return { input, widgeted: failedRecord(failed ?? { ok: false, failurekind: 'unreadable' }) } }
    return { input, widgeted: answeredRecord(reply) }
  }

  /**
   * The prompt an author copies out to have a chatbot write, or revise, the widget's prompt.
   *
   * @param widget - The widget, however unfinished.
   * @param widgeting - The widgeting it is being written for, when there is one.
   * @param sample - One real question's bag, to show what the prompt is filled in from.
   * @returns Plain text, ready to copy.
   */
  static advice(widget: WidgetT, widgeting: AdviceSubject | null, sample: QuizBag | null): string {
    const input = sample === null ? null : this.input(widget, sample)
    return [
      AdvicePreamble,
      ['## What I am after', ...aboutLines(widget, widgeting)].join('\n'),
      promptSection(widget.formula),
      inputSection(widget.input_formula, input),
      AdviceReply,
    ].join('\n\n')
  }
}

/**
 * Dumdum's reply as its value: the guess on the first line, the explanation after it, each
 * trimmed.
 *
 * @param text - The reply as it came back.
 *
 * @example guessValueOf('Leon\nThe lion of the name.')  // => { guess: 'Leon', explanation: 'The lion of the name.' }
 * @example guessValueOf('Leon')                       // => { guess: 'Leon', explanation: '' }
 */
export function guessValueOf(text: string): { guess: string, explanation: string } {
  const breakIdx = text.indexOf('\n')
  if (breakIdx === -1) { return { guess: text.trim(), explanation: '' } }
  return { guess: text.slice(0, breakIdx).trim(), explanation: text.slice(breakIdx + 1).trim() }
}

/** The fixed ask a seeded widget is put as, with the text its input holds */
function requestFor(seeded: SeededAsk, input: Record<string, unknown>): AskRequestDNA {
  const text = textOf(input, seeded)
  return seeded.job === 'guess' ? { job: 'guess', clueing: text } : { job: 'ishes', textkind: seeded.textkind, text }
}

/**
 * The text an input holds for a seeded ask: the value under its textkind, or nothing.
 *
 * @example textOf({ clueing: 'Who?' }, SeededAsks.dumdum)  // => 'Who?'
 */
export function textOf(input: Record<string, unknown>, seeded: Pick<SeededAsk, 'textkind'>): string {
  const text = input[seeded.textkind]
  return typeof text === 'string' ? text : ''
}

/** An answer, as the widgeted to record: dumdum's as its guess and explanation (its reply verbatim in `result_meta`), numnum's as its spans */
function answeredRecord(reply: GuessReplyT | IshesReplyT): WidgetedRecordT {
  const value: JsonT = reply.job === 'guess' ? guessValueOf(reply.text) : { items: reply.items }
  const result_meta = {
    model_tier_applied: reply.model_tier_applied, approx_tokens: reply.approx_tokens, truncated: reply.truncated,
    ...(reply.job === 'guess' && { reply_text: reply.text }),
  }
  return { status: 'ok', value, message: null, result_meta }
}

/** A failed ask, as the widgeted to record: the author's sentence, and the reply as it came back */
function failedRecord(failed: AskFailedT): WidgetedRecordT {
  return { status: 'errored', value: null, message: AskFailureNotices[failed.failurekind], result_meta: { response: failed } }
}

/** Whether an input is an object a prompt can be filled in from */
function isObject(val: unknown): boolean {
  return typeof val === 'object' && val !== null && ! Array.isArray(val)
}

const AdvicePreamble = `I use a small quiz-editing tool. In it, a column can be filled for every question of a quiz by putting a prompt to a language model, one question at a time. The prompt is a template: each \`{{name}}\` in it is replaced by that key of a small JSON object, its input, worked out for the question. The model is asked for a JSON object, which the tool keeps as the cell's value. I would like your help with the prompt for one such column.`

const AdviceReply = `## How to reply
Ask me anything you need to first. Once we have settled it, send the prompt alone: no code fence, no explanation before or after, so I can paste it straight into the prompt box. It should say in words what JSON object it wants back.`

/** The widget and widgeting, in the author's own words, leaving out whatever is blank */
function aboutLines(widget: WidgetT, widgeting: AdviceSubject | null): string[] {
  const facts = [
    ['The column\'s title',                widgeting?.title],
    ['The widgeting\'s label',             widgeting?.label],
    ['What the widgeting is for here',     widgeting?.description],
    ['The widget\'s label',                widget.label],
    ['What the widget works out',          widget.description],
  ]
    .map(([title, text]) => [title, (text ?? '').trim()])
    .filter(([, text]) => text !== '')
    .map(([title, text]) => `- ${String(title)}: ${String(text)}`)
  return facts.length === 0 ? ['I have not written anything down about it yet; I will describe it as we go.'] : facts
}

/** The current prompt, offered neutrally, or the request for one */
function promptSection(formula: string): string {
  if (formula.trim() === '') { return ['## The prompt', 'There is no prompt yet. Please write one.'].join('\n') }
  return ['## The prompt', 'Here is what we have now: a starting point, something half-done, or something to revise or replace.', '', '```', formula, '```'].join('\n')
}

/** What the prompt is filled in from, and one real input when there is one */
function inputSection(input_formula: string, input: InputOutcome | null): string {
  return [
    '## What the prompt is filled in from',
    `The input is worked out by this JSONata expression: \`${input_formula}\`.`,
    ...(input?.status === 'ok' ? ['', 'For one real question it comes to:', '', '```json', UU.jsonify(input.input, { pretty: true }), '```'] : []),
  ].join('\n')
}
