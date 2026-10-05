import * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as Labelmaker from '../lib/labelmaker'
import * as PA from '../lib/vv/patterns'
import { PersonaLabelVals, PersonaTitles } from './persona'

/** What a column's source calls the questions' own fields: `question.title`. No widgeting may be labelled this. */
export const QuestionWidgetLabel = 'question'

/** The question fields a column can show and edit */
export const QuestionFieldVals = ['title', 'clueing', 'hint', 'chains_to', 'qnum', 'alt_text', 'notes', 'full_answer'] as const
export type QuestionField = typeof QuestionFieldVals[number]

/** Read-only things a column can show that are worked out from a question and the one it chains to */
export const QuestionViewVals = ['butnot'] as const
export type QuestionView = typeof QuestionViewVals[number]

/** The header a column showing one of the question's own fields or views goes by unless retitled */
export const QuestionSourceTitles: Readonly<Record<QuestionField | QuestionView, string>> = {
  title:       'Title',
  clueing:     'Clueing',
  hint:        'Hint',
  chains_to:   'Chains to',
  qnum:        'Q#',
  alt_text:    'Alt Text',
  notes:       'Notes',
  full_answer: 'Full Answer',
  butnot:      'BUT NOT',
}

/**
 * The parts a column may show of a widgeting that offers them, as `<widgeting>.<part>`: a
 * category-estimate entry's list of estimates, each persona's chance at the question, and the
 * three's average.
 */
export const WidgetingPartVals = ['estimates', ...PersonaLabelVals, 'average'] as const
export type WidgetingPart = typeof WidgetingPartVals[number]

/** The header a column showing one part of a widgeting goes by unless retitled */
export const WidgetingPartTitles: Readonly<Record<WidgetingPart, string>> = {
  estimates: 'Estimates',
  ...PersonaTitles,
  average:   'Average',
}

/** What a column shows: a question field, a view of a question, or what a widgeting came to, whole or one part of it */
export type Source =
  | { kind: 'field', field: QuestionField }
  | { kind: 'view', view: QuestionView }
  | { kind: 'widgeting', label: string, part: WidgetingPart | null }

/** The smallest and largest a column may be, in pixels */
export const WidthPxMin = 30
export const WidthPxMax = 800

const QuestionSourcePattern = String.raw`${QuestionWidgetLabel}\.(${[...QuestionFieldVals, ...QuestionViewVals].join('|')})`
const WidgetingSourcePattern = String.raw`(?!${QuestionWidgetLabel}\.)[a-z]\w*(\.(${WidgetingPartVals.join('|')}))?`
const SourceRe = new RegExp(`^(${QuestionSourcePattern}|${WidgetingSourcePattern})$`)

export const ColumnValidators = Validator(({ obj, str, titleish, label, int, uint, zid }) => {
  const columnLabel = label
    .describe('What the column is called within its quiz, unique there. It names the column in an export and in the quiz\'s sort memory.')
  const source = str.regex(SourceRe, 'should be `question.<field>`, `question.<view>`, the label of a widgeting, or a widgeting\'s label and one of its parts')
    .refine((val) => val !== QuestionWidgetLabel, 'the questions have no value of their own; name one of their fields')
    .refine((val) => label.safeParse(widgetingLabelOf(val) ?? QuestionWidgetLabel).success, {
      message: `names a widgeting by a label that ${PA.Label.msg}, at most ${String(PA.Label.max)} characters`,
      when:    (payload) => payload.issues.length === 0,
    })
    .describe(`What the column shows: \`question.title\` and the like for a question's own field, \`question.butnot\` for a view of it, a widgeting's label for what it came to, or \`<widgeting>.<part>\` for one part of what a category-estimate entry came to (${WidgetingPartVals.join(', ')}).`)

  const column = obj({
    label:    columnLabel,
    title:    titleish
      .describe('The header the grid shows.'),
    source,
    width_px: int.min(WidthPxMin).max(WidthPxMax)
      .describe('How wide the column is. The grid\'s layout is fixed, so nothing a cell holds can widen it.'),
  })
    .describe('One column of a quiz\'s grid. A quiz keeps its columns in a list, which is the order they appear in, apart from its widgetings: a column only says what to show, and where.')

  const columnPatch = obj({
    label:    columnLabel.optional(),
    title:    titleish.optional(),
    source:   source.optional(),
    width_px: int.min(WidthPxMin).max(WidthPxMax).optional(),
  })
    .describe('The fields of one column being revised. A key absent means "leave whatever is already there".')

  const row = obj({
    hunt_id:  zid('hunts')
      .describe('The hunt its quiz belongs to, copied from the quiz when the column is made.'),
    quiz_id:  zid('quizzes')
      .describe('The quiz this column belongs to.'),
    ...column.shape,
    position: uint.max(PA.ColumnsPerQuiz.max)
      .describe('The column\'s place among its quiz\'s columns, counting from zero.'),
  })
    .describe('One column as the database holds it.')

  return { column, columnPatch, row }
})

export type ColumnDNA   = Z.input<typeof ColumnValidators.column>
export type ColumnT     = Z.output<typeof ColumnValidators.column>
export type ColumnPatch = Z.output<typeof ColumnValidators.columnPatch>

/** One column of a quiz's grid: a header, a width, and what to show */
export class Column implements ColumnT {
  declare label:    string
  declare title:    string
  declare source:   string
  declare width_px: number

  /**
   * Validated column.
   *
   * @param dna - Every field.
   * @returns A complete column.
   *
   * @example Column.fill({ label: 'clueing', title: 'Clueing', source: 'question.clueing', width_px: 330 })
   */
  static fill(dna: ColumnDNA): ColumnT {
    return ColumnValidators.column(dna)
  }
}

/**
 * What a source string names.
 *
 * @param source - A validated column source.
 * @returns A question field, a view of a question, or a widgeting by label, whole or one part of it.
 *
 * @example sourceOf('question.clueing')     // => { kind: 'field', field: 'clueing' }
 * @example sourceOf('dumdum')                // => { kind: 'widgeting', label: 'dumdum', part: null }
 * @example sourceOf('categories.masie')      // => { kind: 'widgeting', label: 'categories', part: 'masie' }
 */
export function sourceOf(source: string): Source {
  const prefix = `${QuestionWidgetLabel}.`
  if (! source.startsWith(prefix)) {
    const [label = source, partname] = source.split('.', 2)
    return { kind: 'widgeting', label, part: WidgetingPartVals.find((each) => each === partname) ?? null }
  }
  const fieldname = source.slice(prefix.length)
  const view = QuestionViewVals.find((each) => each === fieldname)
  if (view) { return { kind: 'view', view } }
  return { kind: 'field', field: QuestionFieldVals.find((each) => each === fieldname) ?? 'title' }
}

/**
 * The source string of a column showing the widgeting labelled `label`, whole, or one part of it.
 *
 * @example widgetingSourceOf('categories', null)     // => 'categories'
 * @example widgetingSourceOf('categories', 'poppy')  // => 'categories.poppy'
 */
export function widgetingSourceOf(label: string, part: WidgetingPart | null): string {
  return part === null ? label : `${label}.${part}`
}

/**
 * The label of the widgeting `source` shows, whole or one part of it; null when it shows a
 * question's own field or view.
 *
 * @example widgetingLabelOf('categories.average')  // => 'categories'
 * @example widgetingLabelOf('question.title')      // => null
 */
export function widgetingLabelOf(source: string): string | null {
  const named = sourceOf(source)
  return named.kind === 'widgeting' ? named.label : null
}

/**
 * The label and title a new column showing `source` takes when the author gives neither: a
 * question's field or view under its own name and usual header, a widgeting under its label,
 * titleized, and one part of a widgeting under both their names, headed by the part's.
 *
 * @param source - A validated column source.
 * @returns The label and the title.
 *
 * @example namesFor('question.chains_to')  // => { label: 'chains_to', title: 'Chains to' }
 * @example namesFor('clueing_full')        // => { label: 'clueing_full', title: 'Clueing Full' }
 * @example namesFor('categories.masie')    // => { label: 'categories_masie', title: 'Masie' }
 */
export function namesFor(source: string): { label: string, title: string } {
  const named = sourceOf(source)
  switch (named.kind) {
  case 'field': {
    return { label: named.field, title: QuestionSourceTitles[named.field] }
  }
  case 'view': {
    return { label: named.view, title: QuestionSourceTitles[named.view] }
  }
  case 'widgeting': {
    if (named.part !== null) { return { label: `${named.label}_${named.part}`, title: WidgetingPartTitles[named.part] } }
    return { label: named.label, title: Labelmaker.titleize(named.label) }
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
