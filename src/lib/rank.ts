import { Question, type QuestionT } from '../models/question'

/** A question's rank, by id; null for a question with no Q#, or one archived, which has no rank */
export type RankForId = ReadonlyMap<string, number | null>

/**
 * A question's Q# read as a number, or null when it is blank.
 *
 * @param question - The question to read.
 * @returns Its Q# as a number, or null when unranked.
 *
 * @example qnumOf({ qnum: '3.1' })  // => 3.1
 * @example qnumOf({ qnum: '' })     // => null
 */
export function qnumOf(question: Pick<QuestionT, 'qnum'>): number | null {
  if (question.qnum === '') { return null }
  const num = Number(question.qnum)
  return Number.isFinite(num) ? num : null
}

/**
 * Every question's rank: its 1-based position once the quiz is put in Q# order.
 *
 * Distinct from the Q# itself, which may be gappy, decimal, duplicated or blank. Rank is what
 * the exports number by and what the Clueing + Rank column adds, and it is recomputed on demand
 * rather than stored. An archived question is out of the running: it has no rank, and takes none
 * from the rest.
 *
 * @param questions - The quiz's questions, in any order.
 * @returns Each question's rank by id, null for the unranked.
 *
 * @example ranksOf([{ _id: 'aa', qnum: '4' }, { _id: 'bb', qnum: '1' }])  // => aa: 2, bb: 1
 */
export function ranksOf(questions: readonly QuestionT[]): RankForId {
  const ranks = new Map<string, number | null>(questions.map((question) => [question._id, null]))
  const ranked = questions.filter((question) => qnumOf(question) !== null && ! Question.isArchived(question)).toSorted(byQnumThenAnswer)
  for (const [ii, question] of ranked.entries()) { ranks.set(question._id, ii + 1) }
  return ranks
}

/**
 * `questions` in rank order: Q# ascending, blanks last, ties settled by putting an alternate (a
 * secondary question) after its peers, and then by title.
 *
 * This is the order every export uses, whatever the grid is currently sorted or dragged into.
 *
 * @param questions - The quiz's questions, in any order.
 * @returns A new array; the input is left alone.
 */
export function inRankOrder(questions: readonly QuestionT[]): QuestionT[] {
  return questions.toSorted(byQnumThenAnswer)
}

/**
 * `questions` with each Q# replaced by its rank among the current values -- `4, 3.3, 6, 1`
 * becomes `3, 2, 4, 1`, in place.
 *
 * Nothing moves. This is what makes the decimal trick work: slot a question in with `3.1`, then
 * tidy the numbers back to integers without disturbing a single question. Questions with no Q#,
 * and archived ones, are left alone.
 *
 * @param questions - The quiz's questions, in their committed display order.
 * @returns A new array in the same order, renumbered.
 */
export function renumberByRank(questions: readonly QuestionT[]): QuestionT[] {
  const ranks = ranksOf(questions)
  return questions.map((question) => {
    const rank = ranks.get(question._id) ?? null
    return rank === null ? question : { ...question, qnum: String(rank) }
  })
}

/**
 * `questions` renumbered by where they now sit: top is 1, and every question gets a Q#.
 *
 * This is what a drag does. Unlike renumbering by rank it adopts the questions that had no Q#
 * at all, which is how a blank question joins the sequence. An archived question, on no screen
 * to be dragged, keeps its Q#, and is not counted.
 *
 * @param questions - The quiz's questions, in their new order.
 * @returns A new array in the same order, numbered from 1.
 */
export function renumberByPosition(questions: readonly QuestionT[]): QuestionT[] {
  let seat = 0
  return questions.map((question) => {
    if (Question.isArchived(question)) { return question }
    seat += 1
    return { ...question, qnum: String(seat) }
  })
}

/**
 * `questions` with the one named lifted out and dropped at `onto_idx`.
 *
 * @param questions - The quiz's questions, in their committed display order.
 * @param question_id - Which question is being dragged.
 * @param onto_idx - Where it lands, counted in the list as it stands after the lift.
 * @returns A new array; the same one when the question is not there or would not move.
 */
export function moveQuestion(questions: readonly QuestionT[], question_id: string, onto_idx: number): QuestionT[] {
  const fromIdx = questions.findIndex((question) => question._id === question_id)
  if (fromIdx === -1) { return [...questions] }
  const lifted = [...questions]
  const [dragged] = lifted.splice(fromIdx, 1)
  if (! dragged) { return [...questions] }
  lifted.splice(Math.max(0, Math.min(onto_idx, lifted.length)), 0, dragged)
  return lifted
}

/**
 * Where a question dragged to `onto_idx` among the questions a screen shows (all but the archived)
 * lands among them all: just before the shown question it was dropped above, or at the very end.
 *
 * @param questions - The quiz's questions, archived ones and all, in their committed display order.
 * @param question_id - Which question is being dragged.
 * @param onto_idx - Where it lands among those shown, counted after the lift.
 * @returns Where it lands among them all, counted after the lift, as `moveQuestion` takes it.
 *
 * @example ontoIdxAmong([aa, archived, bb, cc], cc._id, 1)  // => 2: just above bb, so below the archived question the screen does not show
 */
export function ontoIdxAmong(questions: readonly QuestionT[], question_id: string, onto_idx: number): number {
  const lifted = questions.filter((question) => question._id !== question_id)
  const below = Question.unarchived(lifted)[onto_idx]
  return below ? lifted.indexOf(below) : lifted.length
}

/** Rank order: Q# ascending, blanks last and rankless, ties broken by putting alternates last, then by title */
function byQnumThenAnswer(aa: QuestionT, bb: QuestionT): number {
  const aaNum = qnumOf(aa)
  const bbNum = qnumOf(bb)
  if (aaNum === null && bbNum === null) { return 0 }
  if (aaNum === null) { return 1 }
  if (bbNum === null) { return -1 }
  if (aaNum !== bbNum) { return aaNum - bbNum }
  return alternatesLast(aa, bb) || aa.title.localeCompare(bb.title, undefined, { sensitivity: 'base' })
}

/**
 * The tiebreak of every sort: of two questions otherwise tied, an alternate (a secondary
 * question) comes after its peer; zero when neither or both are.
 *
 * @example alternatesLast({ viz: 'secondary' }, { viz: 'normal' })  // => 1
 */
export function alternatesLast(aa: Pick<QuestionT, 'viz'>, bb: Pick<QuestionT, 'viz'>): number {
  return Number(Question.isSecondary(aa)) - Number(Question.isSecondary(bb))
}
