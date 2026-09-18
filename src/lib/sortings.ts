import { qnumOf } from './rank'
import { SumColkeyVals, sumsForRound, type SumColkey } from './sums'
import type { Sortkey } from '../models/quiz'
import type { IshesT } from '../models/ish'
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
 * @example sortQuestions(questions, (question) => question.title, false)
 */
export function sortQuestions(questions: readonly QuestionT[], valueOf: SortValueOf, descending: boolean): QuestionT[] {
  const seats = new Map(questions.map((question, idx) => [question.id, idx]))
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
 * A sum nobody has computed yet reads as absent, which sinks that question to the bottom in
 * either direction -- the honest reading of "nothing here has been computed yet".
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
  case 'title': {
    return (question) => question.title
  }
  case 'chains_to': {
    const answerForId = new Map(questions.map((question) => [question.id, question.title]))
    return (question) => (question.chains_to === null ? null : answerForId.get(question.chains_to) ?? null)
  }
  case 'chain_order': {
    // Not a column: "Sort by chain order" walks the graph rather than reading a value.
    return () => null
  }
  case 'clueing_ishes': {
    return (question) => ishCountOf(question.clueing_ishes)
  }
  case 'hint_ishes': {
    return (question) => ishCountOf(question.hint_ishes)
  }
  case 'butnot_ishes': {
    const questionForId = new Map(questions.map((question) => [question.id, question]))
    return (question) => {
      const target = question.chains_to === null ? null : questionForId.get(question.chains_to)
      return ishCountOf(target?.hint_ishes ?? null)
    }
  }
  default: {
    const sums = sumsForRound(questions)
    const sumColkey: SumColkey = sortkey
    return (question) => sums.get(question.id)?.[sumColkey].total ?? null
  }
  }
}

/** The eight sum columns, for the exhaustiveness check above */
export const SumSortkeys: readonly SumColkey[] = SumColkeyVals

/**
 * How many spans an extraction found, or null when it never ran.
 *
 * A list column has no single value to order by, so it orders by how much it found. An empty
 * result is a real answer and sorts as nought; a cell nobody has asked about sinks.
 */
function ishCountOf(ishes: IshesT): number | null {
  return ishes?.status === 'done' ? ishes.items.length : null
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
