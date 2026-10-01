import { sortkeyOf, sourceOf, type ColumnT, type QuestionField, type QuestionView } from '../models/column'
import type { WidgetingT } from '../models/widgeting'
import type { Sortkey } from '../models/quiz'

/** How a column's header is drawn: along the row, or rotated into it */
export type Headkind = 'plain' | 'vertical'

/** What a column shows, found: the question's own field, a view of it, or the widgeting it names */
export type Resolved =
  | { kind: 'field', field: QuestionField }
  | { kind: 'view', view: QuestionView }
  | { kind: 'widgeting', widgeting: WidgetingT }

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

/** The gutter holding a row's grip, or its checkbox and trash can, belongs to the grid rather than to the quiz, and is always first */
export const GutterWidthPx = 40

/**
 * What `source` shows, given the widgetings a quiz has.
 *
 * @param source - A column's source string.
 * @param widgetings - The quiz's widgetings.
 * @returns The thing shown, or null when it names a widgeting the quiz does not have.
 *
 * @example resolve('question.clueing', [])  // => { kind: 'field', field: 'clueing' }
 */
export function resolve(source: string, widgetings: readonly WidgetingT[]): Resolved | null {
  const named = sourceOf(source)
  if (named.kind !== 'widgeting') { return named }
  const widgeting = widgetings.find((each) => each.label === named.label)
  return widgeting ? { kind: 'widgeting', widgeting } : null
}

/** Whether ordering the quiz by this can mean something: a value each question has */
function sortable(source: Resolved): boolean {
  if (source.kind === 'field') { return ['title', 'chains_to', 'qnum'].includes(source.field) }
  return source.kind === 'widgeting'
}

/** How a column's header is drawn: a narrow widgeting's rotated into it, everything else along the row */
function headkindOf(source: Resolved, widthPx: number): Headkind {
  return source.kind === 'widgeting' && widthPx <= 100 ? 'vertical' : 'plain'
}

/**
 * A column as the grid draws it.
 *
 * @param column - One of the quiz's columns.
 * @param widgetings - The quiz's widgetings, which the column may show.
 * @returns The spec, or null when the column shows a widgeting the quiz does not have.
 */
export function specFor(column: ColumnT, widgetings: readonly WidgetingT[]): ColumnSpec | null {
  const source = resolve(column.source, widgetings)
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
 * @param quiz - The quiz's columns and widgetings.
 * @returns One spec per column that shows something.
 *
 * @example specsFor(quiz).map((spec) => spec.title)
 */
export function specsFor(quiz: { columns: readonly ColumnT[], widgetings: readonly WidgetingT[] }): ColumnSpec[] {
  return quiz.columns.flatMap((column) => {
    const spec = specFor(column, quiz.widgetings)
    return spec ? [spec] : []
  })
}

/**
 * How wide the grid insists on being, so the container scrolls rather than the page.
 *
 * @param specs - The grid's columns, not counting the gutter.
 */
export function gridWidthPx(specs: readonly ColumnSpec[]): number {
  return specs.reduce((acc, spec) => acc + spec.widthPx, GutterWidthPx)
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
