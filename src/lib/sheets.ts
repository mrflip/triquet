import * as Rank from './rank'
import * as Runner from './formulary/runner'
import { specsFor, type Resolved } from './columns'
import { Question, type QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'
import { Widgeted } from '../models/widgeted'

/** What one cell says as text, given the question's own chain target */
type CellContext = {
  question:  QuestionT
  target:    QuestionT | null
  run:       Runner.QuizRun
}

/**
 * What a column shows, as the text a spreadsheet cell holds.
 *
 * @param source - What the column shows.
 * @param context - The question, the one it chains to, and the quiz's run.
 * @returns The cell's text; empty when there is nothing to say.
 */
export function cellTextOf(source: Resolved, { question, target, run }: Readonly<CellContext>): string {
  switch (source.kind) {
  case 'field': {
    if (source.field === 'chains_to') { return target ? target.label : '' }
    return question[source.field]
  }
  case 'view': {
    return target?.hint ?? ''
  }
  case 'widgeting': {
    return Widgeted.textOf(Runner.widgetedOf(run, source.widgeting.label, question._id, source.part))
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
 * order**, whatever the grid is currently sorted or dragged into, and leave the archived questions
 * out, as the grid does; a chain to one still shows its label and its hint.
 *
 * @param quiz - The quiz.
 * @param run - The quiz, run (`Runner.runQuiz`): what its widgetings came to.
 * @returns The header and one line per question, tab-separated; empty for a quiz with no questions but the archived.
 *
 * @example sheetsExport(quiz, Runner.runQuiz(Runner.sourceOf(quiz, library, place))).split('\n')[0]  // => 'alt_text\tbutnot\t...'
 */
export function sheetsExport(quiz: QuizT, run: Runner.QuizRun): string {
  const shown = Question.unarchived(quiz.questions)
  if (shown.length === 0) { return '' }
  const specs = specsFor(quiz).toSorted((aa, bb) => aa.header.localeCompare(bb.header))
  const questionForId = new Map(quiz.questions.map((question) => [question._id, question]))

  const header = specs.map((spec) => spec.header)
  const rows = Rank.inRankOrder(shown).map((question) => {
    const target = question.chains_to === null ? null : questionForId.get(question.chains_to) ?? null
    return specs.map((spec) => cellTextOf(spec.source, { question, target, run }))
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
