import _ from 'es-toolkit/compat'
import { drawnOf, isDrawnByEditor, readoutOf, shownOf, type ColumnSpec, type DrawnT } from '../lib/columns'
import * as Estimates from '../lib/estimates'
import { formularyFor } from '../lib/formulary/formularies'
import * as Runner from '../lib/formulary/runner'
import * as Templating from '../lib/templating'
import type { ColumnReadout, QuestionField } from '../models/column'
import type { QuestionT } from '../models/question'
import { Widgeted, type WidgetedT } from '../models/widgeted'
import type { EntryWidgetT, WidgetT } from '../models/widget'
import type { WidgetingT } from '../models/widgeting'

/**
 * What one column's cell of a question shows, worked out of the quiz's run: which editor or
 * readout draws it, and what that is handed. A row draws its cells from these alone.
 */
export type CellRunT = (
  | { kind: 'collapsed' }
  /** A question's own field, in its editor */
  | { kind: 'field', field: QuestionField }
  /** An entry's cell, typed into */
  | { kind: 'entry', widget: EntryWidgetT, widgeting: WidgetingT, widgeted: WidgetedT }
  /** A bot's cell, asked from the cell: whether its question has anything to ask, and why its widgeting cannot be asked at all, when it cannot */
  | { kind: 'ask', widgeted: WidgetedT, askable: boolean, notice: string | null }
  /** Drawn by the column's readout */
  | { kind: 'drawn', drawn: DrawnT, readout: ColumnReadout }
  /** The chained-to question's hint, as the BUT NOT preview */
  | { kind: 'butnot' }
  /** One part of a category-estimate entry's cell */
  | { kind: 'estimate', part: Estimates.Part, widgeted: WidgetedT }
  /** Anything else worked out */
  | { kind: 'widgeted', widgeted: WidgetedT }
) & {
  /** What a double-click on the cell asks again, when it asks anything: the widgeting's label, and whether of the chained-to question */
  reask: ReaskT | null
}

/** What a double-click on a cell asks again: the widgeting labelled so, of the question or of the one it chains to */
export type ReaskT = { widgeting_label: string, ofTarget: boolean }

/**
 * What one question's row reads of a quiz's run: each column's cell (`CellRunT`), by its colkey,
 * and the template bag its templated boxes are filled in over. Two of these for one question are
 * the same to the row (`isSameRowRun`) when every cell is the same and every templated box of the
 * question fills in the same, whichever run they came from.
 */
export type RowRunT = {
  cells: Readonly<Record<string, CellRunT>>
  /** What the boxes of the sources the quiz templates are filled in over; null when it templates none */
  bag:   Templating.TemplateBag | null
  /** Each templated source of the question, filled in over `bag`: what tells one run's bag from another's, for this question */
  faces: Readonly<Record<string, Templating.FilledT>>
}

/** Which of a bot's full-text widgets a double-click re-asks through, and of which question: the number spotter working its text */
const Reasks: Readonly<Record<string, { widget_label: string, ofTarget: boolean }>> = {
  clueing_full: { widget_label: 'numnum_clueing', ofTarget: false },
  hint_full:    { widget_label: 'numnum_hint', ofTarget: false },
  butnot_full:  { widget_label: 'numnum_hint', ofTarget: true },
}

/**
 * What one question's row reads of a quiz's run (`RowRunT`): each column's cell, as the row's
 * editors and readouts draw it, the question's template bag, and its templated texts filled in.
 *
 * @param run - The quiz, run.
 * @param question - The row's question.
 * @param specs - The quiz's columns.
 * @param templateable - What the quiz nominates as templateable.
 * @param unavailableFor - Why the widgeting labelled so cannot be asked at all, when it cannot.
 * @returns What the row draws.
 *
 * @example rowRunOf(run, question, specs, ['clueing'], () => null).cells.clueing  // => { kind: 'field', field: 'clueing', reask: null }
 */
export function rowRunOf(run: Runner.QuizRun, question: QuestionT, specs: readonly ColumnSpec[], templateable: readonly string[], unavailableFor: (widgeting_label: string) => string | null): RowRunT {
  const cells = Object.fromEntries(specs.map((spec) => [spec.colkey, cellRunOf(run, question._id, spec, templateable, unavailableFor)]))
  const bag = templateable.length === 0 ? null : Templating.bagOf(run, question._id)
  const faces = bag === null ? {} : Object.fromEntries(templateable.map((source) => [source, Templating.fill(templatedTextOf(run, question, source), bag)]))
  return { cells, bag, faces }
}

/**
 * Whether two of a question's row runs draw the same: every cell the same, and every templated
 * text filling in the same. A row handed one in place of the other need not be drawn again.
 *
 * @example isSameRowRun(rowRunOf(run, question, specs, [], none), rowRunOf(rerun, question, specs, [], none))  // => true, when the question's cells came to the same
 */
export function isSameRowRun(aa: RowRunT, bb: RowRunT): boolean {
  return aa === bb || ((aa.bag === null) === (bb.bag === null) && _.isEqual(aa.cells, bb.cells) && _.isEqual(aa.faces, bb.faces))
}

/** The text a templated source holds for the question: its own field's, or, for an entry, what was typed */
function templatedTextOf(run: Runner.QuizRun, question: QuestionT, source: string): string {
  const field = (question as Readonly<Record<string, unknown>>)[source]
  if (typeof field === 'string') { return field }
  return Widgeted.textOf(Runner.widgetedOf(run, source, question._id))
}

/** What one column's cell of a question shows (`CellRunT`) */
function cellRunOf(run: Runner.QuizRun, question_id: string, spec: ColumnSpec, templateable: readonly string[], unavailableFor: (widgeting_label: string) => string | null): CellRunT {
  if (spec.collapsed) { return { kind: 'collapsed', reask: null } }
  const { source } = spec
  const widget = source.kind === 'widgeting' ? Runner.stepOf(run, source.widgeting.label)?.widget ?? null : null
  const reask = reaskOf(run, spec, widget)
  const edited = isDrawnByEditor(spec, widget) ? editedCellOf(run, question_id, source, widget, unavailableFor) : null
  if (edited !== null) { return { ...edited, reask } }
  const readout = readoutOf(spec, widget)
  if (readout !== null) { return { kind: 'drawn', drawn: drawnOf(spec, run, templateable, question_id), readout, reask } }
  if (source.kind === 'view' && spec.formula === null) { return { kind: 'butnot', reask } }
  const widgeted = shownOf(spec, run, templateable, question_id)
  const part = Estimates.isEstimating(widget) ? Estimates.partOf(spec.formula) : null
  if (part !== null) { return { kind: 'estimate', part, widgeted, reask } }
  return { kind: 'widgeted', widgeted, reask }
}

/** A cell drawn by its own editor, apart from what a double-click asks: a question's field, an entry's cell, or a bot's asked from the cell; null for one its readout draws after all */
function editedCellOf(run: Runner.QuizRun, question_id: string, source: ColumnSpec['source'], widget: WidgetT | null, unavailableFor: (widgeting_label: string) => string | null): DistributiveOmit<CellRunT, 'reask'> | null {
  if (source.kind === 'field') { return { kind: 'field', field: source.field } }
  if (source.kind !== 'widgeting') { return null }
  const { widgeting } = source
  const widgeted = Runner.widgetedOf(run, widgeting.label, question_id)
  if (widget?.formulary === 'entry') { return { kind: 'entry', widget, widgeting, widgeted } }
  if (widget === null || formularyFor(widget).refresh !== 'click') { return null }
  const askable = Runner.inputOf(run, widgeting.label, question_id).status === 'ok'
  return { kind: 'ask', widgeted, askable, notice: unavailableFor(widgeting.label) }
}

/** `Omit` taken from each member of a union apart, so each keeps its own fields */
type DistributiveOmit<TT, KK extends PropertyKey> = TT extends unknown ? Omit<TT, KK> : never

/**
 * What a double-click on a column's cell asks again: for a widgeting's column, never an entry's,
 * whose widget is one of the bots' full texts (`Reasks`), the quiz's widgeting working the number
 * spotter that reads it, when it has one.
 */
function reaskOf(run: Runner.QuizRun, spec: ColumnSpec, widget: WidgetT | null): ReaskT | null {
  if (spec.source.kind !== 'widgeting' || widget?.formulary === 'entry') { return null }
  const through = Reasks[spec.source.widgeting.widget_label]
  if (through === undefined) { return null }
  const working = run.steps.find((step) => step.widget?.formulary === 'aibot' && step.widget.label === through.widget_label)
  return working ? { widgeting_label: working.widgeting.label, ofTarget: through.ofTarget } : null
}
