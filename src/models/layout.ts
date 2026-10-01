import { Column, type ColumnT } from './column'
import type { WidgetingT } from './widgeting'

/** A quiz's widgetings and columns: what it works out, and how it lays that out */
export type Layout = {
  widgetings: WidgetingT[]
  columns:    ColumnT[]
}

/**
 * The widgetings and columns a new quiz starts with: none of the first, and a column for each
 * question field every quiz writes. The question's label rides under its title, in the Title
 * column, as it always has.
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
  const columns = [
    ['title',       'Title',       'question.title',       160],
    ['qnum',        'Q#',          'question.qnum',         60],
    ['clueing',     'Clueing',     'question.clueing',     330],
    ['full_answer', 'Full Answer', 'question.full_answer', 220],
    ['notes',       'Notes',       'question.notes',       220],
  ].map(([label, title, source, width_px]) => Column.fill({ label: String(label), title: String(title), source: String(source), width_px: Number(width_px) }))
  return { widgetings: [], columns }
}
