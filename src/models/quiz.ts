import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { mintId } from '../lib/ids'
import * as Labelmaker from '../lib/labelmaker'
import { AskValidators } from './ask'
import { Question, QuestionValidators, type QuestionT } from './question'
import { ColumnValidators, sourceOf, type ColumnSortkey, type ColumnT } from './column'
import { QuestionWidgetLabel, WidgetValidators, type WidgetT } from './widget'

/** The one ordering a quiz can have been committed into that is not a column's */
export const ChainOrderSortkey = 'chain_order'

/** A column's order, or the order the chains walk */
export type Sortkey = typeof ChainOrderSortkey | ColumnSortkey

/** How many blank questions a new quiz opens with, so the grid is never an empty void */
export const BlankQuestionQty = 5

/** The version every quiz starts on, and so the branch its history begins on */
export const DefaultVersion = 'main'

export const QuizValidators = Validator(({ obj, arr, lit, union, zod, titleish, label, bool, uint, timestamp, rowid, treeid }) => {
  const columnSortkey = zod.templateLiteral(['column:', label])
  const sortkey = union([lit(ChainOrderSortkey), columnSortkey])
    .describe('Which column or ordering last committed the quiz to its current order. Purely a label: it is remembered so that header can stay bold as a reminder of how the questions came to be in this order, and it never re-sorts anything on load.')

  const quizLabel = label
    .describe('A freeform-editable local identifier, generated once at creation. Meant to become the quiz\'s URL route.')
  const forced_label = label.nullable()
    .describe('An author-chosen label overriding the generated one, or null to keep the generated one.')

  const version = label
    .describe('Which line of work the quiz is currently on, and the name of the git branch its history is committed to. Shares the `label` shape, which is a strict subset of what git accepts in a ref, so a version an author can type is always a branch git will take.')

  const bulkIshesRun = obj({
    approx_tokens: AskValidators.approxTokens,
    text_count:    uint
      .describe('How many texts went into that one batched request, so "~4,200 tok last time (28 texts)" reads as a cost per run rather than a mystery number.'),
    updated_at:    timestamp,
  }).nullable()
    .describe('What the last "Recalculate all ishes" run cost, kept per quiz. Never cleared by, and never clears, an individual cell\'s own token figure.')

  const quiz = obj({
    id:              treeid,
    title:           titleish.default('')
      .describe('What the author calls this quiz. Shown in the switcher, in the browser tab title, and as the heading; an empty title displays as "Untitled quiz" without ever being rewritten to that on disk.'),
    label:           quizLabel.default(() => Labelmaker.localBlankLabel(new Set(), mintId())),
    forced_label:    forced_label.default(null),
    version:         version.default(DefaultVersion),
    questions:       arr(QuestionValidators.question).default([])
      .describe('The questions, in their committed display order. This array IS the order: sorting and dragging rewrite it, so the arrangement survives a reload exactly as it was left.'),
    widgets:         arr(WidgetValidators.widget).default([])
      .describe('What this quiz can show for every question besides the questions\' own fields: the bots put to it, and the expressions put to work. Their order is the order they are listed in.'),
    columns:         arr(ColumnValidators.column).default([])
      .describe('The columns of this quiz\'s grid, in the order they appear. Kept apart from the widgets: a column says what to show and how wide, and a widget is what has a value.'),
    locked:          bool.default(false)
      .describe('When true this quiz accepts no edits at all -- a finished draft sent out for playtesting, kept readable and copyable but frozen against accidental change.'),
    last_sortkey:    sortkey.nullable().default(null),
    bulk_ishes_last: bulkIshesRun.default(null),
  })
    .check((context) => {
      for (const issue of integrityIssues(context.value)) { context.issues.push({ code: 'custom', ...issue }) }
    })
    .describe('One trivia quiz. Chain integrity and column labels are checked here rather than on the question or the column, because each is only meaningful relative to its siblings.')

  const row = obj({
    workspace_id:    rowid
      .describe('The workspace this quiz belongs to.'),
    title:           titleish,
    label:           quizLabel,
    forced_label,
    version,
    locked:          bool,
    last_sortkey:    sortkey.nullable(),
    bulk_ishes_last: bulkIshesRun,
  })
    .describe('One quiz as the database holds it: its own fields, with its questions, widgets and columns in rows of their own.')

  return { sortkey, bulkIshesRun, quiz, row }
})

/** One thing wrong with a quiz, and where */
type Issue = { input: unknown, path: (string | number)[], message: string }

/** Every item of `items` whose key an earlier one already had */
function repeatIssues<TT>(items: readonly TT[], listkey: string, keyOf: (item: TT) => string, fieldkey: string, message: string): Issue[] {
  const seen = new Set<string>()
  return items.flatMap((item, idx) => {
    const key = keyOf(item)
    const repeated = seen.has(key)
    seen.add(key)
    return repeated ? [{ input: key, path: [listkey, idx, fieldkey], message }] : []
  })
}

/**
 * Everything that is only wrong relative to a quiz's own siblings: two questions with one id, a
 * chain that dangles, two widgets or two columns with one label, a widget labelled as the
 * questions are, a column showing a widget that is not there.
 */
function integrityIssues(quiz: Pick<QuizT, 'questions' | 'widgets' | 'columns'>): Issue[] {
  const questionIds = new Set(quiz.questions.map((question) => question.id))
  const widgetLabels = new Set(quiz.widgets.map((widget) => widget.label))
  const chainIssues = quiz.questions.flatMap((question, idx): Issue[] => {
    if (! question.chains_to) { return [] }
    const path = ['questions', idx, 'chains_to']
    if (question.chains_to === question.id) { return [{ input: question.chains_to, path, message: 'A question cannot chain to itself' }] }
    return questionIds.has(question.chains_to) ? [] : [{ input: question.chains_to, path, message: 'Chain target is not a question in this quiz' }]
  })
  const reservedIssues = quiz.widgets.flatMap((widget, idx): Issue[] => (
    widget.label === QuestionWidgetLabel ? [{ input: widget.label, path: ['widgets', idx, 'label'], message: 'A widget cannot be labelled as the questions are' }] : []
  ))
  const sourceIssues = quiz.columns.flatMap((column, idx): Issue[] => {
    const source = sourceOf(column.source)
    return source.kind === 'widget' && ! widgetLabels.has(source.label)
      ? [{ input: column.source, path: ['columns', idx, 'source'], message: 'A column shows a widget this quiz does not have' }]
      : []
  })
  return [
    ...repeatIssues(quiz.questions, 'questions', (question) => question.id, 'id', 'Two questions in one quiz share an id'),
    ...repeatIssues(quiz.widgets, 'widgets', (widget) => widget.label, 'label', 'Two widgets in one quiz share a label'),
    ...repeatIssues(quiz.columns, 'columns', (column) => column.label, 'label', 'Two columns in one quiz share a label'),
    ...reservedIssues,
    ...sourceIssues,
    ...chainIssues,
  ]
}

export type BulkIshesRunT = Z.output<typeof QuizValidators.bulkIshesRun>
export type QuizDNA       = Z.input<typeof QuizValidators.quiz>
export type QuizT         = Z.output<typeof QuizValidators.quiz>

/** One trivia quiz: a name, an ordered list of questions, and how it came to be in that order */
export class Quiz implements QuizT {
  declare id:              string
  declare title:           string
  declare label:           string
  declare forced_label:    string | null
  declare version:         string
  declare questions:       QuestionT[]
  declare widgets:         WidgetT[]
  declare columns:         ColumnT[]
  declare locked:          boolean
  declare last_sortkey:    Sortkey | null
  declare bulk_ishes_last: BulkIshesRunT

  /**
   * The fields a quiz shows the outside world, alphabetically: its label (the one in force) and
   * its title. Not the id; not the questions, widgets and columns, which are exposed on their
   * own; and not the housekeeping -- version, lock, remembered sort, what a batch run cost.
   */
  static readonly exposed = ['label', 'title'] as const

  /**
   * Validated quiz, with every omitted field defaulted and its chains checked. A blank title is
   * populated from the label, titleized, so a fresh quiz reads as "Quiet Otter" rather than
   * nothing at all.
   *
   * @param dna - At minimum an id.
   * @returns A complete quiz.
   * @throws When two questions share an id, or a chain dangles or points at itself, two widgets or two columns share a label, or a column shows a widget that is not there.
   *
   * @example Quiz.fill({ id: mintId(), title: 'Quiz one' })
   */
  static fill(dna: QuizDNA): QuizT {
    const quiz = QuizValidators.quiz(dna)
    return quiz.title === '' ? { ...quiz, title: Labelmaker.titleize(quiz.label) } : quiz
  }

  /**
   * Fresh quiz under a newly minted id, holding `BlankQuestionQty` empty questions.
   *
   * @param title - What to call it; defaults to unnamed, which displays as "Untitled quiz".
   * @param label - The label it starts under; one is generated when omitted.
   * @returns A quiz ready to type into.
   *
   * @example Quiz.blank().questions.length  // => 5
   * @example Quiz.blank('', 'princes').label  // => 'princes'
   */
  static blank(title = '', label?: string): QuizT {
    return this.fill({
      id:        mintId(),
      title,
      questions: Array.from({ length: BlankQuestionQty }, () => Question.blank()),
      ...(label !== undefined && { label }),
    })
  }
}
