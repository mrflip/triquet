import * as Formulas from '../formulas'
import * as UU from '../useful'
import { advicePrompt, type AdviceSpec } from './advice'
import { inputSchema, outputSchema } from '../../models/quiz-bag'
import { Widgeted, type JsonT, type WidgetedT } from '../../models/widgeted'
import { JsonataDefaultInput, WidgetValidators, type WidgetT } from '../../models/widget'
import { WidgetingValidators, type WidgetingT } from '../../models/widgeting'
import type { AdviceSubject, InputOutcome, LiveRun } from './formularies'
import type { QuizBag } from './runner'

/** What a formula can come to that a cell shows as nothing */
const Absent: ReadonlySet<unknown> = new Set([undefined, null, ''])

/**
 * The formulary of a JSONata formula, worked out over its input on every render and stored
 * nowhere: what an expression was.
 *
 * Nothing here throws. A formula that fails costs its own cell; one that will not stop is
 * stopped, and says so (`stops`), so its widgeting's other questions read the same failure
 * rather than waiting on it again.
 */
// A class of statics with no instances, as every formulary is.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class JsonataFormulary {
  static readonly kind = 'jsonata'
  /** The whole bag */
  static readonly defaultInput = JsonataDefaultInput
  static readonly refresh = 'live'
  static readonly store = null
  /** Its widgeting folds to the widget's formula, one line */
  static readonly folded = 'formula'
  static readonly config = WidgetValidators.jsonataConfig
  /** No bound on a whole column: each formula has its own timebox (`Formulas.TimeboxMs`) */
  static readonly columnMs = null

  /**
   * The validator of a widgeting's params: any few settings, by name, which reach the bag as
   * `params` for the formula to read.
   *
   * @example JsonataFormulary.paramsOf().safeParse({ size: 3 }).success  // => true
   */
  static paramsOf(): typeof WidgetingValidators.params {
    return WidgetingValidators.params
  }

  /**
   * Whether the widget's formula and input formula both read: null when they do, else a
   * sentence naming the problem.
   *
   * @example JsonataFormulary.check({ formula: '$sum(', input_formula: '$', ... })  // => a sentence naming the problem
   */
  static check(widget: Pick<WidgetT, 'formula' | 'input_formula'>): string | null {
    const inputIssue = Formulas.check(widget.input_formula)
    if (inputIssue !== null) { return `The input formula: ${inputIssue}` }
    return Formulas.check(widget.formula)
  }

  /**
   * What a widget reads: its input formula worked out over `bag`. JSONata's `undefined` is
   * nothing, which means "do not run". Every formulary's input formula is JSONata, so every
   * formulary reads its input through this.
   *
   * @param widget - Its input formula.
   * @param bag - The question's bag, as the widgeting sees it.
   * @returns What it came to.
   *
   * @example JsonataFormulary.input({ input_formula: 'qn.title' }, bag)  // => { status: 'ok', input: 'Leon' }
   */
  static input(widget: Pick<WidgetT, 'input_formula'>, bag: QuizBag): InputOutcome {
    const outcome = Formulas.evaluate(widget.input_formula, bag)
    if (! outcome.ok) { return { status: 'errored', message: `The input formula: ${outcome.message}`, stops: outcome.failkind === 'timeout' } }
    return outcome.val === undefined ? { status: 'missing' } : { status: 'ok', input: outcome.val }
  }

  /**
   * What the widget comes to for the question `bag` is for: its formula worked out over its
   * input. A value is `ok`; a failure, or a function, is `errored`; nothing at all (JSONata
   * `undefined`, null or an empty string), or an input of nothing, is `missing`.
   *
   * @param widget - Its formula and its input formula.
   * @param widgeting - The widgeting working it, whose params the bag already holds.
   * @param bag - The question's bag, as the widgeting sees it.
   * @returns The widgeted, and whether it should stop the rest of its column.
   *
   * @example JsonataFormulary.run({ formula: '6 * 7', input_formula: '$' }, null, bag).widgeted  // => { status: 'ok', value: 42, err: null }
   */
  static run(widget: Pick<WidgetT, 'formula' | 'input_formula'>, widgeting: WidgetingT | null, bag: QuizBag): LiveRun {
    const input = this.input(widget, bag)
    if (input.status === 'missing') { return { widgeted: Widgeted.missing, stops: false } }
    if (input.status === 'errored') { return { widgeted: failed(input.message), stops: input.stops } }
    return this.worked(widget.formula, input.input)
  }

  /**
   * What `formula` comes to over `input`, read as a widgeted: a value is `ok`; a failure, or a
   * function, is `errored`; nothing at all (JSONata `undefined`, null or an empty string) is
   * `missing`. How a widget's formula reads, and a column's.
   *
   * @param formula - JSONata.
   * @param input - What it reads.
   * @returns The widgeted, and whether the formula would not stop, so the rest of its column should read the same failure rather than wait on it again.
   *
   * @example JsonataFormulary.worked('$.masie', { status: 'ok', value: [], err: null, masie: 0.5 }).widgeted  // => { status: 'ok', value: 0.5, err: null }
   */
  static worked(formula: string, input: unknown): LiveRun {
    const outcome = Formulas.evaluate(formula, input)
    if (! outcome.ok) { return { widgeted: failed(outcome.message), stops: outcome.failkind === 'timeout' } }
    return { widgeted: reading(outcome.val), stops: false }
  }

  /**
   * The prompt an author copies out to have a chatbot write, or revise, the widget's formula.
   *
   * @param widget - The widget, however unfinished.
   * @param widgeting - The widgeting it is being written for, when there is one.
   * @param sample - One real question's bag, to make the schema concrete.
   * @returns Plain text, ready to copy.
   */
  static advice(widget: Pick<WidgetT, 'label' | 'description' | 'formula'>, widgeting: AdviceSubject | null, sample: QuizBag | null): string {
    return advicePrompt(adviceSpec(sample?.qn ?? null), widget, widgeting)
  }
}

/** What a formula's advice prompt says of formulas, with one real question's `qn` when there is one */
function adviceSpec(sample: Record<string, unknown> | null): AdviceSpec {
  return {
    preamble:    'I use a small quiz-editing tool. In it, a column can be computed for every question of a quiz by a formula written in JSONata (the JavaScript reference implementation, version 1.8 -- synchronous, no async). The formula is run once per question and comes to one value, which the tool shows in that column. I would like your help with the formula for one such column.',
    noun:        'formula',
    reads:       readsSection(sample),
    comesTo:     comesToSection(),
    constraints: [
      `At most ${String(Formulas.FormulaMax)} characters. Newlines are welcome, for laying a formula out to be read.`,
      'Inside a predicate such as `qns[label = ...]` the context is each item, so reach the question being worked out with `$$.qn`.',
      "JSONata's `$round` rounds halves to even; use `$floor(x + 0.5)` if halves should go up.",
      'Prefer plain, readable JSONata over cleverness.',
    ],
  }
}

/** What a formula reads: the bag's schema, and one real `qn` when there is one */
function readsSection(sample: Record<string, unknown> | null): string {
  return [
    '## What the formula reads',
    'The formula is evaluated against one JSON document, so its top-level keys are the names it can use directly, e.g. `qn.clueing`. `qn` is the question the value is being worked out for and `qns` holds every question of the quiz, including `qn` and the archived ones (each says whether it is `archived`, and whether it is an alternate, `secondary`); `quiz`, `realm` and `hunt` are the quiz itself and where it sits, and `categories` the subject categories of its hunt. Every column worked out before this one sits on each question under its label, as `{ status, value, err }`: read its `value` only when its `status` is `ok`, as in `qn.numnum_clueing.value.items`. Nothing has an id: questions refer to each other by `label`. This is its JSON Schema:',
    '',
    '```json',
    UU.jsonify(inputSchema(), { pretty: true }),
    '```',
    ...(sample === null ? [] : ['', 'For example, `qn` for one real question is:', '', '```json', UU.jsonify(sample, { pretty: true }), '```']),
  ].join('\n')
}

/** What a formula may come to */
function comesToSection(): string {
  return [
    '## What the formula returns',
    'One value per question, matching this JSON Schema. Returning nothing (JSONata `undefined`), `null` or an empty string means "nothing to say here" and is shown as a muted dash; that is different from zero.',
    '',
    '```json',
    UU.jsonify(outputSchema(), { pretty: true }),
    '```',
  ].join('\n')
}

/** A failure worked out just now */
function failed(message: string): WidgetedT {
  return Widgeted.errored({ message, at: null, response: null })
}

/** What a formula's value shows in a cell */
function reading(val: unknown): WidgetedT {
  if (Formulas.isFunction(val)) { return failed('The formula came to a function rather than a value') }
  return valued(val)
}

/** A value as a widgeted holds it: plain JSON, and nothing for nothing */
function valued(val: unknown): WidgetedT {
  if (Absent.has(val)) { return Widgeted.missing }
  if (typeof val !== 'object') { return Widgeted.ok(val as JsonT) }
  // JSONata's objects have no prototype and its lists carry markers of their own: hand on plain JSON.
  return Widgeted.ok(JSON.parse(UU.jsonify(val)) as JsonT)
}
