import { Column, RefTitles, type ColumnT, type QuestionField } from './column'
import type { WidgetingT } from './widgeting'

/** A quiz's widgetings and columns: what it works out, and how it lays that out */
export type Layout = {
  widgetings: WidgetingT[]
  columns:    ColumnT[]
}

/** How wide a column added through the columns editor starts, unless its author says otherwise */
export const AddedColumnWidthPx = 180

/** The question fields a new quiz shows, in order, and how wide each column starts */
const StarterColumns: readonly (readonly [QuestionField, number])[] = [
  ['title',       160],
  ['qnum',         60],
  ['clueing',     330],
  ['full_answer', 220],
  ['notes',       220],
]

/**
 * The widgetings and columns a new quiz starts with: none of the first, and a column for each
 * question field every quiz writes, under the field's own label and usual header. The question's
 * label rides under its title, in the Title column, as it always has.
 *
 * The rest is opt-in: the library's widgets through the widgeting editor, and the hint, the
 * chain and the alt text, which every question still holds, through the columns editor.
 *
 * @returns The widgetings and columns, in order.
 *
 * @example defaultLayout().columns.map((column) => column.label)  // => ['title', 'qnum', 'clueing', 'full_answer', 'notes']
 * @example defaultLayout().widgetings  // => []
 */
export function defaultLayout(): Layout {
  const columns = StarterColumns.map(([field, width_px]) => Column.fill({ label: field, title: RefTitles[field], source: field, width_px }))
  return { widgetings: [], columns }
}
