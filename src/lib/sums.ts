import * as Rank from './rank'
import type { IshesT } from '../models/ish'
import type { QuestionT } from '../models/question'

/** The eight derived numeric columns, in the order they appear */
export const SumColkeyVals = [
  'clueing_plus_rank', 'clueing_full', 'clueing_numeral',
  'butnot_full', 'butnot_numeral', 'hint_full', 'hint_numeral', 'clueing_plus_butnot_full',
] as const
export type SumColkey = typeof SumColkeyVals[number]

/**
 * One sum as the grid shows it: a whole number, or nothing at all.
 *
 * `null` is not zero. A sum with nothing behind it reads as a muted dash, because "nobody has
 * extracted this yet" and "the answer is nought" are different facts about a clue.
 */
export type SumReading = {
  total: number | null
  /** True when the text this was derived from has been edited since it was extracted */
  stale: boolean
}

export type QuestionSums = Record<SumColkey, SumReading>

/** Every question's sums, by id */
export type SumsForId = ReadonlyMap<string, QuestionSums>

const Nothing: SumReading = { total: null, stale: false }

/** Eight empty readings, for a question the quiz does not hold */
export const EmptySums: QuestionSums = Object.fromEntries(
  SumColkeyVals.map((colkey) => [colkey, Nothing]),
) as QuestionSums

/**
 * Every sum in the quiz, derived on demand and stored nowhere.
 *
 * The four columns that mirror a chained question borrow the chained-to question's own hint
 * extraction. Nothing about a hint is ever computed twice: it is extracted once on the question
 * whose answer it disguises, and borrowed everywhere else -- staleness included, so a stale hint
 * greys out the sums on the question that chains to it as well as its own.
 *
 * @param questions - The quiz's questions.
 * @returns Each question's eight sums, by id.
 *
 * @example sumsForQuiz(quiz.questions).get(question.id)?.clueing_full.total
 */
export function sumsForQuiz(questions: readonly QuestionT[]): SumsForId {
  const ranks = Rank.ranksOf(questions)
  const questionForId = new Map(questions.map((question) => [question.id, question]))
  return new Map(questions.map((question) => {
    const target = question.chains_to === null ? null : questionForId.get(question.chains_to) ?? null
    return [question.id, sumsFor(question, target, ranks.get(question.id) ?? null)]
  }))
}

/**
 * One question's eight sums.
 *
 * @param question - The question being read.
 * @param chainTarget - The question it chains to, whose hint supplies the BUT NOT columns.
 * @param rank - Its 1-based position in Q# order, or null when unranked.
 * @returns The eight readings.
 */
export function sumsFor(question: QuestionT, chainTarget: QuestionT | null, rank: number | null): QuestionSums {
  const clueing = totalsOf(question.clueing_ishes)
  const hint    = totalsOf(question.hint_ishes)
  const butnot  = totalsOf(chainTarget?.hint_ishes ?? null)

  return {
    clueing_full:             clueing.full,
    clueing_numeral:          clueing.numeral,
    hint_full:                hint.full,
    hint_numeral:             hint.numeral,
    butnot_full:              butnot.full,
    butnot_numeral:           butnot.numeral,
    clueing_plus_rank:        added(clueing.full, rank === null ? Nothing : { total: rank, stale: false }),
    clueing_plus_butnot_full: added(clueing.full, butnot.full),
  }
}

/**
 * The full and digits-only totals one extraction offers.
 *
 * @param ishes - An extraction, or null when it has never been asked for.
 * @returns Two readings; both empty unless the extraction succeeded.
 */
function totalsOf(ishes: IshesT): { full: SumReading, numeral: SumReading } {
  if (ishes?.status !== 'done') { return { full: Nothing, numeral: Nothing } }
  const numerals = ishes.items.filter((item) => item.kind === 'numeral')
  return {
    // Sums round to whole numbers; the items themselves keep their fractions.
    full:    { total: Math.round(sumOf(ishes.items)), stale: ishes.stale },
    numeral: { total: Math.round(sumOf(numerals)),    stale: ishes.stale },
  }
}

/** Two readings added, or nothing when either half is missing */
function added(aa: SumReading, bb: SumReading): SumReading {
  if (aa.total === null || bb.total === null) { return Nothing }
  return { total: aa.total + bb.total, stale: aa.stale || bb.stale }
}

/** What the items add up to, before rounding */
function sumOf(items: readonly { value: number }[]): number {
  return items.reduce((acc, item) => acc + item.value, 0)
}
