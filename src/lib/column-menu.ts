import * as Labelmaker from './labelmaker'
import * as Estimates from './estimates'
import type { Resolved } from './columns'
import { BagWordVals, type BagWord, QuestionFieldVals, QuestionKeyVals, QuestionViewVals, WidgetingPartTitles, WidgetingPartVals, partFormulaOf, widgetingSourceOf } from '../models/column'
import { QuizBagValidators } from '../models/quiz-bag'
import type { WidgetingT } from '../models/widgeting'
import type { WidgetT } from '../models/widget'

/**
 * The column editor's menus: what a column's ref may name, over the bag's words, and the formulas
 * offered beside it for what the ref picks.
 */

/** One thing a column's ref may name, with the group the source menu lists it under */
export type RefChoice = {
  /** The ref, as a column's `source` holds it */
  source: string
  group:  string
}

/** The groups the source menu lists its refs under, in its order */
export const RefGroups = {
  field:     'A question field',
  view:      'Worked out from the chain',
  key:       'Kept beside the question',
  widgeting: 'A widgeting',
  quizWide:  'A widgeting for the whole quiz',
  word:      'The same in every row',
} as const

/**
 * Every ref a column of the quiz may name, as the source menu lists them: each of the question's
 * own fields, its view, the keys it has in the bag, each widgeting for each question by its label,
 * each widgeting for the whole quiz as `quiz.<label>`, and the words at the bag's top level.
 *
 * @param quiz - The quiz's widgetings.
 * @returns The choices, in the menu's order.
 *
 * @example refChoicesOf({ widgetings: [dumdum, playtesters] }).map(({ source }) => source)
 *   // => ['title', 'clueing', ..., 'butnot', 'label', 'rank', 'archived', 'secondary', 'dumdum', 'quiz.playtesters', 'quiz', 'hunt', 'realm', 'categories', 'qns']
 */
export function refChoicesOf(quiz: { widgetings: readonly WidgetingT[] }): RefChoice[] {
  const atTier = (tier: WidgetingT['tier']) => quiz.widgetings.filter((widgeting) => widgeting.tier === tier)
  return [
    ...QuestionFieldVals.map((source) => ({ source, group: RefGroups.field })),
    ...QuestionViewVals.map((source) => ({ source, group: RefGroups.view })),
    ...QuestionKeyVals.map((source) => ({ source, group: RefGroups.key })),
    ...atTier('question').map((widgeting) => ({ source: widgeting.label, group: RefGroups.widgeting })),
    ...atTier('quiz').map((widgeting) => ({ source: widgetingSourceOf(widgeting.label, 'quiz'), group: RefGroups.quizWide })),
    ...BagWordVals.map((source) => ({ source, group: RefGroups.word })),
  ]
}

/** A formula the editor offers beside a ref, for what it picks: a field of it, a part, or a preset */
export type FormulaPreset = {
  formula: string
  /** What it picks or works out, in a few words */
  title:   string
}

/** What the ref picks, as the presets are offered for it: the thing found, and the widget of a widgeting, when the library has it */
export type PresetSubject = {
  shown:  Resolved
  widget: WidgetT | null
}

/** Offers presets for one kind of thing a ref picks; none for any other */
export type PresetSource = (subject: PresetSubject) => FormulaPreset[]

/** The formula picking `field` out of an object, or out of each member of a list */
function fieldPresetOf(field: string, whose: string): FormulaPreset {
  return { formula: `$.${field}`, title: `${whose} ${Labelmaker.titleize(field).toLowerCase()}` }
}

/** The fields a word of the bag holds, by its schema; for a list, the fields of each member */
const WordFields: Readonly<Record<BagWord, { fields: readonly string[], whose: string }>> = {
  quiz:       { fields: Object.keys(QuizBagValidators.bagQuiz.shape), whose: 'The quiz\'s' },
  hunt:       { fields: Object.keys(QuizBagValidators.bagHunt.shape), whose: 'The hunt\'s' },
  realm:      { fields: Object.keys(QuizBagValidators.bagRealm.shape), whose: 'The realm\'s' },
  categories: { fields: Object.keys(QuizBagValidators.bagCategory.shape), whose: 'Each category\'s' },
  qns:        { fields: Object.keys(QuizBagValidators.bagQuestion.shape), whose: 'Each question\'s' },
}

/** The field names of a word of the bag whose schema is known: the quiz, the hunt, the realm, each category, each question */
const fieldNamePresets: PresetSource = ({ shown }) => {
  if (shown.kind !== 'word') { return [] }
  const { fields, whose } = WordFields[shown.word]
  return fields.map((field) => fieldPresetOf(field, whose))
}

/** The parts of a category-estimate entry's widgeted: its estimates, each persona's chance, their average */
const partPresets: PresetSource = ({ shown, widget }) => {
  if (shown.kind !== 'widgeting' || ! Estimates.isEstimating(widget)) { return [] }
  return WidgetingPartVals.map((part) => ({ formula: partFormulaOf(part), title: WidgetingPartTitles[part] }))
}

/**
 * Where the presets come from, each offering them for the things it knows: the parts of a
 * category-estimate entry, and the field names of a word of the bag whose schema is known. A
 * thing with no known schema (a field's text, a formula's or a bot's result) is offered none, and
 * takes a formula typed in. Add a source here to offer more.
 */
export const PresetSources: readonly PresetSource[] = [partPresets, fieldNamePresets]

/**
 * The formulas offered beside a ref, for what it picks.
 *
 * @param subject - What the ref picks, and its widget when it is a widgeting's.
 * @returns The presets, each once, in the order their sources offer them.
 *
 * @example presetsFor({ shown: { kind: 'widgeting', widgeting: categoryData }, widget: estimating }).map(({ formula }) => formula)
 *   // => ['$.estimates', '$.masie', '$.artie', '$.poppy', '$.average']
 * @example presetsFor({ shown: { kind: 'word', word: 'categories' }, widget: null }).map(({ formula }) => formula)  // => ['$.label', '$.title']
 * @example presetsFor({ shown: { kind: 'field', field: 'clueing' }, widget: null })  // => []
 */
export function presetsFor(subject: PresetSubject): FormulaPreset[] {
  const offered = PresetSources.flatMap((source) => source(subject))
  return offered.filter((preset, idx) => offered.findIndex((each) => each.formula === preset.formula) === idx)
}

/**
 * What a ref picks, as the presets are offered for it: the thing `shown`, and the library's widget
 * for a widgeting.
 *
 * @example subjectOf(resolve('category_data', widgetings), library)  // => { shown: { kind: 'widgeting', ... }, widget: estimating }
 */
export function subjectOf(shown: Resolved, library: readonly WidgetT[]): PresetSubject {
  const widget = shown.kind === 'widgeting' ? library.find((each) => each.label === shown.widgeting.widget_label) ?? null : null
  return { shown, widget }
}
