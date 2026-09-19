import * as Expressed from './expressed'
import * as Labelmaker from './labelmaker'
import * as Rank from './rank'
import { columnsFor, type Colkey } from './columns'
import { expressingLabelOf } from '../models/expressing'
import type { IshesT } from '../models/ish'
import type { QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'

/** What a fixed column's cell says about one question, as text */
type CellText = (question: QuestionT, target: QuestionT | null) => string

/**
 * Every fixed column's cell as text. Typed by `Colkey`, so a column added to the grid cannot be
 * left out of the export: it does not compile until it says what it holds.
 */
const CellTextFor: Record<Colkey, CellText> = {
  title:         (question) => question.title,
  grip:          () => '',
  clueing:       (question) => question.clueing,
  hint:          (question) => question.hint,
  chains_to:     (_question, target) => (target ? Labelmaker.effectiveLabelOf(target) : ''),
  butnot:        (_question, target) => target?.hint ?? '',
  qnum:          (question) => question.qnum,
  alt_text:      (question) => question.alt_text,
  notes:         (question) => question.notes,
  full_answer:   (question) => question.full_answer,
  clueing_ishes: (question) => spansOf(question.clueing_ishes),
  butnot_ishes:  (_question, target) => spansOf(target?.hint_ishes ?? null),
  hint_ishes:    (question) => spansOf(question.hint_ishes),
  guess:         (question) => (question.guess?.status === 'done' ? question.guess.text : ''),
}

/**
 * The quiz as tab-separated lines, ready to paste into a spreadsheet: a header row, then one
 * line per question.
 *
 * It has exactly the grid's columns, in the grid's order, because it is made from the same
 * list: a header is a field's name, a computed column's label, or a player's label. Rows are
 * always in **rank order**, whatever the grid is currently sorted or dragged into, so the same
 * quiz pastes the same way whether it was last sorted by chain order or by a sum.
 *
 * @param quiz - The quiz.
 * @param expressed - What its computed columns came to, from `Expressed.forQuiz`.
 * @returns The header and one line per question, tab-separated; empty for a quiz with no questions.
 *
 * @example sheetsExport(quiz, Expressed.forQuiz(quiz, workspace.expressions)).split('\n')[0]  // => 'title\tclueing\thint\t...'
 */
export function sheetsExport(quiz: QuizT, expressed: Expressed.ExpressedForQuiz): string {
  if (quiz.questions.length === 0) { return '' }
  const columns = columnsFor(quiz.expressings).filter((column) => column.header !== null)
  const questionForId = new Map(quiz.questions.map((question) => [question.id, question]))

  const header = columns.map((column) => column.header ?? '')
  const rows = Rank.inRankOrder(quiz.questions).map((question) => {
    const target = question.chains_to === null ? null : questionForId.get(question.chains_to) ?? null
    return columns.map((column) => {
      const expressing_label = expressingLabelOf(column.colkey)
      if (expressing_label !== null) { return expressedText(Expressed.readingOf(expressed, expressing_label, question.id)) }
      return CellTextFor[column.colkey as Colkey](question, target)
    })
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

/** What a computed cell says: its value, or nothing when it has none or failed */
function expressedText(reading: Expressed.Expressed): string {
  return reading.status === 'value' ? String(reading.val) : ''
}

/** An extraction's spans, verbatim, joined with a slash; nothing when it never succeeded */
function spansOf(ishes: IshesT): string {
  if (ishes?.status !== 'done') { return '' }
  return ishes.items.map((item) => item.text).join('/')
}
