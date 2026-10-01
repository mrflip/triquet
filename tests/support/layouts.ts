import { Column } from '../../src/models/column'
import { Hunt, type HuntT } from '../../src/models/hunt'
import type { Layout } from '../../src/models/layout'
import { DefaultWidgetings } from '../../src/models/seeds'

/** The eight sum columns, which are also the labels of the widgetings behind them */
const ClassicSums = [
  ['clueing_plus_rank',        'Clueing + Rank'],
  ['clueing_full',             'Clueing Full Sum'],
  ['clueing_numeral',          'Clueing Numeral Sum'],
  ['butnot_full',              'BUT NOT Full Sum'],
  ['butnot_numeral',           'BUT NOT Numeral Sum'],
  ['hint_full',                'Hint Full Sum'],
  ['hint_numeral',             'Hint Numeral Sum'],
  ['clueing_plus_butnot_full', 'Clueing+BUT NOT Full'],
] as const

/**
 * The layout every new quiz had until quizzes started lean: the seeding's default widgetings
 * (`DefaultWidgetings`, the three bots first), and the grid this tool always had -- the questions'
 * own fields, the sums between Q# and Alt Text, then the notes and what the bots found. What the
 * tests of the bots, the sums and everything reading across them start from.
 *
 * @returns The widgetings and columns, in order, a fresh copy each time.
 *
 * @example classicLayout().columns.length  // => 21
 */
export function classicLayout(): Layout {
  const columns = [
    ['title',         'Title',             'question.title',       100],
    ['clueing',       'Clueing',           'question.clueing',     330],
    ['hint',          'Hint',              'question.hint',        330],
    ['chains_to',     'Chains to',         'question.chains_to',   120],
    ['butnot',        'BUT NOT',           'question.butnot',      180],
    ['qnum',          'Q#',                'question.qnum',         60],
    ...ClassicSums.map(([label, title]) => [label, title, label, 78] as const),
    ['alt_text',      'Alt Text',          'question.alt_text',    220],
    ['notes',         'Notes',             'question.notes',       220],
    ['full_answer',   'Full Answer',       'question.full_answer', 220],
    ['clueing_ishes', 'Clueing ishes',     'numnum_clueing',       170],
    ['butnot_ishes',  'BUT NOT ishes',     'butnot_ishes',         170],
    ['hint_ishes',    'Hint Ishes',        'numnum_hint',          170],
    ['guess',         'Quick-model guess', 'dumdum',               160],
  ].map(([label, title, source, width_px]) => Column.fill({ label: String(label), title: String(title), source: String(source), width_px: Number(width_px) }))
  return { widgetings: [...DefaultWidgetings], columns }
}

/**
 * A fresh hunt (`Hunt.blank`) whose quiz is laid out as every new quiz was until quizzes started
 * lean (`classicLayout`): what the tests of the bots, the sums and the library's use start from.
 *
 * @param label - The hunt's label, and its quiz's; one is minted when omitted.
 * @returns The hunt.
 *
 * @example classicHunt('quiet_otter').realms[0].quizzes[0].widgetings.length  // => 12
 */
export function classicHunt(label?: string): HuntT {
  const hunt = Hunt.blank(label)
  return { ...hunt, realms: hunt.realms.map((realm) => ({ ...realm, quizzes: realm.quizzes.map((quiz) => ({ ...quiz, ...classicLayout() })) })) }
}
