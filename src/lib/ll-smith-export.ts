import * as LLBBCode from './ll-bbcode'
import * as Rank from './rank'
import type { QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'

/** What sits between a question's clueing and the BUT NOT shown with it */
export const ButNotSeparator = '\n\n...BUT NOT...\n\n'

/** What follows every record: the format's row separator */
export const RecordEnd = '$$'

/** An empty italic run: shows as nothing, and keeps two dollar signs from touching */
const DollarFence = '[i][/i]'

/**
 * The quiz in the league's import format: one record per question, in **rank order**, each
 * followed by `$$`. A record is four `|`-separated fields -- the question's rank, its body (the
 * clueing, then the BUT NOT it is shown with), the full answer and the notes -- each made safe by
 * `fieldTextOf`. The alt text is not among them: the league's sheet skips that column.
 *
 * Numbering follows Renumber: a question's rank is its place in Q# order, whatever Q# it was
 * given, and a question with no Q# has no rank, so it comes last with its number left blank.
 *
 * @param quiz - The quiz.
 * @returns The records, run together on one line; empty for a quiz with no questions.
 *
 * @example recordsOf(quiz)  // => '1|Who wrote [i]Hamlet[/i]?|Shakespeare|$$2|...'
 */
export function recordsOf(quiz: QuizT): string {
  const questionForId = new Map(quiz.questions.map((question) => [question._id, question]))
  const ranks = Rank.ranksOf(quiz.questions)
  return Rank.inRankOrder(quiz.questions).map((question) => {
    const target = question.chains_to === null ? null : questionForId.get(question.chains_to) ?? null
    return recordOf(question, { target, rank: ranks.get(question._id) ?? null }) + RecordEnd
  }).join('')
}

/**
 * One question's record: its rank, then its body, full answer and notes, each made safe, joined
 * by `|`. A dollar sign at the end is fenced off, so it cannot run into the `$$` that follows.
 *
 * @param question - The question.
 * @param placed - Where it sits: the question it chains to (whose hint is its BUT NOT, null when
 *   unchained), and its rank (null when it has no Q#).
 * @returns The record, without the `$$` that follows it.
 *
 * @example recordOf({ ...qn, clueing: 'Who?', full_answer: 'Me', notes: '' }, { target: null, rank: 3 })  // => '3|Who?|Me|'
 */
export function recordOf(question: QuestionT, { target, rank }: Readonly<{ target: QuestionT | null, rank: number | null }>): string {
  const fields = [bodyOf(question, target), question.full_answer, question.notes].map((field) => fieldTextOf(field))
  const record = [rank === null ? '' : String(rank), ...fields].join('|')
  return record.endsWith('$') ? record + DollarFence : record
}

/**
 * A question's body as the league shows it: the clueing, then `...BUT NOT...`, then the hint of
 * the question it chains to. Just the clueing when there is no BUT NOT to show.
 *
 * @param question - The question.
 * @param target - The question it chains to; null when unchained.
 * @returns The body, with its line breaks still in it.
 *
 * @example bodyOf({ ...qn, clueing: 'Who?' }, { ...other, hint: 'Not him' })  // => 'Who?\n\n...BUT NOT...\n\nNot him'
 * @example bodyOf({ ...qn, clueing: 'Who?' }, null)                          // => 'Who?'
 */
export function bodyOf(question: QuestionT, target: QuestionT | null): string {
  const butnot = target?.hint ?? ''
  return butnot === '' ? question.clueing : question.clueing + ButNotSeparator + butnot
}

/**
 * One field's text, made safe for the format: translated into the league's BBCode on one line
 * (`LLBBCode.translate`), then with every run of dollar signs broken up, so it never reads as a
 * record's end, and every pipe written as a broken bar (`¦`), so it never reads as a field's.
 *
 * @param text - One field, as the author wrote it.
 * @returns The field, on one line.
 *
 * @example fieldTextOf('**Who** wrote\n*Hamlet*?')  // => '[b]Who[/b] wrote [br] [i]Hamlet[/i]?'
 * @example fieldTextOf('$$5 | $10')                 // => '$[i][/i]$5 ¦ $10'
 */
export function fieldTextOf(text: string): string {
  return LLBBCode.translate(text)
    .split(/(?<=\$)(?=\$)/).join(DollarFence)
    // A broken bar stands in for a pipe, which the format keeps for separating fields.
    .replaceAll('|', '¦')
}
