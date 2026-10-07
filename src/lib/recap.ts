import * as EST from 'es-toolkit'
import * as Bbjank from './bbjank'
import * as LLSmithExport from './ll-smith-export'
import * as Rank from './rank'
import * as Runner from './formulary/runner'
import * as Templating from './templating'
import { Widgeted } from '../models/widgeted'
import { Question } from '../models/question'
import { TemplatableFieldVals, type QuizT } from '../models/quiz'

/**
 * The recap note: what a smith posts to the league's message boards once the quiz has been
 * played. One markdown document, made by filling in mustache templates, then written in bbjank
 * once, whole: the recap head and tail are filled in over the quiz's template bag, then the recap
 * template (the quiz's own, or `DefaultTemplate`) over the **recap bag**, which holds them and the
 * questions played; then `Bbjank.toBbjank`, which writes only what it knows, is the last step.
 *
 * What an author wrote, set into a place where markdown's structure is fragile, can change that
 * structure: a clueing's second line leaves the quote its first line opened, an answer opening
 * `1984.` would be a list. So each question played carries its texts pre-shaped for those places
 * (`quoted_body`, `answer_line`, `recap_below`), and the template stays plain mustache.
 */

/**
 * The recap template every quiz follows until it is given one of its own: the recap head, a rule,
 * then each question played -- its number and clueing, with its BUT NOT, quoted under its Q-number;
 * its answer behind a spoiler; its correct-answer share; its recap -- then the recap tail. The rule
 * is `***`, and only when a question follows (`{{#played.0}}`): a `---` straight under the head
 * would make the head's last line a heading.
 */
export const DefaultTemplate = [
  '{{#recap_head}}',
  '{{recap_head}}',
  '{{! A rule under the head, when a question follows. Not ---, which would make the line above a heading. }}',
  '{{#played.0}}',
  '***',
  '{{/played.0}}',
  '',
  '{{/recap_head}}',
  '{{#played}}',
  '> {AS: Q{{number}}}{{number}}. {{quoted_body}}',
  '',
  'Answer: {{#answer_line}}~~**{{answer_line}}**~~{{/answer_line}}',
  'Correct Answer %: {{pct}}',
  '{{recap_below}}',
  '',
  '{{/played}}',
  '{{recap_tail}}',
].join('\n')

/**
 * The label of the widgeting that holds the share of players who answered a question correctly,
 * in percent: what a question played carries as `pct`, when the quiz has one.
 */
export const CorrectPctLabel = 'correct_pct'

/**
 * One question played, as the recap template reads it inside `{{#played}}`: the question as a
 * template's bag holds it (its fields, its templated ones filled in, and every widgeting's
 * widgeted under its label), and beside them, winning over a widgeting of the same label, these.
 */
export type PlayedT = Record<string, unknown> & {
  /** Its place among the questions played, from 1 */
  number:      number
  /** Its clueing, with its BUT NOT, to follow a `> ` the template opened: every line after the first opens `> `, indents read as quotes */
  quoted_body: string
  /** Its full answer on one line, safe within a line of the template's */
  answer_line: string
  /** Its recap, safe on the line straight after another of the template's; blank when it has none */
  recap_below: string
  /** Its share of correct answers, from the quiz's `correct_pct` widgeting, on one line; blank without one */
  pct:         string
}

/** What the recap template reads: the quiz's template bag, its recap head and tail filled in, and the questions played */
export type RecapBagT = Templating.TemplateBag & {
  recap_head: string
  recap_tail: string
  played:     PlayedT[]
}

/** The recap note in bbjank, and what keeps the recap template from filling in, if anything does */
export type RecapNoteT = {
  bbjank: string
  issue:  string | null
}

/** A line markdown would read as underlining the line above it into a heading */
const SetextUnderlineRE = /^ {0,3}(?:=+|-+)[ \t]*$/

/**
 * The recap template `quiz` follows: its own, or the default.
 *
 * @example templateOf({ ...quiz, recap_template: undefined }) === DefaultTemplate  // => true
 */
export function templateOf(quiz: Pick<QuizT, 'recap_template'>): string {
  return quiz.recap_template ?? DefaultTemplate
}

/**
 * The recap note in bbjank, ready to paste into a post on the league's boards: the recap
 * template filled in over the recap bag (`bagOf`), then written in bbjank, whole. A template that
 * cannot be filled in is written as typed, with what is wrong with it.
 *
 * @param quiz - The quiz: its recap head, tail and template, and its questions.
 * @param run - Its run, for the templates' bag and the correct-answer column.
 * @returns The note, empty for a quiz with nothing to recap; and the template's issue, if any.
 *
 * @example noteOf({ ...quiz, recap_head: 'Thanks!', questions: [hamilton] }, run).bbjank
 *   // => 'Thanks!\n----------------------------------------\n\n[quote="Q1"]1. Who?[/quote]\n\nAnswer: [spoiler][b]HAMILTON[/b][/spoiler]\nCorrect Answer %:'
 */
export function noteOf(quiz: QuizT, run: Runner.QuizRun): RecapNoteT {
  const filled = Templating.fill(templateOf(quiz), bagOf(quiz, run))
  return { bbjank: Bbjank.toBbjank(filled.markdown), issue: filled.issue }
}

/**
 * What the recap template reads: the quiz's template bag (`Templating.bagOf(run, null)`); its
 * recap head and tail, each filled in over that bag (as typed, when it cannot be); and `played`,
 * the questions the recap covers -- in rank order, numbered from 1, and neither archived nor
 * alternates (as the LL export going live has them) nor blank, never written into -- each with
 * its texts pre-shaped (`PlayedT`).
 *
 * @example bagOf(quiz, run).played.map((played) => played.number)  // => [1, 2, 3]
 */
export function bagOf(quiz: QuizT, run: Runner.QuizRun): RecapBagT {
  const quizBag = Templating.bagOf(run, null)
  const filled = Templating.filledQuiz(quiz, run)
  const questionFor = new Map(filled.questions.map((question) => [question._id, question]))
  const qnFor = new Map(run.frame.question_ids.map((question_id, idx) => [question_id, quizBag.qns[idx] ?? {}]))
  const hasPct = quiz.widgetings.some((widgeting) => widgeting.label === CorrectPctLabel && widgeting.tier === 'question')
  const played = Rank.inRankOrder(LLSmithExport.exportedIn(filled.questions, 'go_live').filter((question) => ! Question.isBlank(question)))
  return {
    ...quizBag,
    recap_head: Templating.fill(quiz.recap_head, quizBag).markdown,
    recap_tail: Templating.fill(quiz.recap_tail, quizBag).markdown,
    played:     played.map((question, ii): PlayedT => {
      const target = question.chains_to === null ? null : questionFor.get(question.chains_to) ?? null
      return {
        ...qnFor.get(question._id),
        ...EST.pick(question, TemplatableFieldVals),
        number:      ii + 1,
        quoted_body: quotedBodyOf(LLSmithExport.bodyOf(question, target)),
        answer_line: oneLineOf(question.full_answer),
        recap_below: recapBelowOf(question.recap),
        pct:         hasPct ? oneLineOf(Widgeted.textOf(Runner.widgetedOf(run, CorrectPctLabel, question._id))) : '',
      }
    }),
  }
}

/**
 * A question's body (its clueing, with its BUT NOT), to follow a `> ` the template opened on its
 * line: its indents read as quotes, as bbjank reads them, so none reads as code inside the quote;
 * every line after its first opening `> `, so none leaves the quote; blank lines at either end
 * dropped. A body opening with a quote of its own starts on the line below.
 *
 * @example quotedBodyOf('Who?\n\n...BUT NOT...\n\nNot him')  // => 'Who?\n>\n> ...BUT NOT...\n>\n> Not him'
 * @example quotedBodyOf('Who wrote\n    *verse*')             // => 'Who wrote\n> > *verse*'
 */
export function quotedBodyOf(body: string): string {
  const lines = trimmedLines(Bbjank.indentsQuoted(body))
  const opened = lines[0]?.startsWith('>') ? ['', ...lines] : lines
  return opened.map((line, ii) => {
    if (ii === 0) { return line }
    return line === '' ? '>' : `> ${line}`
  }).join('\n')
}

/**
 * `text` on one line: each line trimmed, the blank ones dropped, the rest joined by a space.
 *
 * @example oneLineOf('HAMILTON\n\n(accept ROWAN)\n')  // => 'HAMILTON (accept ROWAN)'
 */
export function oneLineOf(text: string): string {
  return text.split('\n').map((line) => line.trim()).filter((line) => line !== '').join(' ')
}

/**
 * A question's recap, to set on the line straight after another: blank lines at either end
 * dropped, and a first line that would underline the line above into a heading (`---`, `===`)
 * set a blank line apart from it.
 *
 * @example recapBelowOf('Aced.\n')        // => 'Aced.'
 * @example recapBelowOf('---\nAfter.')    // => '\n---\nAfter.'
 */
export function recapBelowOf(recap: string): string {
  const lines = trimmedLines(recap)
  const below = lines.join('\n')
  return SetextUnderlineRE.test(lines[0] ?? '') ? `\n${below}` : below
}

/** Whether `line` holds nothing but space */
function isBlank(line: string): boolean {
  return line.trim() === ''
}

/** `text`'s lines, without the blank ones at either end */
function trimmedLines(text: string): string[] {
  return EST.dropRightWhile(EST.dropWhile(text.replaceAll('\r\n', '\n').split('\n'), isBlank), isBlank)
}
