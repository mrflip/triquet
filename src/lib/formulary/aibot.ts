import * as UU from '../useful'
import * as PA from '../vv/patterns'
import * as Prompts from '../ask/prompts'
import * as Formulas from '../formulas'
import { askModel } from '../ask/port'
import { AskFailureNotices } from '../notices'
import { JsonataFormulary } from './jsonata'
import { advicePrompt, type AdviceSpec } from './advice'
import { AibotDefaultInput, WidgetValidators, type AibotWidgetT, type WidgetT } from '../../models/widget'
import type { AskDoneT, AskFailedT } from '../ask/contract'
import type { JsonT, WidgetedRecordT } from '../../models/widgeted'
import type { WidgetingT } from '../../models/widgeting'
import type { AdviceSubject, AskedT, InputOutcome } from './formularies'
import type { QuizBag } from './runner'

/** What a widget's prompt comes to for one question: the prompt to send, or why there is none */
export type RenderedPrompt =
  | { status: 'ok',      input: Record<string, JsonT>, prompt: string }
  | { status: 'missing' }
  /** `input` is what the prompt would have been rendered over: null when the input itself failed */
  | { status: 'errored', message: string, input: Record<string, JsonT> | null }

/**
 * The formulary of a prompt put to a model, asked from the cell and appended to its history:
 * what a bot was.
 *
 * Its input formula comes to the small object the prompt template is rendered over; an input of
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
   * Whether the widget can be asked: a prompt that reads as a template, and an input formula
   * that reads. Null when it can, else a sentence naming the problem.
   *
   * @example AibotFormulary.check({ formula: '', input_formula: '$', ... })  // => 'The prompt is empty'
   */
  static check(widget: Pick<WidgetT, 'formula' | 'input_formula'>): string | null {
    const inputIssue = JsonataFormulary.check({ formula: '$', input_formula: widget.input_formula })
    if (inputIssue !== null) { return inputIssue }
    if (widget.formula.trim() === '') { return 'The prompt is empty' }
    const templateIssue = Prompts.templateIssue(widget.formula)
    return templateIssue === null ? null : `The prompt: ${templateIssue}`
  }

  /**
   * What the prompt is rendered over for the question `bag` is for: its input formula worked out,
   * which must come to an object, or to nothing. The object is plain JSON.
   *
   * @param widget - Its input formula.
   * @param bag - The question's bag, as the widgeting sees it.
   * @returns What it came to.
   *
   * @example AibotFormulary.input({ input_formula: "{ 'clueing': qn.clueing }" }, bag)  // => { status: 'ok', input: { clueing: 'Who?' } }
   */
  static input(widget: Pick<WidgetT, 'input_formula'>, bag: QuizBag): InputOutcome {
    const outcome = JsonataFormulary.input(widget, bag)
    if (outcome.status !== 'ok') { return outcome }
    const input = Formulas.plainJson(outcome.input)
    if (! isObject(input)) { return { status: 'errored', message: 'The input formula has to come to an object, for the prompt to be filled in from', stops: false } }
    return { status: 'ok', input: input as JsonT }
  }

  /**
   * The prompt the widget puts to the model for the question `bag` is for: its template rendered
   * over its input. Nothing, for an input of nothing; a failure, for an input or a template that
   * fails, or a prompt too long to send.
   *
   * @param widget - Its prompt and its input formula.
   * @param bag - The question's bag, as the widgeting sees it.
   * @returns The prompt and what it was rendered over, or why there is none.
   *
   * @example AibotFormulary.prompt({ formula: 'Q: {{clueing}}', input_formula: "{ 'clueing': qn.clueing }" }, bag)  // => { status: 'ok', input: { clueing: 'Who?' }, prompt: 'Q: Who?' }
   */
  static prompt(widget: Pick<WidgetT, 'formula' | 'input_formula'>, bag: QuizBag): RenderedPrompt {
    const outcome = this.input(widget, bag)
    if (outcome.status === 'missing') { return outcome }
    if (outcome.status === 'errored') { return { status: 'errored', message: outcome.message, input: null } }
    const input = outcome.input as Record<string, JsonT>
    const templateIssue = Prompts.templateIssue(widget.formula)
    if (templateIssue !== null) { return { status: 'errored', message: `The prompt: ${templateIssue}`, input } }
    const prompt = Prompts.renderPrompt(widget.formula, input)
    if (prompt.length > PA.Promptish.max) {
      return { status: 'errored', message: `The prompt comes to ${String(prompt.length)} characters, more than the ${String(PA.Promptish.max)} a prompt may run to`, input }
    }
    return { status: 'ok', input, prompt }
  }

  /**
   * Put the widget's prompt to the model for the question `bag` is for, and hand back what to
   * record. Never throws: a failure comes back as an `errored` widgeted to record.
   *
   * @param widget - The widget.
   * @param widgeting - The widgeting working it.
   * @param bag - The question's bag, as the widgeting sees it.
   * @returns What it was put and what came of it; null when its input came to nothing, or failed, and so nothing was asked. A prompt that cannot be sent is recorded as a failure, asking nothing.
   *
   * @example await AibotFormulary.run(dumdum, widgeting, bag)  // => { input: { clueing: 'Who?' }, widgeted: { status: 'ok', value: { guess: 'Leon', explanation: '...' }, ... } }
   */
  static async run(widget: AibotWidgetT, widgeting: WidgetingT, bag: QuizBag): Promise<AskedT | null> {
    const rendered = this.prompt(widget, bag)
    if (rendered.status === 'missing' || (rendered.status === 'errored' && rendered.input === null)) { return null }
    if (rendered.status === 'errored') { return { input: rendered.input ?? {}, widgeted: unaskedRecord(rendered.message) } }
    const reply = await askModel({ prompt: rendered.prompt, ...widget.config })
    return { input: rendered.input, widgeted: reply.ok ? answeredRecord(reply) : failedRecord(reply) }
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
    return advicePrompt(adviceSpec(widget.input_formula, input, widgeting), widget, widgeting)
  }
}

/** An answer, as the widgeted to record: the object the model answered with, and how it ran */
function answeredRecord(reply: AskDoneT): WidgetedRecordT {
  const result_meta = { model_tier_applied: reply.model_tier_applied, approx_tokens: reply.approx_tokens, truncated: reply.truncated }
  return { status: 'ok', value: reply.value, message: null, result_meta }
}

/** A failed ask, as the widgeted to record: the author's sentence, and the reply as it came back */
function failedRecord(failed: AskFailedT): WidgetedRecordT {
  return { status: 'errored', value: null, message: AskFailureNotices[failed.failurekind], result_meta: { response: failed } }
}

/** A prompt that could not be sent, as the widgeted to record: why, in the author's words */
function unaskedRecord(message: string): WidgetedRecordT {
  return { status: 'errored', value: null, message, result_meta: {} }
}

/** Whether an input is an object a prompt can be filled in from */
function isObject(val: unknown): boolean {
  return typeof val === 'object' && val !== null && ! Array.isArray(val)
}

/** What a prompt's advice prompt says of prompts */
function adviceSpec(input_formula: string, input: InputOutcome | null, widgeting: AdviceSubject | null): AdviceSpec {
  const label = widgeting?.label ?? '<label>'
  return {
    preamble: 'I use a small quiz-editing tool. In it, a column can be filled for every question of a quiz by putting a prompt to a language model, one question at a time. The prompt is a mustache template, filled in for each question from a small JSON object, its input. The model is asked for a JSON object, which the tool keeps as the cell\'s value. I would like your help with the prompt for one such column.',
    noun:     'prompt',
    reads:    [
      '## What the prompt is filled in from',
      `The input is worked out by this JSONata expression: \`${input_formula}\`. Each \`{{name}}\` in the prompt is replaced by that key of the input: a string as it is, anything else as its JSON. \`{{#items}}...{{/items}}\` repeats its body for each item of a list, reading the item's own keys inside it.`,
      ...(input?.status === 'ok' ? ['', 'For one real question it comes to:', '', '```json', UU.jsonify(input.input, { pretty: true }), '```'] : []),
    ].join('\n'),
    comesTo: [
      '## What the answer should be',
      'The tool asks the model for a single JSON object, and keeps whatever object comes back. Nothing checks its keys or their values, so the prompt itself has to say in words which object it wants: each key, and what it holds, as in `{"guess": string, "explanation": string}`, ideally at the end of the prompt.',
      `A column worked out after this one reads the object as \`qn.${label}.value\`, so keys that are plain words read best.`,
    ].join('\n'),
    constraints: [
      `At most ${String(PA.Textish.max)} characters of template, and at most ${String(PA.Promptish.max)} once filled in.`,
      'Nothing in the template is HTML-escaped: `{{name}}` is enough.',
      'A key the input lacks fills in as nothing, so name only what the input holds.',
    ],
  }
}
