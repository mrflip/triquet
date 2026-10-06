import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { mintId } from '../lib/ids'
import * as Labelmaker from '../lib/labelmaker'
import * as PA from '../lib/vv/patterns'
import { Question, QuestionValidators, type QuestionT } from './question'
import { ColumnValidators, sourceOf, type ColumnSortkey, type ColumnT } from './column'
import { WidgetingValidators, type WidgetingT } from './widgeting'

/** The one ordering a quiz can have been committed into that is not a column's */
export const ChainOrderSortkey = 'chain_order'

/** A column's order, or the order the chains walk */
export type Sortkey = typeof ChainOrderSortkey | ColumnSortkey

/** How many blank questions a new quiz opens with, so the grid is never an empty void */
export const BlankQuestionQty = 5

/** What every quiz's LL export puts ahead of its first question when going live, until a smith rewrites it */
export const DefaultQ1Preamble = 'Important: Read the smith\'s note before you play![br][br]'

export const QuizValidators = Validator(({ obj, arr, lit, union, zod, titleish, noteish, label, bool, stamps, timestamp, zid, treeid }) => {
  const columnSortkey = zod.templateLiteral(['column:', label])
  const sortkey = union([lit(ChainOrderSortkey), columnSortkey])
    .describe('Which column or ordering last committed the quiz to its current order. Purely a label: it is remembered so that header can stay bold as a reminder of how the questions came to be in this order, and it never re-sorts anything on load.')

  const quizLabel = label
    .describe('A freeform-editable local identifier, generated once at creation. Meant to become the quiz\'s URL route.')

  const smiths_note = noteish
    .describe('What the smiths want to say about the quiz as a whole: its theme, its meta, what is left to do. Several paragraphs if need be; kept trimmed.')

  const q1_preamble = noteish
    .describe('What the LL export puts ahead of the first question when the quiz goes live, in the league\'s BBCode: a pointer to the smith\'s note, which the league\'s site shows apart from the questions. Kept trimmed.')

  const quiz = obj({
    _id:             treeid,
    title:           titleish.default('')
      .describe('What the author calls this quiz. Shown in the switcher, in the browser tab title, and as the heading; an empty title displays as "Untitled quiz" without ever being rewritten to that on disk.'),
    label:           quizLabel.default(() => Labelmaker.localBlankLabel(new Set(), mintId())),
    smiths_note:     smiths_note.default(''),
    q1_preamble:     q1_preamble.default(DefaultQ1Preamble),
    questions:       arr(QuestionValidators.question).max(PA.QuestionsPerQuiz.max).default([])
      .describe('The questions, in their committed display order. This array IS the order: sorting and dragging rewrite it, so the arrangement survives a reload exactly as it was left. At most 999.'),
    widgetings:      arr(WidgetingValidators.widgeting).max(PA.WidgetingsPerQuiz.max).default([])
      .describe('The widgets this quiz puts to work, each under a label of its own, in run order: each one reads what those before it came to. At most 99.'),
    columns:         arr(ColumnValidators.column).max(PA.ColumnsPerQuiz.max).default([])
      .describe('The columns of this quiz\'s grid, in the order they appear. Kept apart from the widgetings: a column says what to show and how wide, and a widgeting is what has a value. At most 99.'),
    locked:          bool.default(false)
      .describe('When true this quiz accepts no edits at all -- a finished draft sent out for playtesting, kept readable and copyable but frozen against accidental change.'),
    last_sortkey:    sortkey.nullable().default(null),
    created_at:      timestamp.nullable().default(null)
      .describe('When the quiz was made, in epoch milliseconds, as its row is stamped; null for one built rather than read.'),
    updated_at:      timestamp.nullable().default(null)
      .describe('When the quiz\'s own row was last edited (its fields, or its questions\' order), in epoch milliseconds; null where `created_at` is.'),
  })
    .check((context) => {
      for (const issue of integrityIssues(context.value)) { context.issues.push({ code: 'custom', ...issue }) }
    })
    .describe('One trivia quiz. Chain integrity and column labels are checked here rather than on the question or the column, because each is only meaningful relative to its siblings.')

  const row = obj({
    hunt_id:         zid('hunts')
      .describe('The hunt its realm belongs to, copied from the realm when the quiz is made: a quiz never moves between hunts.'),
    realm_id:        zid('realms')
      .describe('The realm this quiz belongs to.'),
    title:           titleish,
    label:           quizLabel,
    smiths_note,
    q1_preamble,
    locked:          bool,
    last_sortkey:    sortkey.nullable(),
    row_ordering:    arr(zid('questions')).max(PA.QuestionsPerQuiz.max)
      .describe('The quiz\'s questions in their committed order, by row id: the order is the quiz\'s, not the questions\'. Every question of the quiz is here once.'),
    ...stamps,
  })
    .describe('One quiz as the database holds it: its own fields, with its questions, widgetings and columns in rows of their own.')

  return { sortkey, smiths_note, q1_preamble, quiz, row }
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
 * chain that dangles, two widgetings or two columns with one label, a column showing a widgeting
 * that is not there.
 */
function integrityIssues(quiz: Pick<QuizT, 'questions' | 'widgetings' | 'columns'>): Issue[] {
  const questionIds = new Set(quiz.questions.map((question) => question._id))
  const widgetingLabels = new Set(quiz.widgetings.map((widgeting) => widgeting.label))
  const chainIssues = quiz.questions.flatMap((question, idx): Issue[] => {
    if (! question.chains_to) { return [] }
    const path = ['questions', idx, 'chains_to']
    if (question.chains_to === question._id) { return [{ input: question.chains_to, path, message: 'A question cannot chain to itself' }] }
    return questionIds.has(question.chains_to) ? [] : [{ input: question.chains_to, path, message: 'Chain target is not a question in this quiz' }]
  })
  const sourceIssues = quiz.columns.flatMap((column, idx): Issue[] => {
    const source = sourceOf(column.source)
    return source.kind === 'widgeting' && ! widgetingLabels.has(source.label)
      ? [{ input: column.source, path: ['columns', idx, 'source'], message: 'A column shows a widgeting this quiz does not have' }]
      : []
  })
  return [
    ...repeatIssues(quiz.questions, 'questions', (question) => question._id, '_id', 'Two questions in one quiz share an id'),
    ...repeatIssues(quiz.widgetings, 'widgetings', (widgeting) => widgeting.label, 'label', 'Two widgetings in one quiz share a label'),
    ...repeatIssues(quiz.columns, 'columns', (column) => column.label, 'label', 'Two columns in one quiz share a label'),
    ...sourceIssues,
    ...chainIssues,
  ]
}

export type QuizDNA       = Z.input<typeof QuizValidators.quiz>
export type QuizT         = Z.output<typeof QuizValidators.quiz>
export type QuizRowT      = Z.output<typeof QuizValidators.row>

/** One trivia quiz: a name, an ordered list of questions, and how it came to be in that order */
export class Quiz implements QuizT {
  declare _id:              string
  declare title:           string
  declare label:           string
  declare smiths_note:     string
  declare q1_preamble:     string
  declare questions:       QuestionT[]
  declare widgetings:      WidgetingT[]
  declare columns:         ColumnT[]
  declare locked:          boolean
  declare last_sortkey:    Sortkey | null
  declare created_at:      number | null
  declare updated_at:      number | null

  /**
   * The fields a quiz shows the outside world, alphabetically: its label, the
   * smith's note, and its title. Not the id; not the questions, widgetings and columns, which
   * are exposed on their own; not the LL export's preamble; and not the housekeeping -- lock,
   * remembered sort.
   */
  static readonly exposed = ['label', 'smiths_note', 'title'] as const

  /**
   * Whether `quiz` is locked: nothing in it changes until it is unlocked.
   *
   * @example if (Quiz.isLocked(quiz)) { return 'quizLocked' }
   */
  static isLocked(quiz: Pick<QuizRowT, 'locked'>): boolean {
    return quiz.locked
  }

  /**
   * Validated quiz, with every omitted field defaulted and its chains checked. A blank title is
   * populated from the label, titleized, so a fresh quiz reads as "Quiet Otter" rather than
   * nothing at all.
   *
   * @param dna - At minimum an id.
   * @returns A complete quiz.
   * @throws When two questions share an id, or a chain dangles or points at itself, two widgetings or two columns share a label, or a column shows a widgeting that is not there.
   *
   * @example Quiz.fill({ _id: mintId(), title: 'Quiz one' })
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
      _id:       mintId(),
      title,
      questions: Array.from({ length: BlankQuestionQty }, () => Question.blank()),
      ...(label !== undefined && { label }),
    })
  }

  /**
   * A fresh quiz's own row in the realm `place` names, holding no questions yet: what `insertQuiz`
   * writes first, before the questions that need its id.
   *
   * @param place - The realm it belongs to, and that realm's hunt.
   * @param title - What to call it; blank means its label, titleized.
   * @param label - The label it starts under; one is generated when omitted.
   * @returns The row to insert.
   *
   * @example Quiz.blankRow({ hunt_id, realm_id }, '', 'princes').title  // => 'Princes'
   */
  static blankRow({ hunt_id, realm_id }: Pick<QuizRowT, 'hunt_id' | 'realm_id'>, title = '', label: string = Labelmaker.localBlankLabel(new Set(), mintId())): QuizRowT {
    return QuizValidators.row({
      hunt_id, realm_id, title: title === '' ? Labelmaker.titleize(label) : title, label, smiths_note: '', q1_preamble: DefaultQ1Preamble,
      locked: false, last_sortkey: null, row_ordering: [],
    })
  }
}
