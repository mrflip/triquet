import * as Rank from './rank'
import * as Runner from './formulary/runner'
import { isTypedInto, shownOf, specsFor, templatedTextOf, type ColumnSpec } from './columns'
import { Question, type QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'
import { Widgeted } from '../models/widgeted'

/** What one cell says as text, given the question's own chain target */
type CellContext = {
  question:     QuestionT
  target:       QuestionT | null
  run:          Runner.QuizRun
  /** What the quiz nominates as templateable, which a formula reads filled in */
  templateable: readonly string[]
}

/**
 * What a column shows, as the text a spreadsheet cell holds: a question's own field or view as
 * typed, anything else as what it came to (`shownOf`), through its formula when it has one, and
 * its template filled in when it has one (`templatedTextOf`). Whether the column is collapsed
 * makes no difference here.
 *
 * @param spec - The column.
 * @param context - The question, the one it chains to, the quiz's run and what it nominates as templateable.
 * @returns The cell's text; empty when there is nothing to say.
 */
export function cellTextOf(spec: Pick<ColumnSpec, 'source' | 'formula' | 'template'>, { question, target, run, templateable }: Readonly<CellContext>): string {
  const { source } = spec
  if (spec.template !== null) { return templatedTextOf(spec, run, templateable, question._id) }
  if (isTypedInto(spec) && source.kind === 'field') {
    if (source.field === 'chains_to') { return target ? target.label : '' }
    return question[source.field]
  }
  if (isTypedInto(spec) && source.kind === 'view') { return target?.hint ?? '' }
  return Widgeted.textOf(shownOf(spec, run, templateable, question._id))
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
    return specs.map((spec) => cellTextOf(spec, { question, target, run, templateable: quiz.templateable }))
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
