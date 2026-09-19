import { sortkeyOf, type ExpressingShape, type ExpressingT } from '../models/expressing'
import { PlaySlots, type PlaySlot } from '../models/playing'
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
  /** What the column is called in an export's header row; null for a column that holds no data */
  header:   string | null
  widthPx:  number
  headkind: Headkind
  /** Present when the header can be clicked to commit the quiz to this column's order */
  sortkey?: Sortkey
}

/**
 * What a played column is called in an export: the player who played it, and which text it was
 * shown; the guess is only ever shown the clueing, so it is named for its player alone.
 *
 * @param field - Which of the question's played cells.
 * @returns E.g. `dumdum`, `numnum_clueing`, `numnum_butnot`.
 */
function playingHeader(field: PlaySlot['field'] | 'butnot_ishes'): string {
  const slot = PlaySlots.find((each) => each.field === (field === 'butnot_ishes' ? 'hint_ishes' : field))
  if (! slot) { return field }
  if (field === 'guess') { return slot.player_label }
  return `${slot.player_label}_${field === 'butnot_ishes' ? 'butnot' : slot.textkind}`
}

/**
 * The columns before a quiz's computed ones, left to right.
 *
 * Widths are explicit and the table's layout is fixed, so a 300-word clueing or a 40-item ish
 * list can never widen the column it sits in.
 */
export const LeadColumns: readonly ColumnSpec[] = [
  { colkey: 'title',                    header: 'title', title: 'Title',                widthPx: 100, headkind: 'plain', sortkey: 'title' },
  { colkey: 'grip',                     header: null, title: '',                     widthPx:  32, headkind: 'plain'    },
  { colkey: 'clueing',                  header: 'clueing', title: 'Clueing',              widthPx: 330, headkind: 'plain'    },
  { colkey: 'hint',                     header: 'hint', title: 'Hint',                 widthPx: 330, headkind: 'plain'    },
  { colkey: 'chains_to',                header: 'chains_to', title: 'Chains to',            widthPx: 120, headkind: 'plain', sortkey: 'chains_to' },
  { colkey: 'butnot',                   header: 'butnot', title: 'BUT NOT',              widthPx: 180, headkind: 'plain'    },
  { colkey: 'qnum',                     header: 'qnum', title: 'Q#',                   widthPx:  60, headkind: 'plain', sortkey: 'qnum' },
]

/** The columns after a quiz's computed ones, left to right */
export const TailColumns: readonly ColumnSpec[] = [
  { colkey: 'alt_text',                 header: 'alt_text', title: 'Alt Text',             widthPx: 220, headkind: 'plain'    },
  { colkey: 'notes',                    header: 'notes', title: 'Notes',                widthPx: 220, headkind: 'plain'    },
  { colkey: 'full_answer',              header: 'full_answer', title: 'Full Answer',          widthPx: 220, headkind: 'plain'    },
  { colkey: 'clueing_ishes',            header: playingHeader('clueing_ishes'), title: 'Clueing ishes',        widthPx: 170, headkind: 'centered', sortkey: 'clueing_ishes' },
  { colkey: 'butnot_ishes',             header: playingHeader('butnot_ishes'), title: 'BUT NOT ishes',        widthPx: 170, headkind: 'centered', sortkey: 'butnot_ishes' },
  { colkey: 'hint_ishes',               header: playingHeader('hint_ishes'), title: 'Hint Ishes',           widthPx: 170, headkind: 'centered', sortkey: 'hint_ishes' },
  { colkey: 'guess',                    header: playingHeader('guess'), title: 'Quick-model guess',    widthPx: 160, headkind: 'plain'    },
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
    header:   expressing.label,
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
