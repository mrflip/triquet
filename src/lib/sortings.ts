import { qnumOf } from './rank'
import type { Sortkey } from '../models/quiz'
import type { QuestionT } from '../models/question'

/** What a column offers the sorter: a number, a string, or nothing at all */
export type SortValue = string | number | null

/** How a column reads one question */
export type SortValueOf = (question: QuestionT) => SortValue

/**
 * `questions` reordered by what `valueOf` reads from each.
 *
 * Questions with no value for the sorted column sink to the bottom in *both* directions: "no
 * Hint Full Sum yet" is not a small number, it is an absence, and it belongs at the end either
 * way. Ties are settled by where the questions already sit, so a sort never shuffles
 * indistinguishable rows. Text sorts case-insensitively and locale-aware.
 *
 * @param questions - The round's questions, in their committed display order.
 * @param valueOf - How the sorted column reads one question.
 * @param descending - Whether to reverse the present values; absences stay at the bottom.
 * @returns A new array; the input is left alone.
 *
 * @example sortQuestions(questions, (question) => question.short_answer, false)
 */
export function sortQuestions(questions: readonly QuestionT[], valueOf: SortValueOf, descending: boolean): QuestionT[] {
  const seats = new Map(questions.map((question, ii) => [question.id, ii]))
  const seatOf = (question: QuestionT) => seats.get(question.id) ?? 0

  return questions.toSorted((aa, bb) => {
    const aaVal = valueOf(aa)
    const bbVal = valueOf(bb)
    if (isAbsent(aaVal) && isAbsent(bbVal)) { return seatOf(aa) - seatOf(bb) }
    if (isAbsent(aaVal)) { return 1 }
    if (isAbsent(bbVal)) { return -1 }
    const order = compareValues(aaVal, bbVal)
    if (order === 0) { return seatOf(aa) - seatOf(bb) }
    return descending ? -order : order
  })
}

/**
 * How a given column reads a question, for the round it belongs to.
 *
 * Columns whose numbers only exist once M5 has run read as absent until then, which sinks every
 * question to the bottom and leaves the order alone -- the honest reading of "nothing here has
 * been computed yet".
 *
 * @param sortkey - Which column was clicked.
 * @param questions - The round's questions, for columns that read across questions.
 * @returns A reader for that column.
 */
export function sortValueFor(sortkey: Sortkey, questions: readonly QuestionT[]): SortValueOf {
  switch (sortkey) {
  case 'qnum': {
    return qnumOf
  }
  case 'short_answer': {
    return (question) => question.short_answer
  }
  case 'chains_to': {
    const answerForId = new Map(questions.map((question) => [question.id, question.short_answer]))
    return (question) => (question.chains_to === null ? null : answerForId.get(question.chains_to) ?? null)
  }
  default: {
    return () => null
  }
  }
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
