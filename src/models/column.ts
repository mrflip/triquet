import * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as Labelmaker from '../lib/labelmaker'
import * as PA from '../lib/vv/patterns'
import * as CK from '../lib/vv/checks/strings'
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

/**
 * The stages a column may say between its source and its cell, beside the fields it has: a
 * formula working a value out of what it shows, a template making text of the value, a readout
 * drawing the text, and whether it is collapsed. Named here, with the column, so no widgeting
 * takes one of them (`ReservedWidgetingLabels`) and an export's columns never read like a bag.
 */
export const ColumnStageFieldnames = ['formula', 'template', 'readout', 'collapsed'] as const

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
 * What the ref `source` names, or null for one that is no ref. A label is taken as a widgeting's,
 * whether or not the quiz has one.
 */
function foundRefOf(source: string): Ref | null {
  if (isOneOf(QuestionFieldVals, source)) { return { kind: 'field', field: source } }
  if (isOneOf(QuestionViewVals, source)) { return { kind: 'view', view: source } }
  if (isOneOf(QuestionKeyVals, source)) { return { kind: 'key', key: source } }
  if (isOneOf(BagWordVals, source)) { return { kind: 'word', word: source } }
  const quizWide = source.startsWith(QuizRefPrefix)
  const label = quizWide ? source.slice(QuizRefPrefix.length) : source
  if (! CK.label.safeParse(label).success) { return null }
  return { kind: 'widgeting', label, tier: quizWide ? 'quiz' : 'question' }
}

export const ColumnValidators = Validator(({ obj, str, oneof, titleish, formulaish, textish, label, int, uint, bool, stamps, zid }) => {
  const columnLabel = label
    .describe('What the column is called within its quiz, unique there. It names the column in an export and in the quiz\'s sort memory.')
  const ref = str.refine((val) => foundRefOf(val) !== null, `should name a question's field (such as clueing), its view (${QuestionViewVals.join(', ')}) or a key it has (${QuestionKeyVals.join(', ')}); a widgeting by a label that ${PA.Label.msg}, at most ${String(PA.Label.max)} characters, and none of the words the tool keeps for its own use; ${BagWordVals.join(', ')}; or ${QuizRefPrefix}<label> for a widgeting run once for the whole quiz`)
    .describe(`A ref, as anything names a thing of the bag: one plain key in the bag's own words, found on the question first (a field such as \`clueing\`, the view \`butnot\`, a key such as \`rank\`, or a widgeting's label) and then at the bag's top level (${BagWordVals.join(', ')}); or \`${QuizRefPrefix}<label>\` for a widgeting run once for the whole quiz.`)
  const source = ref
    .describe(`What the column shows, its ref: one plain key in the bag's own words, found on the question first (a field such as \`clueing\`, the view \`butnot\`, a key such as \`rank\`, or a widgeting's label) and then at the bag's top level (${BagWordVals.join(', ')}); or \`${QuizRefPrefix}<label>\` for a widgeting run once for the whole quiz.`)
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
    collapsed: collapsed.nullable().optional(),
  })
    .describe('The fields of one column being revised. A key absent means "leave whatever is already there"; a formula, template, readout or collapsed of null takes it off.')

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

  return { source, ref, formula, template, readout, column, columnPatch, row }
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
 * What a source names. A source that names nothing reads as the title, which no validated source
 * does.
 *
 * @param source - A validated column source.
 * @returns What it names.
 *
 * @example refOf('clueing')            // => { kind: 'field', field: 'clueing' }
 * @example refOf('dumdum')             // => { kind: 'widgeting', label: 'dumdum', tier: 'question' }
 * @example refOf('quiz.playtesters')   // => { kind: 'widgeting', label: 'playtesters', tier: 'quiz' }
 * @example refOf('categories')         // => { kind: 'word', word: 'categories' }
 */
export function refOf(source: string): Ref {
  return foundRefOf(source) ?? { kind: 'field', field: 'title' }
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
 * The label of the widgeting `source` shows, run for each question or once for the whole quiz;
 * null when it shows a question's own field, view or key, or a word of the bag.
 *
 * @example widgetingLabelOf('category_data')     // => 'category_data'
 * @example widgetingLabelOf('quiz.playtesters')  // => 'playtesters'
 * @example widgetingLabelOf('title')             // => null
 */
export function widgetingLabelOf(source: string): string | null {
  const ref = refOf(source)
  return ref.kind === 'widgeting' ? ref.label : null
}

/**
 * The label and title a new column showing `source` takes when the author gives neither: a
 * question's field, view or key, or a word of the bag, under its own name and usual header; a
 * widgeting under its label, titleized. What its formula makes of it is named by the preset the
 * formula came from, if any (`ColumnMenu.namesOf`).
 *
 * @param source - A validated column source.
 * @returns The label and the title.
 *
 * @example namesFor('chains_to')         // => { label: 'chains_to', title: 'Chains to' }
 * @example namesFor('clueing_full')      // => { label: 'clueing_full', title: 'Clueing Full' }
 * @example namesFor('quiz.playtesters')  // => { label: 'playtesters', title: 'Playtesters' }
 */
export function namesFor(source: string): { label: string, title: string } {
  const ref = refOf(source)
  switch (ref.kind) {
  case 'field':     { return { label: ref.field, title: RefTitles[ref.field] } }
  case 'view':      { return { label: ref.view, title: RefTitles[ref.view] } }
  case 'key':       { return { label: ref.key, title: RefTitles[ref.key] } }
  case 'word':      { return { label: ref.word, title: RefTitles[ref.word] } }
  case 'widgeting': { return { label: ref.label, title: Labelmaker.titleize(ref.label) } }
  }
}

/** Names a column showing `source`, worked by `formula`, as one the author gives neither label nor title is named: `namesFor`, or a namer knowing more */
export type ColumnNamer = (source: string, formula: string | null) => { label: string, title: string }

/**
 * `patch` with the column's title carried along: a column still headed as `named` heads what it
 * shows, as a new one is, is headed after what it shows once the patch changes what that is or
 * its formula. A column the author has headed otherwise, or a patch that sets the title itself,
 * is left as it is.
 *
 * @param column - The column as it stands.
 * @param patch - The change to it.
 * @param named - How a column is named for what it shows: `namesFor` unless told otherwise (the column menu's `namerOf` knows the presets' names).
 * @returns The patch, with a title when the header follows.
 *
 * @example retitledPatch({ title: 'Notes', source: 'notes', ... }, { source: 'hint' })                                              // => { source: 'hint', title: 'Hint' }
 * @example retitledPatch({ title: 'Remarks', source: 'notes', ... }, { source: 'hint' })                                            // => { source: 'hint' }
 * @example retitledPatch({ title: 'Category Data', source: 'category_data', ... }, { formula: '$.masie' }, namerOf(quiz, library))  // => { formula: '$.masie', title: 'Masie' }
 */
export function retitledPatch(column: Pick<ColumnT, 'title' | 'source' | 'formula'>, patch: ColumnPatch, named: ColumnNamer = namesFor): ColumnPatch {
  if (patch.title !== undefined || (patch.source === undefined && patch.formula === undefined)) { return patch }
  if (column.title !== named(column.source, column.formula ?? null).title) { return patch }
  const formula = patch.formula === undefined ? column.formula ?? null : patch.formula
  const { title } = named(patch.source ?? column.source, formula)
  return title === column.title ? patch : { ...patch, title }
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
