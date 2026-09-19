import { sortkeyOf, type ExpressingShape, type ExpressingT } from '../models/expressing'
import type { Sortkey } from '../models/quiz'

/** Every column in the grid that is always there, in the order it appears; a quiz's own computed columns sit between `qnum` and `alt_text` */
export const ColkeyVals = [
  'title', 'grip', 'clueing', 'hint', 'chains_to', 'butnot', 'qnum',
  'alt_text', 'notes', 'full_answer',
  'clueing_ishes', 'butnot_ishes', 'hint_ishes', 'guess',
] as const
export type Colkey = typeof ColkeyVals[number]

/** How a column's header is drawn: along the row, rotated into it, or centred and wrapped */
export type Headkind = 'plain' | 'vertical' | 'centered'

export type ColumnSpec = {
  /** A fixed column's `Colkey`, or a computed column's `expressing:` sort memory */
  colkey:   string
  title:    string
  widthPx:  number
  headkind: Headkind
  /** Present when the header can be clicked to commit the quiz to this column's order */
  sortkey?: Sortkey
}

/**
 * The columns before a quiz's computed ones, left to right.
 *
 * Widths are explicit and the table's layout is fixed, so a 300-word clueing or a 40-item ish
 * list can never widen the column it sits in.
 */
export const LeadColumns: readonly ColumnSpec[] = [
  { colkey: 'title',                    title: 'Title',                widthPx: 100, headkind: 'plain', sortkey: 'title' },
  { colkey: 'grip',                     title: '',                     widthPx:  32, headkind: 'plain'    },
  { colkey: 'clueing',                  title: 'Clueing',              widthPx: 330, headkind: 'plain'    },
  { colkey: 'hint',                     title: 'Hint',                 widthPx: 330, headkind: 'plain'    },
  { colkey: 'chains_to',                title: 'Chains to',            widthPx: 120, headkind: 'plain', sortkey: 'chains_to' },
  { colkey: 'butnot',                   title: 'BUT NOT',              widthPx: 180, headkind: 'plain'    },
  { colkey: 'qnum',                     title: 'Q#',                   widthPx:  60, headkind: 'plain', sortkey: 'qnum' },
]

/** The columns after a quiz's computed ones, left to right */
export const TailColumns: readonly ColumnSpec[] = [
  { colkey: 'alt_text',                 title: 'Alt Text',             widthPx: 220, headkind: 'plain'    },
  { colkey: 'notes',                    title: 'Notes',                widthPx: 220, headkind: 'plain'    },
  { colkey: 'full_answer',              title: 'Full Answer',          widthPx: 220, headkind: 'plain'    },
  { colkey: 'clueing_ishes',            title: 'Clueing ishes',        widthPx: 170, headkind: 'centered', sortkey: 'clueing_ishes' },
  { colkey: 'butnot_ishes',             title: 'BUT NOT ishes',        widthPx: 170, headkind: 'centered', sortkey: 'butnot_ishes' },
  { colkey: 'hint_ishes',               title: 'Hint Ishes',           widthPx: 170, headkind: 'centered', sortkey: 'hint_ishes' },
  { colkey: 'guess',                    title: 'Quick-model guess',    widthPx: 160, headkind: 'plain'    },
]

/** How wide each shape of computed column is: a number column's, or a notes column's */
export const ShapeWidthPx: Record<ExpressingShape, number> = { skinny: 78, medium: 180 }

/**
 * The columns a quiz's expressings add to the grid.
 *
 * A skinny column's header is rotated into it, as a number column's always was; a medium
 * column's is laid along the row.
 *
 * @param expressings - The quiz's computed columns, in order.
 * @returns One column each, every one sortable.
 *
 * @example expressedColumns(quiz.expressings).map((column) => column.title)
 */
export function expressedColumns(expressings: readonly ExpressingT[]): ColumnSpec[] {
  return expressings.map((expressing) => ({
    colkey:   sortkeyOf(expressing),
    title:    expressing.title,
    widthPx:  ShapeWidthPx[expressing.shape],
    headkind: expressing.shape === 'skinny' ? 'vertical' : 'plain',
    sortkey:  sortkeyOf(expressing),
  }))
}

/**
 * Every column of the grid for a quiz, left to right.
 *
 * @param expressings - The quiz's computed columns, in order.
 * @returns The fixed columns with the computed ones between `qnum` and `alt_text`.
 */
export function columnsFor(expressings: readonly ExpressingT[]): ColumnSpec[] {
  return [...LeadColumns, ...expressedColumns(expressings), ...TailColumns]
}

/**
 * How wide the grid insists on being, so the container scrolls rather than the page.
 *
 * @param columns - The grid's columns.
 */
export function gridWidthPx(columns: readonly ColumnSpec[]): number {
  return columns.reduce((acc, column) => acc + column.widthPx, 0)
}
