import { Column, type ColumnT } from './column'
import { Expressing, PlayingWidget, type ExpressingT, type WidgetT } from './widget'
import type { ExpressionT } from './expression'

/** The players every quiz starts with a widget for, in the order the grid has always shown them */
const DefaultPlayings = [
  { kind: 'playing', label: 'dumdum',         player_label: 'dumdum', textkind: 'clueing' },
  { kind: 'playing', label: 'numnum_clueing', player_label: 'numnum', textkind: 'clueing' },
  { kind: 'playing', label: 'numnum_hint',    player_label: 'numnum', textkind: 'hint' },
] as const

/** The eight sum columns, which are also the labels of the expressions and widgets behind them */
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

/** A quiz's widgets and columns: what it can show, and how it lays that out */
export type Layout = {
  widgets: WidgetT[]
  columns: ColumnT[]
}

/**
 * The widgets and columns a new quiz starts with.
 *
 * Widgets: a playing for each player-and-text the tool knows, then a widget for each of the
 * eight sums whose expression `expressions` still holds. Columns: the questions' own fields, the
 * sums between Q# and Alt Text, then the notes and the players' answers -- the grid this tool has
 * always had.
 *
 * @param expressions - The workspace's expressions.
 * @returns The widgets and columns, in order.
 *
 * @example defaultLayoutFor(SeedExpressions).columns.length  // => 21
 */
export function defaultLayoutFor(expressions: readonly ExpressionT[]): Layout {
  const held = new Set(expressions.map((expression) => expression.label))
  const sums = DefaultSums.filter(([label]) => held.has(label))
  const widgets: WidgetT[] = [
    ...DefaultPlayings.map((dna) => PlayingWidget.fill(dna)),
    ...sums.map(([label]): ExpressingT => Expressing.fill({ kind: 'expressing', label, expression_label: label })),
  ]
  const columns = [
    ['title',       'Title',          'question.title',        100],
    ['clueing',     'Clueing',        'question.clueing',      330],
    ['hint',        'Hint',           'question.hint',         330],
    ['chains_to',   'Chains to',      'question.chains_to',    120],
    ['butnot',      'BUT NOT',        'question.butnot',       180],
    ['qnum',        'Q#',             'question.qnum',          60],
    ...sums.map(([label, title]) => [label, title, label, 78] as const),
    ['alt_text',    'Alt Text',       'question.alt_text',     220],
    ['notes',       'Notes',          'question.notes',        220],
    ['full_answer', 'Full Answer',    'question.full_answer',  220],
    ['clueing_ishes', 'Clueing ishes', 'numnum_clueing',       170],
    ['butnot_ishes',  'BUT NOT ishes', 'question.butnot_ishes', 170],
    ['hint_ishes',    'Hint Ishes',    'numnum_hint',           170],
    ['guess',         'Quick-model guess', 'dumdum',            160],
  ].map(([label, title, source, width_px]) => Column.fill({ label: String(label), title: String(title), source: String(source), width_px: Number(width_px) }))
  return { widgets, columns }
}
