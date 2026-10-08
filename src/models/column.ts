import * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as Labelmaker from '../lib/labelmaker'
import * as PA from '../lib/vv/patterns'
import * as CK from '../lib/vv/checks/strings'
import { PersonaLabelVals, PersonaTitles } from './persona'
import { ArchivedField, RankField, SecondaryField } from './question'

/** The question fields a column can show and edit */
export const QuestionFieldVals = ['title', 'clueing', 'hint', 'chains_to', 'qnum', 'alt_text', 'notes', 'full_answer', 'recap'] as const
export type QuestionField = typeof QuestionFieldVals[number]

/** Read-only things a column can show that are worked out from a question and the one it chains to */
export const QuestionViewVals = ['butnot'] as const
export type QuestionView = typeof QuestionViewVals[number]

/** The keys a question has in the bag that nobody types into its row: its label, its rank, and its viz flags. A column shows them as they are. */
export const QuestionKeyVals = ['label', RankField, ArchivedField, SecondaryField] as const
export type QuestionKey = typeof QuestionKeyVals[number]

/**
 * The words at the bag's top level a column's ref may name. Each is the same in every row, and
 * worth a column when its formula pulls an answer out of it.
 */
export const BagWordVals = ['quiz', 'hunt', 'realm', 'categories', 'qns'] as const
export type BagWord = typeof BagWordVals[number]

/** What a ref puts ahead of the label of a widgeting run once for the whole quiz: `quiz.playtesters`, the one dotted form */
export const QuizRefPrefix = 'quiz.'

/** The header a column showing one of the question's own fields, views or keys, or a word of the bag, goes by unless retitled */
export const RefTitles: Readonly<Record<QuestionField | QuestionView | QuestionKey | BagWord, string>> = {
  title:       'Title',
  clueing:     'Clueing',
  hint:        'Hint',
  chains_to:   'Chains to',
  qnum:        'Q#',
  alt_text:    'Alt Text',
  notes:       'Notes',
  full_answer: 'Full Answer',
  recap:       'Recap',
  butnot:      'BUT NOT',
  label:       'Label',
  rank:        'Rank',
  archived:    'Archived',
  secondary:   'Alternate',
  quiz:        'Quiz',
  hunt:        'Hunt',
  realm:       'Realm',
  categories:  'Categories',
  qns:         'Questions',
}

/**
 * The parts of a category-estimate entry's widgeted a column may show by a formula naming one,
 * `$.masie`: its list of estimates, each persona's chance at the question, and the three's average.
 */
export const WidgetingPartVals = ['estimates', ...PersonaLabelVals, 'average'] as const
export type WidgetingPart = typeof WidgetingPartVals[number]

/** The header a column showing one part of a widgeting goes by unless retitled */
export const WidgetingPartTitles: Readonly<Record<WidgetingPart, string>> = {
  estimates: 'Estimates',
  ...PersonaTitles,
  average:   'Average',
}

/**
 * What a column's ref names: a question's own field, a view of it, a key it has in the bag, a word
 * at the bag's top level, or a widgeting by its label, run for each question or (`quiz.<label>`)
 * once for the whole quiz.
 */
export type Ref =
  | { kind: 'field', field: QuestionField }
  | { kind: 'view', view: QuestionView }
  | { kind: 'key', key: QuestionKey }
  | { kind: 'word', word: BagWord }
  | { kind: 'widgeting', label: string, tier: 'question' | 'quiz' }

/** Where a column sets its text across its width, header and cells alike: the order a click on its alignment steps through */
export const ColumnAlignVals = ['left', 'center', 'right'] as const
export type ColumnAlign = typeof ColumnAlignVals[number]

/** How a column draws its text: as itself, as our markdown, verbatim and monospaced, or as the Title cell draws a question's label */
export const ColumnReadoutVals = ['plain', 'markdown', 'code', 'label'] as const
export type ColumnReadout = typeof ColumnReadoutVals[number]

/** The smallest and largest a column may be, in pixels */
export const WidthPxMin = 30
export const WidthPxMax = 800

/** Whether `word` is one of `vals` */
function isOneOf<VT extends string>(vals: readonly VT[], word: string): word is VT {
  return (vals as readonly string[]).includes(word)
}

/**
 * What the plain ref `source` names, or null for one that is no ref. A label is taken as a
 * widgeting's, whether or not the quiz has one.
 */
function plainRefOf(source: string): Ref | null {
  if (isOneOf(QuestionFieldVals, source)) { return { kind: 'field', field: source } }
  if (isOneOf(QuestionViewVals, source)) { return { kind: 'view', view: source } }
  if (isOneOf(QuestionKeyVals, source)) { return { kind: 'key', key: source } }
  if (isOneOf(BagWordVals, source)) { return { kind: 'word', word: source } }
  const quizWide = source.startsWith(QuizRefPrefix)
  const label = quizWide ? source.slice(QuizRefPrefix.length) : source
  if (! CK.label.safeParse(label).success) { return null }
  return { kind: 'widgeting', label, tier: quizWide ? 'quiz' : 'question' }
}

// The grammar before October 2026. A column's source said `question.<field>` for a question's own
// field or view, and `<widgeting>.<part>` for one part of what a category-estimate entry came to;
// a quiz nominated what it templated the same way. Read by every reader until the columnwise
// sprint's tightening, and by the importer for good: an export is a promise.

/** What the grammar before October 2026 called the questions' own fields in a source: `question.title`. No widgeting may be labelled this. */
export const QuestionWidgetLabel = 'question'

/**
 * A source in the grammar before October 2026, read as the plain ref and formula it is now: a
 * question's field or view by its name, a part of a widgeting as the widgeting with a formula
 * naming the part. Null for a source that is not in that grammar.
 *
 * @example beforeOctoberOf('question.clueing')   // => { source: 'clueing', formula: null }
 * @example beforeOctoberOf('categories.masie')   // => { source: 'categories', formula: '$.masie' }
 * @example beforeOctoberOf('dumdum')             // => null
 */
export function beforeOctoberOf(source: string): { source: string, formula: string | null } | null {
  const [head = '', tail, ...more] = source.split('.')
  if (tail === undefined || more.length > 0) { return null }
  if (head === QuestionWidgetLabel) {
    return isOneOf(QuestionFieldVals, tail) || isOneOf(QuestionViewVals, tail) ? { source: tail, formula: null } : null
  }
  if (`${head}.` === QuizRefPrefix || ! isOneOf(WidgetingPartVals, tail)) { return null }
  return { source: head, formula: partFormulaOf(tail) }
}

/**
 * A column's source and formula in the plain grammar: as they are, or, for a source in the
 * grammar before October 2026, translated (`beforeOctoberOf`). What every reader of a column reads
 * through until the tightening, what a column is written as from October 2026, and what the
 * importer reads an older export's columns as.
 *
 * @example plainOf({ source: 'categories.average' })                // => { source: 'categories', formula: '$.average' }
 * @example plainOf({ source: 'dumdum', formula: '$.value.guess' })  // => { source: 'dumdum', formula: '$.value.guess' }
 */
export function plainOf(column: { source: string, formula?: string }): { source: string, formula?: string } {
  const translated = beforeOctoberOf(column.source)
  const formula = translated?.formula ?? column.formula
  return { source: translated?.source ?? column.source, ...(formula !== undefined && { formula }) }
}

/**
 * The formula that picks one part out of a category-estimate entry's widgeted: what a column
 * showing that part says.
 *
 * @example partFormulaOf('masie')  // => '$.masie'
 */
export function partFormulaOf(part: WidgetingPart): string {
  return `$.${part}`
}

/**
 * The part of a category-estimate entry's widgeted `formula` picks, when it does nothing else;
 * null for any other formula, or none.
 *
 * @example partOf('$.average')        // => 'average'
 * @example partOf('$.average * 100')  // => null
 */
export function partOf(formula: string | null | undefined): WidgetingPart | null {
  return WidgetingPartVals.find((part) => formula === partFormulaOf(part)) ?? null
}

export const ColumnValidators = Validator(({ obj, str, oneof, titleish, formulaish, textish, label, int, uint, bool, stamps, zid }) => {
  const columnLabel = label
    .describe('What the column is called within its quiz, unique there. It names the column in an export and in the quiz\'s sort memory.')
  const source = str.refine((val) => plainRefOf(plainOf({ source: val }).source) !== null, `should name a question's field (such as clueing), its view (${QuestionViewVals.join(', ')}) or a key it has (${QuestionKeyVals.join(', ')}); a widgeting by a label that ${PA.Label.msg}, at most ${String(PA.Label.max)} characters, and none of the words the tool keeps for its own use; ${BagWordVals.join(', ')}; or ${QuizRefPrefix}<label> for a widgeting run once for the whole quiz`)
    .describe(`What the column shows, its ref: one plain key in the bag's own words, found on the question first (a field such as \`clueing\`, the view \`butnot\`, a key such as \`rank\`, or a widgeting's label) and then at the bag's top level (${BagWordVals.join(', ')}); or \`${QuizRefPrefix}<label>\` for a widgeting run once for the whole quiz. The grammar before October 2026 (\`${QuestionWidgetLabel}.<field>\`, \`<widgeting>.<part>\`) is still read.`)
  const formula = formulaish
    .describe('JSONata worked out over what the ref picks, as the bag holds it: a field itself, or a widgeting\'s whole widgeted (`$.value.guess`, `$.masie`), and that only when the widgeted is `ok`. Absent, the column shows the field, or the widgeted\'s value: identity.')
  const template = textish.min(1)
    .describe('Liquid making text of the value the formula came to, filled in over the question\'s template bag with that value as `value`. Absent, the value is drawn as it is.')
  const readout = oneof(ColumnReadoutVals)
    .describe('How the column draws its text: `plain` as itself, `markdown` as our markdown (then the sanitizer), `code` verbatim and monospaced, `label` as the Title cell draws a question\'s label. Absent, as the cells choose: `markdown` for a column with a template.')
  const collapsed = bool
    .describe('Whether the column is folded to the width of its turned header, its cells empty; its width is kept for the return. Absent, it is not.')
  const align = oneof(ColumnAlignVals)
    .describe('Where the column sets its header and every cell\'s text. Absent, Q# is centered and every other cell sets itself: a number to the right, anything else to the left.')
  const width_px = int.min(WidthPxMin).max(WidthPxMax)
    .describe('How wide the column is. The grid\'s layout is fixed, so nothing a cell holds can widen it.')

  const fields = {
    label:     columnLabel,
    title:     titleish
      .describe('The header the grid shows.'),
    source,
    width_px,
    align:     align.optional(),
    formula:   formula.optional(),
    template:  template.optional(),
    readout:   readout.optional(),
    collapsed: collapsed.optional(),
  }

  const column = obj(fields)
    .refine((val) => val.formula === undefined || (beforeOctoberOf(val.source)?.formula ?? null) === null, {
      message: 'A part of a widgeting, as the grammar before October 2026 names one, takes no formula beside it: name the widgeting, and pick the part in its formula',
      path:    ['formula'],
    })
    .describe('One column of a quiz\'s grid. A quiz keeps its columns in a list, which is the order they appear in, apart from its widgetings: a column only says what to show, and how.')

  const columnPatch = obj({
    label:     columnLabel.optional(),
    title:     titleish.optional(),
    source:    source.optional(),
    width_px:  width_px.optional(),
    align:     align.optional(),
    formula:   formula.nullable().optional(),
    template:  template.nullable().optional(),
    readout:   readout.nullable().optional(),
    collapsed: collapsed.optional(),
  })
    .describe('The fields of one column being revised. A key absent means "leave whatever is already there"; a formula, template or readout of null takes it off.')

  const row = obj({
    hunt_id:  zid('hunts')
      .describe('The hunt its quiz belongs to, copied from the quiz when the column is made.'),
    quiz_id:  zid('quizzes')
      .describe('The quiz this column belongs to.'),
    ...fields,
    position: uint.max(PA.ColumnsPerQuiz.max)
      .describe('The column\'s place among its quiz\'s columns, counting from zero.'),
    ...stamps,
  })
    .describe('One column as the database holds it.')

  return { source, formula, template, readout, column, columnPatch, row }
})

export type ColumnDNA   = Z.input<typeof ColumnValidators.column>
export type ColumnT     = Z.output<typeof ColumnValidators.column>
export type ColumnPatch = Z.output<typeof ColumnValidators.columnPatch>

/** One column of a quiz's grid: a header, a width, what to show and how, and perhaps where to set it */
export class Column implements ColumnT {
  declare label:      string
  declare title:      string
  declare source:     string
  declare width_px:   number
  declare align?:     ColumnAlign
  declare formula?:   string
  declare template?:  string
  declare readout?:   ColumnReadout
  declare collapsed?: boolean

  /**
   * Validated column.
   *
   * @param dna - Every field.
   * @returns A complete column.
   *
   * @example Column.fill({ label: 'clueing', title: 'Clueing', source: 'clueing', width_px: 330 })
   */
  static fill(dna: ColumnDNA): ColumnT {
    return ColumnValidators.column(dna)
  }
}

/**
 * What a source names, read in the plain grammar or the one before October 2026, where a part of
 * a widgeting names the widgeting, whatever its label (its column's formula picks the part:
 * `plainOf`). A source that names nothing reads as the title, which no validated source does.
 *
 * @param source - A validated column source.
 * @returns What it names.
 *
 * @example refOf('clueing')            // => { kind: 'field', field: 'clueing' }
 * @example refOf('question.clueing')   // => { kind: 'field', field: 'clueing' }
 * @example refOf('dumdum')             // => { kind: 'widgeting', label: 'dumdum', tier: 'question' }
 * @example refOf('quiz.playtesters')   // => { kind: 'widgeting', label: 'playtesters', tier: 'quiz' }
 * @example refOf('categories.masie')   // => { kind: 'widgeting', label: 'categories', tier: 'question' }
 * @example refOf('categories')         // => { kind: 'word', word: 'categories' }
 */
export function refOf(source: string): Ref {
  const translated = beforeOctoberOf(source)
  if (translated !== null && translated.formula !== null) { return { kind: 'widgeting', label: translated.source, tier: 'question' } }
  return plainRefOf(translated?.source ?? source) ?? { kind: 'field', field: 'title' }
}

/**
 * The source of a column showing the widgeting labelled `label`, run at `tier`.
 *
 * @example widgetingSourceOf('dumdum', 'question')   // => 'dumdum'
 * @example widgetingSourceOf('playtesters', 'quiz')  // => 'quiz.playtesters'
 */
export function widgetingSourceOf(label: string, tier: 'question' | 'quiz'): string {
  return tier === 'quiz' ? `${QuizRefPrefix}${label}` : label
}

/**
 * The label of the widgeting `source` shows, run for each question or once for the whole quiz, in
 * either grammar; null when it shows a question's own field, view or key, or a word of the bag.
 *
 * @example widgetingLabelOf('categories.average')  // => 'categories'
 * @example widgetingLabelOf('quiz.playtesters')    // => 'playtesters'
 * @example widgetingLabelOf('title')               // => null
 * @example widgetingLabelOf('question.title')      // => null
 */
export function widgetingLabelOf(source: string): string | null {
  const ref = refOf(source)
  return ref.kind === 'widgeting' ? ref.label : null
}

/**
 * The label and title a new column showing `source`, worked by `formula`, takes when the author
 * gives neither: a question's field, view or key, or a word of the bag, under its own name and
 * usual header; a widgeting under its label, titleized; and one part of a category-estimate entry
 * (`$.masie`) under both their names, headed by the part's.
 *
 * @param source - A validated column source.
 * @param formula - Its formula, if any.
 * @returns The label and the title.
 *
 * @example namesFor('chains_to')                  // => { label: 'chains_to', title: 'Chains to' }
 * @example namesFor('clueing_full')               // => { label: 'clueing_full', title: 'Clueing Full' }
 * @example namesFor('category_data', '$.masie')   // => { label: 'category_data_masie', title: 'Masie' }
 * @example namesFor('quiz.playtesters')           // => { label: 'playtesters', title: 'Playtesters' }
 */
export function namesFor(source: string, formula: string | null = null): { label: string, title: string } {
  const ref = refOf(source)
  switch (ref.kind) {
  case 'field': { return { label: ref.field, title: RefTitles[ref.field] } }
  case 'view':  { return { label: ref.view, title: RefTitles[ref.view] } }
  case 'key':   { return { label: ref.key, title: RefTitles[ref.key] } }
  case 'word':  { return { label: ref.word, title: RefTitles[ref.word] } }
  case 'widgeting': {
    const part = partOf(formula ?? plainOf({ source }).formula)
    if (part !== null) { return { label: `${ref.label}_${part}`, title: WidgetingPartTitles[part] } }
    return { label: ref.label, title: Labelmaker.titleize(ref.label) }
  }
  }
}

/** What a sort memory says when it was last put in the order of a column */
export type ColumnSortkey = `column:${string}`

/** The sort memory for `column` */
export function sortkeyOf(column: Pick<ColumnT, 'label'>): ColumnSortkey {
  return `column:${column.label}`
}

/** The column label a sort memory names, or null when it names something else */
export function columnLabelOf(sortkey: string): string | null {
  return sortkey.startsWith('column:') ? sortkey.slice('column:'.length) : null
}
