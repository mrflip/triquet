import type * as Z from 'zod'
import * as Formulas from '../formulas'
import * as Templating from '../templating'
import * as UU from '../useful'
import * as PA from '../vv/patterns'
import { JsonataFormulary } from './jsonata'
import { advicePrompt, type AdviceSpec } from './advice'
import { inputSchema } from '../../models/quiz-bag'
import { BagWordVals, QuestionViewVals, QuizRefPrefix, refOf } from '../../models/column'
import { Widgeted, type JsonT, type WidgetedT } from '../../models/widgeted'
import { LiquidizeDefaultInput, WidgetValidators, type LiquidizeParamsT, type WidgetT } from '../../models/widget'
import type { WidgetingT } from '../../models/widgeting'
import type { AdviceSubject, InputOutcome, LiveRun } from './formularies'
import type { QuizBag } from './runner'

/** Where a widgeting's template came from for one question: its text; nothing, so nothing to fill in; or a failure */
export type TemplateOutcome =
  | { status: 'ok',      template: string }
  | { status: 'missing' }
  | { status: 'errored', message: string, stops: boolean }

/** Where a `template_from` reads its template: a thing of the bag, and whether it is a widgeted, which is read only when `ok` */
type Picked = { thing: unknown, widgeted: boolean }

/**
 * How long one column of templates may take, all told: a quarter of a second. A 300-question
 * column of ordinary templates fills in well inside it (each takes a fraction of a millisecond),
 * and it is a quarter of the second Convex gives a mutation, which a sort runs the quiz in.
 */
const ColumnMs = 250

/**
 * The formulary of a Liquid template, filled in on every render and stored nowhere: a `jsonata`
 * widget's twin with the other engine. Its input formula comes to the object the template is
 * filled in over (the whole bag, `$`, by default), so `{{ qn.title }}` reads as a formula's
 * `qn.title` would. What it comes to is always text, markdown by convention.
 *
 * The template is the widget's `formula`, the admin's default; a widgeting may give one of its
 * own (`params.template`), or read one from the bag (`params.template_from`: a ref in a column's
 * grammar, and a formula over what it picks), so a template a bot wrote is filled in where the
 * widgeting stands in the run order. Every fill goes through `Templating.fill`, the one fill a
 * templateable source's text also takes, under its budgets and own-keys reading.
 *
 * Nothing here throws. A template that will not read costs its own cell, with Liquid's sentence.
 * One stopped by a limit (too long, too much) stops its column: every later question reads the
 * same failure, as a formula that will not stop does. A column has `columnMs` for all its fills.
 */
// A class of statics with no instances, as every formulary is.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class LiquidizeFormulary {
  static readonly kind = 'liquidize'
  /** The whole bag */
  static readonly defaultInput = LiquidizeDefaultInput
  static readonly refresh = 'live'
  static readonly store = null
  static readonly config = WidgetValidators.liquidizeConfig
  /** Its widgeting folds to its template line */
  static readonly folded = 'template'
  /**
   * How long one widgeting's whole column may take to fill in, all its questions told, in
   * milliseconds: a template filled for every question must not add up to a page that hangs, or
   * to a server sort past its mutation's time. A column past it is stopped where it stands.
   */
  static readonly columnMs = ColumnMs

  /**
   * The validator of a widgeting's params: a `template` of its own, or a `template_from` the bag,
   * never both; a template that reads as Liquid, and a formula that reads as JSONata, each said of
   * the param to change.
   *
   * @example LiquidizeFormulary.paramsOf().safeParse({ template: '{{ qn.title }}!' }).success      // => true
   * @example LiquidizeFormulary.paramsOf().safeParse({ template: '{% if qn.hint %}' }).success     // => false
   * @example LiquidizeFormulary.paramsOf().safeParse({ template_from: { ref: 'dumdum', formula: '$.value.template' } }).success  // => true
   */
  static paramsOf(): Z.ZodType<LiquidizeParamsT> {
    return WidgetValidators.liquidizeParams.check((context) => {
      const { template, template_from } = context.value
      const templateIssue = template === undefined ? null : Templating.issueOf(template)
      if (templateIssue !== null) { context.issues.push({ code: 'custom', path: ['template'], input: template, message: `does not read as Liquid: ${templateIssue}` }) }
      const formula = template_from?.formula
      const formulaIssue = formula === undefined ? null : Formulas.check(formula)
      if (formulaIssue !== null) { context.issues.push({ code: 'custom', path: ['template_from', 'formula'], input: formula, message: `does not read as JSONata: ${formulaIssue}` }) }
    })
  }

  /**
   * Whether the widget's template reads as Liquid and its input formula as JSONata: null when
   * they do, else a sentence naming the problem.
   *
   * @example LiquidizeFormulary.check({ formula: '{{ qn.title }}', input_formula: '$' })    // => null
   * @example LiquidizeFormulary.check({ formula: '{% if qn.hint %}', input_formula: '$' })  // => 'The template: tag {% if qn.hint %} not closed, line:1, col:1'
   */
  static check(widget: Pick<WidgetT, 'formula' | 'input_formula'>): string | null {
    const inputIssue = Formulas.check(widget.input_formula)
    if (inputIssue !== null) { return `The input formula: ${inputIssue}` }
    if (widget.formula.trim() === '') { return 'The template is empty' }
    const templateIssue = Templating.issueOf(widget.formula)
    return templateIssue === null ? null : `The template: ${templateIssue}`
  }

  /**
   * What the template is filled in over for the question `bag` is for: its input formula worked
   * out, which must come to an object, or to nothing. The bag itself (the default input, `$`) is
   * handed on as it is; anything else the formula made is plain JSON, so the template meets no
   * function.
   *
   * @param widget - Its input formula.
   * @param bag - The question's bag, as the widgeting sees it.
   * @returns What it came to.
   *
   * @example LiquidizeFormulary.input({ input_formula: '$' }, bag)                        // => { status: 'ok', input: bag }
   * @example LiquidizeFormulary.input({ input_formula: "{ 'title': qn.title }" }, bag)   // => { status: 'ok', input: { title: 'Leon' } }
   * @example LiquidizeFormulary.input({ input_formula: 'qn.title' }, bag).status         // => 'errored'
   */
  static input(widget: Pick<WidgetT, 'input_formula'>, bag: QuizBag): InputOutcome {
    const outcome = JsonataFormulary.input(widget, bag)
    if (outcome.status !== 'ok') { return outcome }
    // The bag is built from JSON alone, so only what a formula made needs making plain.
    const input = outcome.input === bag ? bag : Formulas.plainJson(outcome.input)
    if (! isObject(input)) { return { status: 'errored', message: 'The input formula has to come to an object, for the template to be filled in from', stops: false } }
    return { status: 'ok', input }
  }

  /**
   * Where a widgeting says its template comes from: its own `template`, a `template_from` the bag,
   * or neither, so its widget's. Params that do not fit (a widgeting written before they were held
   * to this formulary) say nothing.
   *
   * @example LiquidizeFormulary.ownOf({ params: { template: '{{ qn.hint }}' } })  // => { template: '{{ qn.hint }}' }
   * @example LiquidizeFormulary.ownOf({ params: { loud: true } })                // => {}
   * @example LiquidizeFormulary.ownOf(null)                                      // => {}
   */
  static ownOf(widgeting: Pick<WidgetingT, 'params'> | null): LiquidizeParamsT {
    const params = WidgetValidators.liquidizeParams.safeParse(widgeting?.params ?? {})
    return params.success ? params.data : {}
  }

  /**
   * The template a widgeting fills in for the question `bag` is for: its own (`params.template`),
   * or one read from the bag (`params.template_from`), or else its widget's. Read from the bag, it
   * is what the ref picks, worked by the formula as a column's is: with no formula, a field
   * itself or a widgeting's value; a widgeting that is `missing` or `errored` passes by, as it
   * would a column's formula. It must come to text.
   *
   * @param widget - Its template, the default.
   * @param widgeting - The widgeting working it, whose params may say otherwise; null for none.
   * @param bag - The question's bag, as the widgeting sees it.
   * @returns The template; nothing, when what it is read from holds nothing; or why there is none.
   *
   * @example LiquidizeFormulary.templateOf({ formula: '{{ qn.title }}' }, null, bag)  // => { status: 'ok', template: '{{ qn.title }}' }
   * @example LiquidizeFormulary.templateOf(widget, { ...widgeting, params: { template_from: { ref: 'notes' } } }, bag)  // => { status: 'ok', template: 'See {{ qn.hint }}' }
   * @example LiquidizeFormulary.templateOf(widget, { ...widgeting, params: { template_from: { ref: 'dumdum' } } }, bag)  // => { status: 'missing' }   (not yet asked)
   */
  static templateOf(widget: Pick<WidgetT, 'formula'>, widgeting: Pick<WidgetingT, 'params'> | null, bag: QuizBag): TemplateOutcome {
    const own = this.ownOf(widgeting)
    if (own.template !== undefined) { return { status: 'ok', template: own.template } }
    if (own.template_from === undefined) { return { status: 'ok', template: widget.formula } }
    const { ref, formula } = own.template_from
    const picked = pickedOf(ref, bag)
    const read = readOf(picked, formula, ref)
    if (read.widgeted.status === 'missing') { return { status: 'missing' } }
    if (read.widgeted.status === 'errored') { return { status: 'errored', message: read.widgeted.err.message, stops: read.stops } }
    const text = read.widgeted.value
    if (typeof text !== 'string') { return { status: 'errored', message: `The template read from «${ref}» comes to ${kindOf(text)}, not text`, stops: false } }
    return { status: 'ok', template: text }
  }

  /**
   * What the widget comes to for the question `bag` is for: its template filled in over its
   * input. Text is `ok`; a fill of nothing but blanks, an input of nothing, or a template read
   * from nothing, is `missing`; a template that will not read or fill, or an input that fails,
   * is `errored`, saying why. A fill stopped by a limit, its own or the column's `deadline`, stops
   * the rest of its column.
   *
   * @param widget - Its template and its input formula.
   * @param widgeting - The widgeting working it, whose params may give the template; null for none.
   * @param bag - The question's bag, as the widgeting sees it.
   * @param deadline - A `Templating.clockNow()` reading by which its column must be filled in; none but each fill's own limit when absent.
   * @returns The widgeted, and whether it should stop the rest of its column.
   *
   * @example LiquidizeFormulary.run({ formula: 'Q: {{ qn.title }}', input_formula: '$' }, null, bag).widgeted  // => { status: 'ok', value: 'Q: Leon', err: null }
   * @example LiquidizeFormulary.run({ formula: '{{ qn.hint }}', input_formula: '$' }, null, bag).widgeted     // => { status: 'missing', value: null, err: null }   (no hint)
   */
  static run(widget: Pick<WidgetT, 'formula' | 'input_formula'>, widgeting: Pick<WidgetingT, 'params'> | null, bag: QuizBag, deadline?: number): LiveRun {
    const input = this.input(widget, bag)
    if (input.status === 'missing') { return { widgeted: Widgeted.missing, stops: false } }
    if (input.status === 'errored') { return { widgeted: failed(input.message), stops: input.stops } }
    const template = this.templateOf(widget, widgeting, bag)
    if (template.status === 'missing') { return { widgeted: Widgeted.missing, stops: false } }
    if (template.status === 'errored') { return { widgeted: failed(template.message), stops: template.stops } }
    const filled = Templating.fill(template.template, input.input as Readonly<Record<string, unknown>>, deadline)
    if (filled.issue !== null) { return { widgeted: failed(`The template: ${filled.issue}`), stops: filled.failkind === 'limit' } }
    return { widgeted: filled.markdown.trim() === '' ? Widgeted.missing : Widgeted.ok(filled.markdown), stops: false }
  }

  /**
   * The prompt an author copies out to have a chatbot write, or revise, the widget's template.
   *
   * @param widget - The widget, however unfinished.
   * @param widgeting - The widgeting it is being written for, when there is one.
   * @param sample - One real question's bag, to make the schema concrete.
   * @returns Plain text, ready to copy.
   */
  static advice(widget: Pick<WidgetT, 'label' | 'description' | 'formula' | 'input_formula'>, widgeting: AdviceSubject | null, sample: QuizBag | null): string {
    return advicePrompt(adviceSpec(widget.input_formula, sample?.qn ?? null), widget, widgeting)
  }
}

/**
 * What `ref` picks from `bag`, found as a column's ref is: `quiz.<label>` in the quiz; the view
 * `butnot` worked out; anything the question holds; then a word at the bag's top level. A
 * widgeting the bag does not hold (placed after this one, or gone) is a widgeted of nothing.
 */
function pickedOf(ref: string, bag: QuizBag): Picked {
  if (ref.startsWith(QuizRefPrefix)) { return { thing: bag.quiz[ref.slice(QuizRefPrefix.length)], widgeted: true } }
  if ((QuestionViewVals as readonly string[]).includes(ref)) {
    const { chains_to } = bag.qn
    const target = chains_to === null ? undefined : bag.qns.find((qn) => qn.label === chains_to)
    return { thing: target?.hint ?? '', widgeted: false }
  }
  if (Object.hasOwn(bag.qn, ref)) {
    // A word a question holds of its own is a widgeting labelled so before the word was kept back.
    const { kind } = refOf(ref)
    return { thing: bag.qn[ref], widgeted: kind === 'widgeting' || kind === 'word' }
  }
  if ((BagWordVals as readonly string[]).includes(ref)) { return { thing: bag[ref as keyof QuizBag], widgeted: false } }
  return { thing: undefined, widgeted: true }
}

/**
 * What a template is read as from what was picked, as a column's formula reads its thing: a
 * widgeted only when `ok`, its value with no formula; anything else itself, or what the formula
 * worked out of it.
 */
function readOf({ thing, widgeted }: Picked, formula: string | undefined, ref: string): LiveRun {
  if (widgeted) {
    const held = (thing ?? Widgeted.missing) as WidgetedT
    if (held.status === 'missing') { return { widgeted: Widgeted.missing, stops: false } }
    if (held.status === 'errored') { return { widgeted: failed(`The template's source, «${ref}», failed: ${held.err.message}`), stops: false } }
    if (formula === undefined) { return { widgeted: itself(held.value), stops: false } }
  } else if (formula === undefined) {
    return { widgeted: itself(thing), stops: false }
  }
  const worked = JsonataFormulary.worked(formula, thing)
  return worked.widgeted.status === 'errored' ? { ...worked, widgeted: failed(`The template's formula: ${worked.widgeted.err.message}`) } : worked
}

/** What a thing read with no formula holds that is nothing */
const Absent: ReadonlySet<unknown> = new Set([undefined, null, ''])

/** A thing read with no formula: nothing for none or an empty string, else `ok`, whatever it is */
function itself(val: unknown): WidgetedT {
  return Absent.has(val) ? Widgeted.missing : Widgeted.ok(val as JsonT)
}

/** What a value read where a template was wanted is, in words */
function kindOf(val: unknown): string {
  if (Array.isArray(val)) { return 'a list' }
  if (typeof val === 'object') { return 'an object' }
  return `a ${typeof val}`
}

/** A failure worked out just now */
function failed(message: string): WidgetedT {
  return Widgeted.errored({ message, at: null, response: null })
}

/** Whether an input is an object a template can be filled in from */
function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && ! Array.isArray(val)
}

/** What a template's advice prompt says of templates, with one real question's `qn` when there is one */
function adviceSpec(input_formula: string, sample: Record<string, unknown> | null): AdviceSpec {
  const whole = input_formula.trim() === LiquidizeDefaultInput
  return {
    preamble:    'I use a small quiz-editing tool. In it, a column can be filled for every question of a quiz by a template written in Liquid (LiquidJS). The template is filled in once per question and comes to text, which the tool shows in that column as markdown. I would like your help with the template for one such column.',
    noun:        'template',
    reads:       readsSection(whole ? null : input_formula, sample),
    comesTo:     [
      '## What the template comes to',
      'Text, shown as markdown: `**bold**`, lists and links work. A template that comes to nothing but blanks is shown as a muted dash, meaning "nothing to say here". An image in what a formula or a bot worked out is shown as a link to it rather than drawn.',
    ].join('\n'),
    constraints: [
      `At most ${String(PA.Textish.max)} characters of template.`,
      'Nothing is HTML-escaped: `{{ qn.title }}` is enough.',
      'A key the input lacks fills in as nothing; an empty string, an empty list and nothing at all are false in `{% if %}`.',
      "A column worked out before this one fills in as its value's text: `{{ qn.my_column }}`. Its parts are read as `qn.my_column.value.part`.",
      'Besides Liquid\'s own filters, `quote` keeps a many-lined text inside a `> ` quote, `oneline` joins its lines, `apart` keeps a first line of `---` from making the line above a heading, and `in_order` puts `qns` in the order a recap reads them. A filter goes in an `{% assign %}`, never in a `{% for %}` tag.',
      'No `{% include %}` or `{% render %}`: there are no other templates.',
    ],
  }
}

/** What a template reads: the bag's schema and one real `qn`, or the object its input formula makes */
function readsSection(input_formula: string | null, sample: Record<string, unknown> | null): string {
  if (input_formula !== null) {
    return [
      '## What the template is filled in from',
      `The input is worked out by this JSONata expression over the quiz's data: \`${input_formula}\`. Each \`{{ name }}\` in the template is replaced by that key of the input.`,
    ].join('\n')
  }
  return [
    '## What the template reads',
    'The template is filled in from one JSON document, so its top-level keys are the names it can use directly, e.g. `{{ qn.clueing }}`. `qn` is the question the text is being filled in for and `qns` holds every question of the quiz, including `qn` and the archived ones (each says whether it is `archived`, and whether it is an alternate, `secondary`); `quiz`, `realm` and `hunt` are the quiz itself and where it sits, and `categories` the subject categories of its hunt. Every column worked out before this one sits on each question under its label, as `{ status, value, err }`. Nothing has an id: questions refer to each other by `label`. This is its JSON Schema:',
    '',
    '```json',
    UU.jsonify(inputSchema(), { pretty: true }),
    '```',
    ...(sample === null ? [] : ['', 'For example, `qn` for one real question is:', '', '```json', UU.jsonify(sample, { pretty: true }), '```']),
  ].join('\n')
}
