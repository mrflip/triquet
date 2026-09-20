import { sortkeyOf, sourceOf, type ColumnT, type QuestionField, type QuestionView } from '../models/column'
import { PlayingWidget, type ExpressingT, type PlayingWidgetT, type WidgetT } from '../models/widget'
import type { PlaySlot } from '../models/playing'
import type { Sortkey } from '../models/quiz'

/** How a column's header is drawn: along the row, rotated into it, or centred and wrapped */
export type Headkind = 'plain' | 'vertical' | 'centered'

/** What a column shows, found: the question's own field, a view of it, or the widget it names */
export type Resolved =
  | { kind: 'field', field: QuestionField }
  | { kind: 'view', view: QuestionView }
  | { kind: 'expressing', widget: ExpressingT }
  | { kind: 'playing', widget: PlayingWidgetT, slot: PlaySlot }

/** One column as the grid draws it */
export type ColumnSpec = {
  /** The quiz's label for the column, which is also its key in the grid */
  colkey:   string
  title:    string
  /** What the column is called in an export's header row */
  header:   string
  /** What it shows */
  source:   Resolved
  widthPx:  number
  headkind: Headkind
  /** Present when the header can be clicked to commit the quiz to this column's order */
  sortkey?: Sortkey
}

/** The grip that reorders a row belongs to the grid rather than to the quiz, and is always first */
export const GripWidthPx = 32

/**
 * What `source` shows, given the widgets a quiz has.
 *
 * @param source - A column's source string.
 * @param widgets - The quiz's widgets.
 * @returns The thing shown, or null when it names a widget the quiz does not have.
 *
 * @example resolve('question.clueing', [])  // => { kind: 'field', field: 'clueing' }
 */
export function resolve(source: string, widgets: readonly WidgetT[]): Resolved | null {
  const named = sourceOf(source)
  if (named.kind !== 'widget') { return named }
  const widget = widgets.find((each) => each.label === named.label)
  if (! widget) { return null }
  if (widget.kind === 'expressing') { return { kind: 'expressing', widget } }
  return { kind: 'playing', widget, slot: PlayingWidget.slotOf(widget) }
}

/** Whether ordering the quiz by this can mean something: a value each question has, or a count of what it found */
function sortable(source: Resolved): boolean {
  if (source.kind === 'field') { return ['title', 'chains_to', 'qnum'].includes(source.field) }
  if (source.kind === 'view') { return source.view === 'butnot_ishes' }
  return source.kind === 'expressing' || source.slot.field !== 'guess'
}

/** How a column's header is drawn: a number's rotated into it, a list's centred, prose's along the row */
function headkindOf(source: Resolved, widthPx: number): Headkind {
  if (source.kind === 'expressing') { return widthPx <= 100 ? 'vertical' : 'plain' }
  const isList = source.kind === 'view' ? source.view === 'butnot_ishes' : source.kind === 'playing' && source.slot.field !== 'guess'
  return isList ? 'centered' : 'plain'
}

/**
 * A column as the grid draws it.
 *
 * @param column - One of the quiz's columns.
 * @param widgets - The quiz's widgets, which the column may show.
 * @returns The spec, or null when the column shows a widget the quiz does not have.
 */
export function specFor(column: ColumnT, widgets: readonly WidgetT[]): ColumnSpec | null {
  const source = resolve(column.source, widgets)
  if (! source) { return null }
  return {
    colkey:   column.label,
    title:    column.title,
    header:   column.label,
    source,
    widthPx:  column.width_px,
    headkind: headkindOf(source, column.width_px),
    ...(sortable(source) && { sortkey: sortkeyOf(column) }),
  }
}

/**
 * Every column of a quiz's grid, left to right, as the grid draws them.
 *
 * @param quiz - The quiz's columns and widgets.
 * @returns One spec per column that shows something.
 *
 * @example specsFor(quiz).map((spec) => spec.title)
 */
export function specsFor(quiz: { columns: readonly ColumnT[], widgets: readonly WidgetT[] }): ColumnSpec[] {
  return quiz.columns.flatMap((column) => {
    const spec = specFor(column, quiz.widgets)
    return spec ? [spec] : []
  })
}

/**
 * How wide the grid insists on being, so the container scrolls rather than the page.
 *
 * @param specs - The grid's columns, not counting the grip.
 */
export function gridWidthPx(specs: readonly ColumnSpec[]): number {
  return specs.reduce((acc, spec) => acc + spec.widthPx, GripWidthPx)
}

/**
 * The sort memory of the quiz's Q# column: what the quiz remembers when it is in Q# order.
 *
 * @param quiz - The quiz's columns.
 * @returns The sortkey, or null when the quiz shows no Q# column.
 */
export function qnumSortkeyOf(quiz: { columns: readonly ColumnT[] }): Sortkey | null {
  const column = quiz.columns.find((each) => each.source === 'question.qnum')
  return column ? sortkeyOf(column) : null
}
