import * as Z from 'zod'
import { Validator } from '../lib/validator'
import * as PA from '../lib/vv/patterns'
import { QuestionWidgetLabel } from './widget'

/** The question fields a column can show and edit */
export const QuestionFieldVals = ['title', 'clueing', 'hint', 'chains_to', 'qnum', 'alt_text', 'notes', 'full_answer'] as const
export type QuestionField = typeof QuestionFieldVals[number]

/** Read-only things a column can show that are worked out from a question and the one it chains to */
export const QuestionViewVals = ['butnot', 'butnot_ishes'] as const
export type QuestionView = typeof QuestionViewVals[number]

/** What a column shows: a question field, a view of a question, or a widget's value */
export type Source =
  | { kind: 'field', field: QuestionField }
  | { kind: 'view', view: QuestionView }
  | { kind: 'widget', label: string }

/** The smallest and largest a column may be, in pixels */
export const WidthPxMin = 30
export const WidthPxMax = 800

const QuestionSourcePattern = String.raw`${QuestionWidgetLabel}\.(${[...QuestionFieldVals, ...QuestionViewVals].join('|')})`
const SourceRe = new RegExp(`^(${QuestionSourcePattern}|${PA.Label.re.source.replace(/^\^/, '').replace(/\$$/, '')})$`)

export const ColumnValidators = Validator(({ obj, str, titleish, label, int, uint, rowid }) => {
  const columnLabel = label
    .describe('What the column is called within its quiz, unique there. It names the column in an export and in the quiz\'s sort memory.')
  const source = str.regex(SourceRe, 'should be `question.<field>`, `question.<view>`, or the label of a widget')
    .refine((val) => val !== QuestionWidgetLabel, 'the questions\' own widget has no value of its own; name one of its fields')
    .describe('What the column shows: `question.title` and the like for a question\'s own field, `question.butnot` for a view of it, or a widget\'s label for that widget\'s value.')

  const column = obj({
    label:    columnLabel,
    title:    titleish
      .describe('The header the grid shows.'),
    source,
    width_px: int.min(WidthPxMin).max(WidthPxMax)
      .describe('How wide the column is. The grid\'s layout is fixed, so nothing a cell holds can widen it.'),
  })
    .describe('One column of a quiz\'s grid. A quiz keeps its columns in a list, which is the order they appear in, apart from its widgets: a column only says what to show, and where.')

  const columnPatch = obj({
    label:    columnLabel.optional(),
    title:    titleish.optional(),
    source:   source.optional(),
    width_px: int.min(WidthPxMin).max(WidthPxMax).optional(),
  })
    .describe('The fields of one column being revised. A key absent means "leave whatever is already there".')

  const row = obj({
    quiz_id:  rowid
      .describe('The quiz this column belongs to.'),
    ...column.shape,
    position: uint
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
 * @returns A question field, a view of a question, or a widget by label.
 *
 * @example sourceOf('question.clueing')  // => { kind: 'field', field: 'clueing' }
 * @example sourceOf('dumdum')             // => { kind: 'widget', label: 'dumdum' }
 */
export function sourceOf(source: string): Source {
  const prefix = `${QuestionWidgetLabel}.`
  if (! source.startsWith(prefix)) { return { kind: 'widget', label: source } }
  const fieldname = source.slice(prefix.length)
  const view = QuestionViewVals.find((each) => each === fieldname)
  if (view) { return { kind: 'view', view } }
  return { kind: 'field', field: QuestionFieldVals.find((each) => each === fieldname) ?? 'title' }
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
