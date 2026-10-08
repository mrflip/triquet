import * as Rank from './rank'
import * as Runner from './formulary/runner'
import { shownOf, specFor, type ColumnSpec } from './columns'
import { columnLabelOf } from '../models/column'
import type { QuizT, Sortkey } from '../models/quiz'
import type { QuestionT } from '../models/question'
import type { JsonT, WidgetedT } from '../models/widgeted'

/** What a column offers the sorter: a number, a string, or nothing at all */
export type SortValue = string | number | null

/** How a column reads one question */
export type SortValueOf = (question: QuestionT) => SortValue

/**
 * `questions` reordered by what `valueOf` reads from each.
 *
 * Questions with no value for the sorted column sink to the bottom in *both* directions: "no
 * Hint Full Sum yet" is not a small number, it is an absence, and it belongs at the end either
 * way. Ties are settled by putting an alternate (a secondary question) after its peers, and then
 * by where the questions already sit, so a sort never shuffles indistinguishable rows. Text sorts case-insensitively and locale-aware.
 *
 * @param questions - The quiz's questions, in their committed display order.
 * @param valueOf - How the sorted column reads one question.
 * @param descending - Whether to reverse the present values; absences stay at the bottom.
 * @returns A new array; the input is left alone.
 *
 * @example sortQuestions(questions, (question) => question.title, false)
 */
export function sortQuestions(questions: readonly QuestionT[], valueOf: SortValueOf, descending: boolean): QuestionT[] {
  const seats = new Map(questions.map((question, idx) => [question._id, idx]))
  const seatOf = (question: QuestionT) => seats.get(question._id) ?? 0

  return questions.toSorted((aa, bb) => {
    const aaVal = valueOf(aa)
    const bbVal = valueOf(bb)
    const tiebreak = () => Rank.alternatesLast(aa, bb) || seatOf(aa) - seatOf(bb)
    if (isAbsent(aaVal) && isAbsent(bbVal)) { return tiebreak() }
    if (isAbsent(aaVal)) { return 1 }
    if (isAbsent(bbVal)) { return -1 }
    const order = compareValues(aaVal, bbVal)
    if (order === 0) { return tiebreak() }
    return descending ? -order : order
  })
}

/**
 * How a given column reads a question, for the quiz it belongs to.
 *
 * A column with nothing to show for a question reads as absent, which sinks that question to
 * the bottom in either direction -- the honest reading of "nothing here has been computed yet".
 * A sort memory that names no column of the quiz, or a column that cannot be ordered, reads
 * everything as absent and so leaves the order alone.
 *
 * @param sortkey - Which column was clicked.
 * @param quiz - The quiz's questions, columns and widgetings.
 * @param run - The quiz, run: what each widgeting came to, for a column that shows one.
 * @returns A reader for that column.
 */
export function sortValueFor(sortkey: Sortkey, quiz: Pick<QuizT, 'questions' | 'columns' | 'widgetings' | 'templateable'>, run: Runner.QuizRun): SortValueOf {
  const label = columnLabelOf(sortkey)
  const column = quiz.columns.find((each) => each.label === label)
  const spec = column ? specFor(column, quiz.widgetings) : null
  if (! spec) { return () => null }
  return readerFor(spec, quiz.questions, run, quiz.templateable)
}

/**
 * How a column reads one question: a question's own field as it orders (Q# by its number, a
 * chain by its target's title), and anything else by what the column came to, through its formula
 * when it has one (`shownOf`), never by how it is drawn.
 */
function readerFor(spec: Pick<ColumnSpec, 'source' | 'formula'>, questions: readonly QuestionT[], run: Runner.QuizRun, templateable: readonly string[]): SortValueOf {
  const { source } = spec
  const shown: SortValueOf = (question) => sortValueOf(shownOf(spec, run, templateable, question._id))
  if (spec.formula !== null) { return shown }
  const questionForId = new Map(questions.map((question) => [question._id, question]))
  const targetOf = (question: QuestionT) => (question.chains_to === null ? null : questionForId.get(question.chains_to) ?? null)
  switch (source.kind) {
  case 'field': {
    if (source.field === 'qnum') { return Rank.qnumOf }
    if (source.field === 'title') { return (question) => question.title }
    if (source.field === 'chains_to') { return (question) => targetOf(question)?.title ?? null }
    return () => null
  }
  case 'view':
  case 'word': {
    return () => null
  }
  case 'key':
  case 'widgeting': {
    return shown
  }
  }
}

/**
 * What a sort reads from one widgeted's value: numbers and text as they are, a boolean as 0 or 1,
 * a list by how many items it holds, and an object of one key as what that key holds -- the shape
 * a prompt gives when it is asked for one thing, since a model's reply is always an object.
 * Anything else has no single value to order by: null, empty text, an object of several keys, a
 * failure or nothing at all sinks to the bottom in either direction.
 *
 * @param widgeted - One cell's widgeted.
 * @returns A value the sorter can compare, or null.
 *
 * @example sortValueOf({ status: 'ok', value: true, err: null })  // => 1
 * @example sortValueOf({ status: 'ok', value: { items: [{}, {}] }, err: null })  // => 2
 * @example sortValueOf({ status: 'missing', value: null, err: null })  // => null
 */
export function sortValueOf(widgeted: WidgetedT): SortValue {
  if (widgeted.status !== 'ok') { return null }
  const value = orderedBy(widgeted.value)
  if (typeof value === 'boolean') { return Number(value) }
  if (typeof value === 'string' || typeof value === 'number') { return value }
  return null
}

/** What a value is ordered by before it is read as a number or text: an object of one key by what it holds, a list by its length, else itself */
function orderedBy(value: JsonT): JsonT {
  const members = membersOf(value)
  return members?.length === 1 ? orderedBy(members[0] ?? null) : value
}

/** What a value is ordered through: an object's members, or a list's length, as one; null for a scalar */
function membersOf(value: JsonT): JsonT[] | null {
  if (value === null || typeof value !== 'object') { return null }
  const members: JsonT[] = Array.isArray(value) ? [value.length] : Object.values(value)
  return members
}

/** Whether a column has nothing to say about this question */
function isAbsent(val: SortValue): val is null | '' {
  return val === null || val === ''
}

/** Numbers numerically, text case-insensitively and locale-aware */
function compareValues(aaVal: string | number, bbVal: string | number): number {
  if (typeof aaVal === 'number' && typeof bbVal === 'number') { return aaVal - bbVal }
  return String(aaVal).localeCompare(String(bbVal), undefined, { sensitivity: 'base' })
}
