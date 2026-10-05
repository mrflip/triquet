import * as LLBBCode from './ll-bbcode'
import * as Rank from './rank'
import { Question, type QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'

/** What sits between a question's clueing and the BUT NOT shown with it */
export const ButNotSeparator = '\n\n...BUT NOT...\n\n'

/** What follows every record: the format's row separator */
export const RecordEnd = '$$'

/** An empty italic run: shows as nothing, and keeps two dollar signs from touching */
const DollarFence = '[i][/i]'

/** A blank line, as `LLBBCode.translate` writes one: what sets a smith's note apart from the question after it */
const ParagraphBreak = ' [br]  [br] '

/**
 * What the export does on its way out. `plain` leaves the questions as they are; `playtesting`
 * puts the whole smith's note ahead of the first question, since the playtesting form has nowhere
 * else for it; `go_live` puts the quiz's `q1_preamble` there instead, and leaves the alternates out.
 */
export const ExportModes = ['plain', 'playtesting', 'go_live'] as const
export type ExportMode = typeof ExportModes[number]

/**
 * The questions the export holds in `mode`: never the archived; going live, not the alternates
 * (secondary questions) either, which the playtest weighs against their peers. An alternate carries
 * no mark of being one.
 *
 * @example exportedIn(quiz.questions, 'go_live')  // => the normal questions alone
 */
export function exportedIn(questions: readonly QuestionT[], mode: ExportMode): QuestionT[] {
  return Question.unarchived(questions).filter((question) => mode !== 'go_live' || ! Question.isSecondary(question))
}

/**
 * The quiz in the league's import format: one record per question, in **rank order**, each
 * followed by `$$`. A record is four `|`-separated fields -- the question's rank, its body (the
 * clueing, then the BUT NOT it is shown with), the full answer and the notes -- each made safe by
 * `fieldTextOf`. The alt text is not among them: the league's sheet skips that column.
 *
 * Numbering follows Renumber: a question's rank is its place in Q# order, whatever Q# it was
 * given, and a question with no Q# has no rank, so it comes last with its number left blank. The
 * questions left out (`exportedIn`: the archived, and going live the alternates) are left out of
 * the numbering too, so the records count from 1 with no gaps; a chain to one still shows its hint.
 *
 * The mode may put something ahead of the first record's body (`leadOf`): the first question is
 * the one with the lowest-ranked Q#, or the first unranked one when no question has a Q#.
 *
 * @param quiz - The quiz.
 * @param mode - What to put ahead of the first question, if anything.
 * @returns The records, run together on one line; empty for a quiz with no questions.
 *
 * @example recordsOf(quiz)  // => '1|Who wrote [i]Hamlet[/i]?|Shakespeare|$$2|...'
 * @example recordsOf(quiz, 'go_live')  // => '1|Important: Read the smith's note before you play![br][br]Who wrote...'
 */
export function recordsOf(quiz: QuizT, mode: ExportMode = 'plain'): string {
  const questionForId = new Map(quiz.questions.map((question) => [question._id, question]))
  const exported = exportedIn(quiz.questions, mode)
  const ranks = Rank.ranksOf(exported)
  const lead = leadOf(quiz, mode)
  return Rank.inRankOrder(exported).map((question, idx) => {
    const target = question.chains_to === null ? null : questionForId.get(question.chains_to) ?? null
    return recordOf(question, { target, rank: ranks.get(question._id) ?? null, lead: idx === 0 ? lead : '' }) + RecordEnd
  }).join('')
}

/**
 * What `mode` puts ahead of the first question's body, in BBCode on one line: nothing when
 * plain, the smith's note and a blank line when playtesting, the quiz's preamble (which carries
 * its own line breaks) when going live. Nothing at all when there is nothing to put.
 *
 * @param quiz - The quiz, for its smith's note and its preamble.
 * @param mode - The export's mode.
 * @returns The lead, not yet made safe for the format.
 *
 * @example leadOf({ ...quiz, smiths_note: '*Theme*: princes' }, 'playtesting')  // => '[i]Theme[/i]: princes [br]  [br] '
 */
export function leadOf(quiz: Pick<QuizT, 'smiths_note' | 'q1_preamble'>, mode: ExportMode): string {
  switch (mode) {
  case 'plain':       { return '' }
  case 'playtesting': { return quiz.smiths_note === '' ? '' : LLBBCode.translate(quiz.smiths_note) + ParagraphBreak }
  case 'go_live':     { return LLBBCode.translate(quiz.q1_preamble) }
  }
}

/**
 * One question's record: its rank, then its body, full answer and notes, each made safe, joined
 * by `|`. A dollar sign at the end is fenced off, so it cannot run into the `$$` that follows.
 *
 * @param question - The question.
 * @param placed - Where it sits: the question it chains to (whose hint is its BUT NOT, null when
 *   unchained), its rank (null when it has no Q#), and any lead to put ahead of its body, already
 *   in BBCode (`leadOf`).
 * @returns The record, without the `$$` that follows it.
 *
 * @example recordOf({ ...qn, clueing: 'Who?', full_answer: 'Me', notes: '' }, { target: null, rank: 3 })  // => '3|Who?|Me|'
 */
export function recordOf(question: QuestionT, { target, rank, lead = '' }: Readonly<{ target: QuestionT | null, rank: number | null, lead?: string }>): string {
  const body = safeOf(lead + LLBBCode.translate(bodyOf(question, target)))
  const fields = [body, ...[question.full_answer, question.notes].map((field) => fieldTextOf(field))]
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
 * (`LLBBCode.translate`), then made safe by `safeOf`.
 *
 * @param text - One field, as the author wrote it.
 * @returns The field, on one line.
 *
 * @example fieldTextOf('**Who** wrote\n*Hamlet*?')  // => '[b]Who[/b] wrote [br] [i]Hamlet[/i]?'
 * @example fieldTextOf('$$5 | $10')                 // => '$[i][/i]$5 ¦ $10'
 */
export function fieldTextOf(text: string): string {
  return safeOf(LLBBCode.translate(text))
}

/** BBCode with every run of dollar signs broken up, so it never reads as a record's end, and every pipe written as a broken bar (`¦`), so it never reads as a field's */
function safeOf(bbcode: string): string {
  return bbcode
    .split(/(?<=\$)(?=\$)/).join(DollarFence)
    // A broken bar stands in for a pipe, which the format keeps for separating fields.
    .replaceAll('|', '¦')
}
