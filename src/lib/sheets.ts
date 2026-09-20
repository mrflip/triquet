import * as Expressed from './expressed'
import * as Labelmaker from './labelmaker'
import * as Rank from './rank'
import { specsFor, type Resolved } from './columns'
import type { GuessT } from '../models/guess'
import type { IshesT } from '../models/ish'
import type { QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'

/** What one cell says as text, given the question's own chain target */
type CellContext = {
  question:  QuestionT
  target:    QuestionT | null
  expressed: Expressed.ExpressedForQuiz
}

/**
 * What a column shows, as the text a spreadsheet cell holds.
 *
 * @param source - What the column shows.
 * @param context - The question, the one it chains to, and the quiz's computed values.
 * @returns The cell's text; empty when there is nothing to say.
 */
export function cellTextOf(source: Resolved, { question, target, expressed }: Readonly<CellContext>): string {
  switch (source.kind) {
  case 'field': {
    if (source.field === 'chains_to') { return target ? Labelmaker.effectiveLabelOf(target) : '' }
    return question[source.field]
  }
  case 'view': {
    return source.view === 'butnot' ? target?.hint ?? '' : spansOf(target?.hint_ishes ?? null)
  }
  case 'playing': {
    return source.slot.field === 'guess' ? guessTextOf(question.guess) : spansOf(question[source.slot.field])
  }
  case 'expressing': {
    const reading = Expressed.readingOf(expressed, source.widget.label, question.id)
    return reading.status === 'value' ? String(reading.val) : ''
  }
  }
}

/**
 * The quiz as tab-separated lines, ready to paste into a spreadsheet: a header row, then one
 * line per question.
 *
 * It has the columns the grid shows -- made from the same list -- but in alphabetical order by
 * column label, so that reordering the grid, or adding a column, moves only what it must, and
 * the paste stays where a spreadsheet's own formulas expect it. Rows are always in **rank
 * order**, whatever the grid is currently sorted or dragged into.
 *
 * @param quiz - The quiz.
 * @param expressed - What its computed columns came to, from `Expressed.forQuiz`.
 * @returns The header and one line per question, tab-separated; empty for a quiz with no questions.
 *
 * @example sheetsExport(quiz, Expressed.forQuiz(quiz, workspace.expressions)).split('\n')[0]  // => 'alt_text\tbutnot\t...'
 */
export function sheetsExport(quiz: QuizT, expressed: Expressed.ExpressedForQuiz): string {
  if (quiz.questions.length === 0) { return '' }
  const specs = specsFor(quiz).toSorted((aa, bb) => aa.header.localeCompare(bb.header))
  const questionForId = new Map(quiz.questions.map((question) => [question.id, question]))

  const header = specs.map((spec) => spec.header)
  const rows = Rank.inRankOrder(quiz.questions).map((question) => {
    const target = question.chains_to === null ? null : questionForId.get(question.chains_to) ?? null
    return specs.map((spec) => cellTextOf(spec.source, { question, target, expressed }))
  })
  return [header, ...rows].map((fields) => fields.map((field) => pasteSafe(field)).join('\t')).join('\n')
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

/** An extraction's spans, verbatim, joined with a slash; nothing when it never succeeded */
function spansOf(ishes: IshesT): string {
  if (ishes?.status !== 'done') { return '' }
  return ishes.items.map((item) => item.text).join('/')
}

/** A guess's text, or nothing when it never succeeded */
function guessTextOf(guess: GuessT): string {
  return guess?.status === 'done' ? guess.text : ''
}
