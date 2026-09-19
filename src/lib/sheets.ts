import * as Rank from './rank'
import type { QuestionT } from '../models/question'

/** How many tab-separated fields each line carries */
export const SheetsFieldCount = 7

/**
 * The quiz as tab-separated lines, ready to paste into a spreadsheet.
 *
 * Always in **rank order**, whatever the grid is currently sorted or dragged into, and the first
 * field is the **rank** rather than the raw Q#, which may be gappy, decimal or duplicated
 * mid-draft. A quizmaster pasting into a sheet wants 1, 2, 3, and wants the same result whether
 * they last sorted by chain order or by Hint Numeral sum.
 *
 * @param questions - The quiz's questions, in any order.
 * @returns One line per question, seven tab-separated fields each.
 *
 * @example sheetsExport(quiz.questions).split('\n').length  // => one line per question
 */
export function sheetsExport(questions: readonly QuestionT[]): string {
  const ranks = Rank.ranksOf(questions)
  const questionForId = new Map(questions.map((question) => [question.id, question]))

  return Rank.inRankOrder(questions).map((question) => {
    const rank = ranks.get(question.id) ?? null
    const target = question.chains_to === null ? null : questionForId.get(question.chains_to) ?? null
    const clueingFull = clueingTotalOf(question)
    return [
      rank === null ? '' : String(rank),
      foldButnot(question.clueing, target?.hint ?? ''),
      question.full_answer,
      question.alt_text,
      question.notes,
      clueingFull === null ? '' : String(clueingFull),
      ishSpansOf(question),
    ].map((field) => pasteSafe(field)).join('\t')
  }).join('\n')
}

/**
 * A clueing with its BUT NOT text folded in: the complete unit as a player receives it.
 *
 * A hint is normally already written as "BUT NOT ...", so the phrase is only supplied when the
 * hint does not carry it -- otherwise the line would stutter.
 *
 * @param clueing - The question as it will be asked.
 * @param hint - The chained-to question's hint, or '' when there is no chain.
 * @returns One piece of text; the clueing alone when there is no hint to fold in.
 *
 * @example foldButnot('Which region?', 'BUT NOT the film')  // => 'Which region? ... BUT NOT the film'
 * @example foldButnot('Which region?', 'the film')          // => 'Which region? ... BUT NOT ... the film'
 * @example foldButnot('Which region?', '')                  // => 'Which region?'
 */
export function foldButnot(clueing: string, hint: string): string {
  const tidy = hint.trim()
  if (tidy === '') { return clueing }
  const joiner = /^but not\b/i.test(tidy) ? ' ... ' : ' ... BUT NOT ... '
  return `${clueing}${joiner}${tidy}`
}

/**
 * `text` with everything that would break a paste taken out.
 *
 * A field's own line break would otherwise look like the start of a new spreadsheet row and a
 * stray tab like an extra column. The break becomes a literal `<br/>`, which also survives
 * usefully into a rich-text cell; a tab becomes a space.
 *
 * @param text - One field's contents.
 * @returns The same text, safe to sit between tabs and newlines.
 *
 * @example pasteSafe('two\nlines')  // => 'two<br/>lines'
 */
export function pasteSafe(text: string): string {
  return text.replaceAll(/\r\n|\r|\n/g, '<br/>').replaceAll('\t', ' ')
}

/**
 * What the clueing's ish spans add up to, to a whole number, or null when they were never extracted.
 * Worked out here rather than read from the grid's columns, so the export means the same
 * thing whatever an author has done to those.
 */
function clueingTotalOf(question: QuestionT): number | null {
  const { clueing_ishes } = question
  if (clueing_ishes?.status !== 'done') { return null }
  return Math.round(clueing_ishes.items.reduce((acc, item) => acc + item.value, 0))
}

/** The question's own ish spans, verbatim, joined with a slash */
function ishSpansOf(question: QuestionT): string {
  const { clueing_ishes } = question
  if (clueing_ishes?.status !== 'done') { return '' }
  return clueing_ishes.items.map((item) => item.text).join('/')
}
