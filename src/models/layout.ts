import { Column, type ColumnT } from './column'
import { DefaultWidgetings } from './seeds'
import type { WidgetingT } from './widgeting'

/** The eight sum columns, which are also the labels of the widgetings behind them */
const DefaultSums = [
  ['clueing_plus_rank',        'Clueing + Rank'],
  ['clueing_full',             'Clueing Full Sum'],
  ['clueing_numeral',          'Clueing Numeral Sum'],
  ['butnot_full',              'BUT NOT Full Sum'],
  ['butnot_numeral',           'BUT NOT Numeral Sum'],
  ['hint_full',                'Hint Full Sum'],
  ['hint_numeral',             'Hint Numeral Sum'],
  ['clueing_plus_butnot_full', 'Clueing+BUT NOT Full'],
] as const

/** A quiz's widgetings and columns: what it works out, and how it lays that out */
export type Layout = {
  widgetings: WidgetingT[]
  columns:    ColumnT[]
}

/**
 * The widgetings and columns a new quiz starts with.
 *
 * Widgetings: the default set (`DefaultWidgetings`), the three bots first. Columns: the
 * questions' own fields, the sums between Q# and Alt Text, then the notes and what the bots
 * found -- the grid this tool has always had.
 *
 * @returns The widgetings and columns, in order.
 *
 * @example defaultLayout().columns.length  // => 21
 */
export function defaultLayout(): Layout {
  const columns = [
    ['title',       'Title',          'question.title',        100],
    ['clueing',     'Clueing',        'question.clueing',      330],
    ['hint',        'Hint',           'question.hint',         330],
    ['chains_to',   'Chains to',      'question.chains_to',    120],
    ['butnot',      'BUT NOT',        'question.butnot',       180],
    ['qnum',        'Q#',             'question.qnum',          60],
    ...DefaultSums.map(([label, title]) => [label, title, label, 78] as const),
    ['alt_text',    'Alt Text',       'question.alt_text',     220],
    ['notes',       'Notes',          'question.notes',        220],
    ['full_answer', 'Full Answer',    'question.full_answer',  220],
    ['clueing_ishes', 'Clueing ishes', 'numnum_clueing',       170],
    ['butnot_ishes',  'BUT NOT ishes', 'butnot_ishes',         170],
    ['hint_ishes',    'Hint Ishes',    'numnum_hint',           170],
    ['guess',         'Quick-model guess', 'dumdum',            160],
  ].map(([label, title, source, width_px]) => Column.fill({ label: String(label), title: String(title), source: String(source), width_px: Number(width_px) }))
  return { widgetings: [...DefaultWidgetings], columns }
}
