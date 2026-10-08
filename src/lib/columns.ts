import { ColumnAlignVals, sortkeyOf, sourceOf, type ColumnAlign, type ColumnT, type QuestionField, type QuestionView, type WidgetingPart } from '../models/column'
import type { WidgetingT } from '../models/widgeting'
import type { Sortkey } from '../models/quiz'
import { widgetingShownNotice } from './notices'

/** How a column's header is drawn: along the row, or rotated into it */
export type Headkind = 'plain' | 'vertical'

/** What a column shows, found: the question's own field, a view of it, or the widgeting it names, whole or one part of it */
export type Resolved =
  | { kind: 'field', field: QuestionField }
  | { kind: 'view', view: QuestionView }
  | { kind: 'widgeting', widgeting: WidgetingT, part: WidgetingPart | null }

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
  /**
   * Where the header and every cell set their text; null leaves each to its own: a header along
   * the row to the left and a turned one to the right, a number to the right and text to the left
   */
  align:    ColumnAlign | null
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
 * @example resolve('question.clueing', [])                  // => { kind: 'field', field: 'clueing' }
 * @example resolve('categories.masie', [categories])         // => { kind: 'widgeting', widgeting: categories, part: 'masie' }
 */
export function resolve(source: string, widgetings: readonly WidgetingT[]): Resolved | null {
  const named = sourceOf(source)
  if (named.kind !== 'widgeting') { return named }
  const widgeting = widgetings.find((each) => each.label === named.label)
  return widgeting ? { kind: 'widgeting', widgeting, part: named.part } : null
}

/**
 * The columns of a quiz that show the widgeting labelled `label`, whole or a part of it: each
 * found through `resolve`, so a column counts in whichever grammar its source is written.
 *
 * @param quiz - The quiz's columns and widgetings.
 * @param label - The widgeting's label.
 * @returns Those columns, in the quiz's order; none when no column shows it.
 *
 * @example columnsShowing(quiz, 'cats').map((column) => column.label)  // => ['cats', 'cats_masie']
 */
export function columnsShowing<CT extends Pick<ColumnT, 'source'>>(quiz: { columns: readonly CT[], widgetings: readonly WidgetingT[] }, label: string): CT[] {
  return quiz.columns.filter((column) => {
    const shown = resolve(column.source, quiz.widgetings)
    return shown?.kind === 'widgeting' && shown.widgeting.label === label
  })
}

/**
 * Why the widgeting labelled `label` cannot be removed from a quiz, or null when it can: a
 * widgeting goes only once no column shows it (`columnsShowing`). The server refuses with the
 * same sentence the widgeting editor shows in place of its remove button.
 *
 * @param quiz - The quiz's columns and widgetings.
 * @param label - The widgeting's label.
 * @returns The sentence naming the columns that hold it back, or null.
 *
 * @example widgetingRemovalRefusal(quiz, 'hint_full')  // => 'The column “Hint Full Sum” still shows that widgeting — remove the column first.'
 */
export function widgetingRemovalRefusal(quiz: { columns: readonly Pick<ColumnT, 'label' | 'title' | 'source'>[], widgetings: readonly WidgetingT[] }, label: string): string | null {
  const showing = columnsShowing(quiz, label)
  return showing.length === 0 ? null : widgetingShownNotice(showing.map((column) => column.title || column.label))
}

/** Whether ordering the quiz by this can mean something: a value each question has */
function sortable(source: Resolved): boolean {
  if (source.kind === 'field') { return ['title', 'chains_to', 'qnum'].includes(source.field) }
  return source.kind === 'widgeting'
}

/** How a column's header is drawn: a narrow widgeting's rotated into it, everything else along the row */
function headkindOf(source: Pick<Resolved, 'kind'>, widthPx: number): Headkind {
  return source.kind === 'widgeting' && widthPx <= 100 ? 'vertical' : 'plain'
}

/**
 * Where a column sets its header and its cells: where it says, or Q# centered; null for any other
 * column that says nothing, whose header and cells each set themselves.
 *
 * @example alignOf({ ...column, align: 'right' })      // => 'right'
 * @example alignOf({ ...column, source: 'question.qnum' })  // => 'center'
 * @example alignOf({ ...column, source: 'question.title' }) // => null
 */
export function alignOf(column: Pick<ColumnT, 'source' | 'align'>): ColumnAlign | null {
  return column.align ?? (column.source === 'question.qnum' ? 'center' : null)
}

/**
 * Where a column's header sits: where the column says, Q# centered, a turned header to the right
 * over the numbers below it, any other to the left. It is what the column editor shows.
 *
 * @example headAlignOf({ label: 'qnum', title: 'Q#', source: 'question.qnum', width_px: 60 })       // => 'center'
 * @example headAlignOf({ label: 'sum', title: 'Sum', source: 'dumdum', width_px: 78 })              // => 'right'
 * @example headAlignOf({ label: 'notes', title: 'Notes', source: 'question.notes', width_px: 220 })  // => 'left'
 */
export function headAlignOf(column: ColumnT): ColumnAlign {
  return alignOf(column) ?? (headkindOf(sourceOf(column.source), column.width_px) === 'vertical' ? 'right' : 'left')
}

/**
 * The alignment a click on a column's moves it to: left, then center, then right, then left again.
 *
 * @example alignAfter('left')   // => 'center'
 * @example alignAfter('right')  // => 'left'
 */
export function alignAfter(align: ColumnAlign): ColumnAlign {
  return ColumnAlignVals[(ColumnAlignVals.indexOf(align) + 1) % ColumnAlignVals.length] ?? 'left'
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
    align:    alignOf(column),
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
