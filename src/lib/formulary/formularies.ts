import type * as Z from 'zod'
import { AibotFormulary } from './aibot'
import { JsonataFormulary } from './jsonata'
import type { QuizBag } from './runner'
import type { Formularykind, LibraryWidgetT } from '../../models/widget'
import type { WidgetedRecordT, WidgetedT } from '../../models/widgeted'
import type { WidgetingT } from '../../models/widgeting'

/** How a formulary's widgeteds come to be: worked out on every render, or asked from the cell */
export type Refresh = 'live' | 'click'

/** How a formulary's widgeteds are kept: appended as history, or upserted as the one value */
export type Store = 'append' | 'upsert'

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
  /** The formula marked its value out of date (the `{ value, stale }` form, retiring) */
  stale:    boolean
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

/** What every formulary answers and reports, whatever its run is like */
type FormularyFacts = {
  readonly kind:         Formularykind
  /** The input formula a new widget of this formulary starts with; null when it reads nothing */
  readonly defaultInput: string | null
  /** How a widgeted comes to be; null for one that is typed */
  readonly refresh:      Refresh | null
  /** How a widgeted is kept; null for one never kept */
  readonly store:        Store | null
  /** The validator for this formulary's `config` */
  readonly config:       Z.ZodType
  /** Whether the widget is well-formed: null when it is, else one sentence for the author */
  check:  (widget: LibraryWidgetT) => string | null
  /** What the widget reads: its input formula worked out over `bag` */
  input:  (widget: Pick<LibraryWidgetT, 'input_formula'>, bag: QuizBag) => InputOutcome
  /** The meta-prompt an author copies out to get help writing this widget's formula */
  advice: (widget: LibraryWidgetT, widgeting: AdviceSubject | null, sample: QuizBag | null) => string
}

/** A formulary whose widgeteds are worked out on every render, and stored nowhere */
export type LiveFormulary = FormularyFacts & {
  readonly refresh: 'live'
  readonly store:   null
  run: (widget: Pick<LibraryWidgetT, 'formula' | 'input_formula'>, widgeting: WidgetingT | null, bag: QuizBag) => LiveRun
}

/** A formulary whose widgeteds are asked for from the cell, and appended to its history */
export type AskedFormulary = FormularyFacts & {
  readonly refresh: 'click'
  readonly store:   'append'
  run: (widget: LibraryWidgetT, widgeting: WidgetingT, bag: QuizBag) => Promise<AskedT | null>
}

/** One generic runner behind a widget: code, never a row */
export type Formulary = LiveFormulary | AskedFormulary

/** Every formulary, by the kind a widget names */
export const Formularies = {
  jsonata: JsonataFormulary,
  aibot:   AibotFormulary,
} as const satisfies Record<Formularykind, Formulary>

/**
 * The formulary that works `widget`.
 *
 * @param widget - Any widget of the library.
 * @returns Its formulary.
 *
 * @example formularyFor({ formulary: 'jsonata' }).refresh  // => 'live'
 */
export function formularyFor(widget: Pick<LibraryWidgetT, 'formulary'>): Formulary {
  return Formularies[widget.formulary]
}
