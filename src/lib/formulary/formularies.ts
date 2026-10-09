import type * as Z from 'zod'
import { AibotFormulary } from './aibot'
import { EntryFormulary } from './entry'
import { JsonataFormulary } from './jsonata'
import { LiquidizeFormulary } from './liquidize'
import type { QuizBag } from './runner'
import type { AibotWidgetT, EntryValueT, EntryWidgetT, Formularykind, WidgetT } from '../../models/widget'
import type { WidgetedRecordT, WidgetedT } from '../../models/widgeted'
import type { WidgetingT } from '../../models/widgeting'

/** How a formulary's widgeteds come to be: worked out on every render, or asked from the cell (or neither: typed) */
export type Refresh = 'live' | 'click'

/** How a formulary's widgeteds are kept: appended as history, or upserted as the one value */
export type Store = 'append' | 'upsert'

/**
 * What a widgeting's folded line holds, the few fields its panel shows while folded: an entry's
 * params, its widget's formula, or a `liquidize` widgeting's template. The full panel is the same
 * line with more rows beneath it.
 */
export type Folded = 'params' | 'formula' | 'template'

/**
 * What a widget's input formula came to over one bag: what the widget reads; nothing, meaning
 * "do not run"; or a failure. A failure that `stops` would fail the same way for every other
 * question, so the rest of its widgeting is not worked out again.
 */
export type InputOutcome =
  | { status: 'ok',      input: unknown }
  | { status: 'missing' }
  | { status: 'errored', message: string, stops: boolean }

/** What a `live` formulary's run comes to for one question */
export type LiveRun = {
  widgeted: WidgetedT
  /** The failure would recur for every question: stop working this widgeting out */
  stops:    boolean
}

/** What a `click` formulary's run comes to: what it was put, and the widgeted to record */
export type AskedT = {
  input:    Record<string, unknown>
  widgeted: WidgetedRecordT
}

/** What an advice prompt is told of the widgeting it is written for, when there is one */
export type AdviceSubject = Pick<WidgetingT, 'label' | 'description'> & {
  /** The header of the column showing it, when there is one */
  title?: string
}

/** What every formulary answers and reports, whatever its widgeteds are like */
type FormularyFacts = {
  readonly kind:         Formularykind
  /** The input formula a new widget of this formulary starts with; null when it reads nothing */
  readonly defaultInput: string | null
  /** How a widgeted comes to be; null for one that is typed */
  readonly refresh:      Refresh | null
  /** How a widgeted is kept; null for one never kept */
  readonly store:        Store | null
  /** What its widgeting's folded line holds; null for one with nothing to fold to */
  readonly folded:       Folded | null
  /** The validator for this formulary's `config` */
  readonly config:       Z.ZodType
  /** Whether the widget is well-formed: null when it is, else one sentence for the author */
  check:  (widget: WidgetT) => string | null
  /** What the widget reads: its input formula worked out over `bag` */
  input:  (widget: Pick<WidgetT, 'input_formula'>, bag: QuizBag) => InputOutcome
}

/** What a formulary with a formula answers besides: the help it offers in writing one, and the params its widgetings may hand on */
type FormulaFacts = {
  /** The validator for a widgeting's `params`: any few settings, for its formulas to read in the bag */
  paramsOf: () => Z.ZodType
  /** The meta-prompt an author copies out to get help writing this widget's formula */
  advice: (widget: WidgetT, widgeting: AdviceSubject | null, sample: QuizBag | null) => string
}

/** A formulary whose widgeteds are worked out on every render, and stored nowhere: a formula's, or a template's */
export type LiveFormulary = FormularyFacts & FormulaFacts & {
  readonly refresh: 'live'
  readonly store:   null
  /** How long one widgeting's whole column may take to work out, in milliseconds; null for no bound beyond each cell's own */
  readonly columnMs: number | null
  /** What it comes to for one question, worked out by `deadline` (a `Templating.clockNow()` reading) when it is given one */
  run: (widget: Pick<WidgetT, 'formula' | 'input_formula'>, widgeting: WidgetingT | null, bag: QuizBag, deadline?: number) => LiveRun
}

/** A formulary whose widgeteds are asked for from the cell, and appended to its history */
export type AskedFormulary = FormularyFacts & FormulaFacts & {
  readonly refresh: 'click'
  readonly store:   'append'
  run: (widget: AibotWidgetT, widgeting: WidgetingT, bag: QuizBag) => Promise<AskedT | null>
}

/**
 * A formulary whose widgeteds a person types, each cell's one value upserted: no formula, so no
 * run and no advice.
 */
export type TypedFormulary = FormularyFacts & {
  readonly refresh: null
  readonly store:   'upsert'
  /** The validator for a widgeting's `params`, given the widget it works: the one source a params editor is drawn from */
  paramsOf: (widget: Pick<EntryWidgetT, 'config'>) => Z.ZodObject
  /** The validator of what one of the widget's cells may hold, by the params in force for the widgeting working it */
  valueOf: (widget: Pick<EntryWidgetT, 'config'>, widgeting: Pick<WidgetingT, 'params'>) => Z.ZodType<EntryValueT>
}

/** One generic runner behind a widget: code, never a row */
export type Formulary = LiveFormulary | AskedFormulary | TypedFormulary

/** Every formulary, by the kind a widget names */
export const Formularies = {
  jsonata: JsonataFormulary,
  aibot:   AibotFormulary,
  entry:   EntryFormulary,
  liquidize: LiquidizeFormulary,
} as const satisfies Record<Formularykind, Formulary>

/**
 * The validator for the params of a widgeting of `widget`: an entry's family's, held together
 * with the widget's defaults; a `liquidize` widgeting's template; the open record of a formulary
 * whose widgets read params from the bag.
 *
 * @param widget - Any widget of the library.
 * @returns The validator.
 *
 * @example paramsOf(numberEntry).safeParse({ min: 'one' }).success  // => false
 * @example paramsOf(shoutWidget).safeParse({ loud: true }).success  // => true
 * @example paramsOf(blurbWidget).safeParse({ loud: true }).success  // => false
 */
export function paramsOf(widget: WidgetT): Z.ZodType<WidgetingT['params']> {
  // Every family's params are a few JSON settings by name, as a widgeting's row holds them.
  return (widget.formulary === 'entry' ? EntryFormulary.paramsOf(widget) : Formularies[widget.formulary].paramsOf()) as Z.ZodType<WidgetingT['params']>
}

/**
 * The formulary that works `widget`.
 *
 * @param widget - Any widget of the library.
 * @returns Its formulary.
 *
 * @example formularyFor({ formulary: 'jsonata' }).refresh  // => 'live'
 */
export function formularyFor(widget: Pick<WidgetT, 'formulary'>): Formulary {
  return Formularies[widget.formulary]
}
