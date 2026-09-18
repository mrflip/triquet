/** Every column in the grid, in the order it appears */
export const ColkeyVals = [
  'grip', 'clueing', 'hint', 'short_answer', 'chains_to', 'butnot', 'qnum',
  'clueing_plus_rank', 'clueing_full', 'clueing_numeral',
  'butnot_full', 'butnot_numeral', 'hint_full', 'hint_numeral', 'clueing_plus_butnot_full',
  'alt_text', 'notes', 'full_answer',
  'clueing_ishes', 'butnot_ishes', 'hint_ishes', 'guess',
] as const
export type Colkey = typeof ColkeyVals[number]

/** How a column's header is drawn: along the row, rotated into it, or centred and wrapped */
export type Headkind = 'plain' | 'vertical' | 'centered'

export type ColumnSpec = {
  colkey:   Colkey
  title:    string
  widthPx:  number
  headkind: Headkind
}

/**
 * The grid's columns, left to right.
 *
 * Widths are explicit and the table's layout is fixed, so a 300-word clueing or a 40-item ish
 * list can never widen the column it sits in. The eight sum columns carry labels far longer
 * than their 78px, so those headers are rotated rather than wrapped.
 */
export const Columns: readonly ColumnSpec[] = [
  { colkey: 'grip',                     title: '',                     widthPx:  32, headkind: 'plain'    },
  { colkey: 'clueing',                  title: 'Clueing',              widthPx: 330, headkind: 'plain'    },
  { colkey: 'hint',                     title: 'Hint',                 widthPx: 330, headkind: 'plain'    },
  { colkey: 'short_answer',             title: 'Short answer',         widthPx: 100, headkind: 'plain'    },
  { colkey: 'chains_to',                title: 'Chains to',            widthPx: 120, headkind: 'plain'    },
  { colkey: 'butnot',                   title: 'BUT NOT',              widthPx: 180, headkind: 'plain'    },
  { colkey: 'qnum',                     title: 'Q#',                   widthPx:  60, headkind: 'plain'    },
  { colkey: 'clueing_plus_rank',        title: 'Clueing + Rank',       widthPx:  78, headkind: 'vertical' },
  { colkey: 'clueing_full',             title: 'Clueing Full Sum',     widthPx:  78, headkind: 'vertical' },
  { colkey: 'clueing_numeral',          title: 'Clueing Numeral Sum',  widthPx:  78, headkind: 'vertical' },
  { colkey: 'butnot_full',              title: 'BUT NOT Full Sum',     widthPx:  78, headkind: 'vertical' },
  { colkey: 'butnot_numeral',           title: 'BUT NOT Numeral Sum',  widthPx:  78, headkind: 'vertical' },
  { colkey: 'hint_full',                title: 'Hint Full Sum',        widthPx:  78, headkind: 'vertical' },
  { colkey: 'hint_numeral',             title: 'Hint Numeral Sum',     widthPx:  78, headkind: 'vertical' },
  { colkey: 'clueing_plus_butnot_full', title: 'Clueing+BUT NOT Full', widthPx:  78, headkind: 'vertical' },
  { colkey: 'alt_text',                 title: 'Alt Text',             widthPx: 220, headkind: 'plain'    },
  { colkey: 'notes',                    title: 'Notes',                widthPx: 220, headkind: 'plain'    },
  { colkey: 'full_answer',              title: 'Full Answer',          widthPx: 220, headkind: 'plain'    },
  { colkey: 'clueing_ishes',            title: 'Clueing ishes',        widthPx: 170, headkind: 'centered' },
  { colkey: 'butnot_ishes',             title: 'BUT NOT ishes',        widthPx: 170, headkind: 'centered' },
  { colkey: 'hint_ishes',               title: 'Hint Ishes',           widthPx: 170, headkind: 'centered' },
  { colkey: 'guess',                    title: 'Quick-model guess',    widthPx: 160, headkind: 'plain'    },
]

/** How wide the grid insists on being, so the container scrolls rather than the page */
export const GridWidthPx = Columns.reduce((acc, column) => acc + column.widthPx, 0)
