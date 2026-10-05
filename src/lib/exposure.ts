import * as Runner from './formulary/runner'
import { QuestionWidgetLabel } from '../models/column'
import { Question, type QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'
import { Widgeted } from '../models/widgeted'
import { Widgeting, type WidgetingT } from '../models/widgeting'

/** What a cell of an exposed column is worked out from */
type Context = {
  question:  QuestionT
  target:    QuestionT | null
  run:       Runner.QuizRun
}

/** One field of one widgeting, or of the questions themselves, shown to the outside world: a column of the table a quiz's git history keeps */
export type ExposedColumn = {
  /** Whose field it is: `question`, or one of the quiz's widgetings */
  owner:    string
  field:    string
  /** `owner.field` */
  header:   string
  textOf:   (context: Readonly<Context>) => string
}

/** Compare by code unit, not by locale, so the order is the same wherever it is read */
function byCode(aa: string, bb: string): number {
  if (aa === bb) { return 0 }
  return aa < bb ? -1 : 1
}

/**
 * The columns a quiz's table has: every exposed field of the questions themselves and of every
 * widgeting, ordered alphabetically by whose it is and then by field label.
 *
 * The order depends on nothing the author arranges -- not the grid's columns or their order, not
 * the run order -- so a change to one cell changes one cell of the table, and a diff of it shows
 * only that.
 *
 * @param quiz - The quiz, for its widgetings.
 * @returns One column per exposed field.
 *
 * @example exposedColumnsOf(quiz).map((column) => column.header)  // => ['clueing_full.status', 'clueing_full.value', ..., 'question.clueing', ...]
 */
export function exposedColumnsOf(quiz: Pick<QuizT, 'widgetings'>): ExposedColumn[] {
  const own = Question.exposed.map((field): ExposedColumn => column(QuestionWidgetLabel, field, (context) => questionText(field, context)))
  const widgetings = quiz.widgetings.flatMap((widgeting) => widgetingColumns(widgeting))
  return [...own, ...widgetings].toSorted((aa, bb) => byCode(aa.owner, bb.owner) || byCode(aa.field, bb.field))
}

/**
 * The quiz's table as tab-free rows of text: a header row, then one row per question in order of
 * label, so that dragging questions about moves no line of it.
 *
 * @param quiz - The quiz.
 * @param run - The quiz, run: what its widgetings came to.
 * @returns The header and the rows; the rows are empty for a quiz with no questions.
 */
export function tableOf(quiz: Pick<QuizT, 'widgetings' | 'questions'>, run: Runner.QuizRun): { header: string[], rows: string[][] } {
  const columns = exposedColumnsOf(quiz)
  const questionForId = new Map(quiz.questions.map((question) => [question._id, question]))
  const rows = quiz.questions
    .toSorted((aa, bb) => byCode(aa.label, bb.label))
    .map((question) => {
      const target = question.chains_to === null ? null : questionForId.get(question.chains_to) ?? null
      return columns.map((each) => each.textOf({ question, target, run }))
    })
  return { header: columns.map((each) => each.header), rows }
}

/** One exposed field, headed `owner.field` */
function column(owner: string, field: string, textOf: ExposedColumn['textOf']): ExposedColumn {
  return { owner, field, header: `${owner}.${field}`, textOf }
}

/** A question's own field as text: its label, and its chain named by the target's label */
function questionText(field: typeof Question.exposed[number], { question, target }: Readonly<Context>): string {
  if (field === 'label') { return question.label }
  if (field === 'chains_to') { return target ? target.label : '' }
  return question[field]
}

/** The exposed columns of one widgeting: its status, and its value as text */
function widgetingColumns(widgeting: WidgetingT): ExposedColumn[] {
  const { label } = widgeting
  return Widgeting.exposed.map((field) => column(label, field, ({ question, run }) => {
    const widgeted = Runner.widgetedOf(run, label, question._id)
    return field === 'status' ? widgeted.status : Widgeted.textOf(widgeted)
  }))
}
