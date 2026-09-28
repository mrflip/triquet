import * as Expressed from './expressed'
import * as Labelmaker from './labelmaker'
import * as UU from './useful'
import { BottingWidget, QuestionWidgetLabel, type WidgetT } from '../models/widget'
import { Question, type QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'

/** What a cell of an exposed column is worked out from */
type Context = {
  question:  QuestionT
  target:    QuestionT | null
  expressed: Expressed.ExpressedForQuiz
}

/** One field of one widget, shown to the outside world: a column of the table a quiz's git history keeps */
export type ExposedColumn = {
  /** The label of the widget the field belongs to: `question`, or one of the quiz's widgets */
  widget:   string
  field:    string
  /** `widget.field` */
  header:   string
  textOf:   (context: Readonly<Context>) => string
}

/** Compare by code unit, not by locale, so the order is the same wherever it is read */
function byCode(aa: string, bb: string): number {
  if (aa === bb) { return 0 }
  return aa < bb ? -1 : 1
}

/**
 * The columns a quiz's table has: every exposed field of every widget, the questions' own
 * widget and the quiz's bottings and expressings alike, ordered alphabetically by widget label
 * and then by field label.
 *
 * The order depends on nothing the author arranges -- not the grid's columns or their order, not
 * the order of the widgets -- so a change to one cell changes one cell of the table, and a diff
 * of it shows only that.
 *
 * @param quiz - The quiz, for its widgets.
 * @returns One column per exposed field.
 *
 * @example exposedColumnsOf(quiz).map((column) => column.header)  // => ['clueing_full.value', ..., 'question.clueing', ...]
 */
export function exposedColumnsOf(quiz: Pick<QuizT, 'widgets'>): ExposedColumn[] {
  const own = Question.exposed.map((field): ExposedColumn => column(QuestionWidgetLabel, field, (context) => questionText(field, context)))
  const widgets = quiz.widgets.flatMap((widget) => widgetColumns(widget))
  return [...own, ...widgets].toSorted((aa, bb) => byCode(aa.widget, bb.widget) || byCode(aa.field, bb.field))
}

/**
 * The quiz's table as tab-free rows of text: a header row, then one row per question in order of
 * label, so that dragging questions about moves no line of it.
 *
 * @param quiz - The quiz.
 * @param expressed - What its expressing widgets came to.
 * @returns The header and the rows; the rows are empty for a quiz with no questions.
 */
export function tableOf(quiz: Pick<QuizT, 'widgets' | 'questions'>, expressed: Expressed.ExpressedForQuiz): { header: string[], rows: string[][] } {
  const columns = exposedColumnsOf(quiz)
  const questionForId = new Map(quiz.questions.map((question) => [question._id, question]))
  const rows = quiz.questions
    .toSorted((aa, bb) => byCode(Labelmaker.effectiveLabelOf(aa), Labelmaker.effectiveLabelOf(bb)))
    .map((question) => {
      const target = question.chains_to === null ? null : questionForId.get(question.chains_to) ?? null
      return columns.map((each) => each.textOf({ question, target, expressed }))
    })
  return { header: columns.map((each) => each.header), rows }
}

/** One exposed field, headed `widget.field` */
function column(widget: string, field: string, textOf: ExposedColumn['textOf']): ExposedColumn {
  return { widget, field, header: `${widget}.${field}`, textOf }
}

/** A question's own field as text: its label the one in force, and its chain named by the target's label */
function questionText(field: typeof Question.exposed[number], { question, target }: Readonly<Context>): string {
  if (field === 'label') { return Labelmaker.effectiveLabelOf(question) }
  if (field === 'chains_to') { return target ? Labelmaker.effectiveLabelOf(target) : '' }
  return question[field]
}

/** The exposed columns of one widget */
function widgetColumns(widget: WidgetT): ExposedColumn[] {
  if (widget.kind === 'expressing') {
    return [column(widget.label, 'value', ({ question, expressed }) => {
      const reading = Expressed.readingOf(expressed, widget.label, question._id)
      return reading.status === 'value' ? String(reading.val) : ''
    })]
  }
  const { field } = BottingWidget.slotOf(widget)
  return BottingWidget.exposed(widget).map((fieldname) => column(widget.label, fieldname, ({ question }) => playedText(question, field, fieldname)))
}

/** One exposed field of what a bot answered, as text; nothing when it was never asked */
function playedText(question: QuestionT, field: 'guess' | 'clueing_ishes' | 'hint_ishes', fieldname: string): string {
  const held = question[field]
  if (held === null) { return '' }
  if (fieldname === 'status') { return held.status }
  if (held.status !== 'done') { return '' }
  if (fieldname === 'text' && 'text' in held) { return held.text }
  if (fieldname === 'items' && 'items' in held) { return UU.jsonify(held.items) }
  if (fieldname === 'stale' && 'stale' in held) { return String(held.stale) }
  return ''
}
