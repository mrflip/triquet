import * as Formulas from '../formulas'
import * as UU from '../useful'
import { formulaPrompt } from '../formula-prompt'
import { Widgeted, type JsonT, type WidgetedT } from '../../models/widgeted'
import { JsonataDefaultInput, WidgetValidators, type WidgetT } from '../../models/widget'
import type { WidgetingT } from '../../models/widgeting'
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
  static readonly config = WidgetValidators.jsonataConfig

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
    const outcome = Formulas.evaluate(widget.formula, input.input)
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
    return formulaPrompt({ widgeting, widget, sample: sample?.qn ?? null })
  }
}

/** A failure worked out just now */
function failed(message: string): WidgetedT {
  return Widgeted.errored({ message, at: null, response: null })
}

/** What a formula's value shows in a cell */
function reading(val: unknown): WidgetedT {
  if (isFunction(val)) { return failed('The formula came to a function rather than a value') }
  return valued(val)
}

/** Whether a formula came to a function: JSONata hands one back as a marked object, or as a plain function */
function isFunction(val: unknown): boolean {
  if (typeof val === 'function') { return true }
  return typeof val === 'object' && val !== null && '_jsonata_function' in val
}

/** A value as a widgeted holds it: plain JSON, and nothing for nothing */
function valued(val: unknown): WidgetedT {
  if (Absent.has(val)) { return Widgeted.missing }
  if (typeof val !== 'object') { return Widgeted.ok(val as JsonT) }
  // JSONata's objects have no prototype and its lists carry markers of their own: hand on plain JSON.
  return Widgeted.ok(JSON.parse(UU.jsonify(val)) as JsonT)
}
