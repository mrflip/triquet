import * as Bbjank from './bbjank'
import * as LLSmithExport from './ll-smith-export'
import * as Rank from './rank'
import * as Runner from './formulary/runner'
import * as Templating from './templating'
import { Widgeted } from '../models/widgeted'
import { Question, type QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'

/**
 * The recap note: what a smith posts to the league's message boards once the quiz has been
 * played. The quiz's recap head, then each question played (its clueing and BUT NOT, its answer
 * behind a spoiler, how many got it, and the question's own recap), then the recap tail, in bbjank.
 *
 * Each text an author wrote is converted on its own (`Bbjank.toBbjank`), so it means on the board
 * what it means on screen, and the recap's own frame (the quote naming each question, the
 * spoiler, the answer's lines) is written around it.
 */

/**
 * A widgeting whose label says it holds the share of players who answered a question correctly,
 * in percent: what the recap's `Correct Answer %:` line reads, when the quiz has one.
 */
export const CorrectPctRE = /^(?:correct_(?:answer_)?(?:pct|percent)|(?:pct|percent)_correct)$/

/** Where one question sits in the recap: its number, the question whose hint is its BUT NOT, and its correct-answer share */
type PlacedT = {
  number: number
  target: QuestionT | null
  pct:    string
}

/**
 * The recap note in bbjank, ready to paste into a post on the league's boards.
 *
 * The recap head and tail are templates, filled in over the quiz's bag (`Templating.bagOf(run,
 * null)`); a question's fields are filled in where the quiz templates them. The questions are
 * those played: in rank order, numbered from 1, and neither archived nor alternates (as the LL
 * export going live has them) nor blank, never written into. A blank head, tail or recap is left out, with the space around it;
 * a rule sets the head apart from the questions.
 *
 * @param quiz - The quiz: its recap head and tail, and its questions.
 * @param run - Its run, for the templates' bag and a correct-answer column (`CorrectPctRE`).
 * @returns The recap note; empty for a quiz with nothing to recap.
 *
 * @example bbjankOf({ ...quiz, recap_head: 'Thanks!', questions: [hamilton] }, run)
 *   // => 'Thanks!\n----------------------------------------\n\n[quote="Q1"]1. Who?[/quote]\n\nAnswer: [spoiler][b]HAMILTON[/b][/spoiler]\nCorrect Answer %:'
 */
export function bbjankOf(quiz: QuizT, run: Runner.QuizRun): string {
  const filled = Templating.filledQuiz(quiz, run)
  const quizBag = Templating.bagOf(run, null)
  const head = Bbjank.toBbjank(Templating.fill(quiz.recap_head, quizBag).markdown)
  const tail = Bbjank.toBbjank(Templating.fill(quiz.recap_tail, quizBag).markdown)
  const questionForId = new Map(filled.questions.map((question) => [question._id, question]))
  const pctLabel = quiz.widgetings.find((widgeting) => CorrectPctRE.test(widgeting.label))?.label ?? null
  const played = Rank.inRankOrder(LLSmithExport.exportedIn(filled.questions, 'go_live').filter((question) => ! Question.isBlank(question)))
  const blocks = played.map((question, ii) => blockOf(question, {
    number: ii + 1,
    target: question.chains_to === null ? null : questionForId.get(question.chains_to) ?? null,
    pct:    pctLabel === null ? '' : Widgeted.textOf(Runner.widgetedOf(run, pctLabel, question._id)),
  }))
  const opening = head !== '' && blocks.length > 0 ? `${head}\n${Bbjank.RuleLine}` : head
  return [opening, ...blocks, tail].filter((block) => block !== '').join('\n\n')
}

/**
 * One question's block of the recap: its number and clueing, with its BUT NOT, quoted under its
 * Q-number; a blank line; its answer behind a spoiler, on one line; its correct-answer share; and
 * its recap, when it has one.
 *
 * @param question - The question, its templated fields filled in.
 * @param placed - Its number, the question it chains to, and its correct-answer share (blank when unknown).
 * @returns The block, in bbjank.
 *
 * @example blockOf({ ...qn, clueing: 'Who?', full_answer: 'HAMILTON', recap: 'Aced.' }, { number: 1, target: null, pct: '76' })
 *   // => '[quote="Q1"]1. Who?[/quote]\n\nAnswer: [spoiler][b]HAMILTON[/b][/spoiler]\nCorrect Answer %: 76\nAced.'
 */
export function blockOf(question: QuestionT, { number, target, pct }: Readonly<PlacedT>): string {
  const body = Bbjank.toBbjank(LLSmithExport.bodyOf(question, target))
  const answer = Bbjank.toBbjank(question.full_answer.split('\n').map((line) => line.trim()).filter((line) => line !== '').join(' '))
  const recap = Bbjank.toBbjank(question.recap)
  return [
    `[quote="Q${String(number)}"]${String(number)}. ${body}[/quote]`,
    '',
    `Answer: [spoiler][b]${answer}[/b][/spoiler]`,
    pct === '' ? 'Correct Answer %:' : `Correct Answer %: ${pct}`,
    ...(recap === '' ? [] : [recap]),
  ].join('\n')
}
