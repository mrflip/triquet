import _ from 'es-toolkit/compat'
import * as Formulas from './formulas'
import * as Labelmaker from './labelmaker'
import * as Rank from './rank'
import * as UU from './useful'
import type { ExpressingT } from '../models/expressing'
import type { ExpressionT } from '../models/expression'
import type { QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'

/** What a formula can come to and still be shown in a cell */
export type ExpressedScalar = string | number | boolean

/**
 * What one expressing came to for one question.
 *
 * `nothing` is not zero and not blank: it is a formula that found nothing to say, shown as a
 * muted dash, because "nobody has extracted this yet" and "the answer is nought" are different
 * facts about a clue. `stale` marks a value worked out from something since edited.
 */
export type Expressed =
  | { status: 'value', val: ExpressedScalar, stale: boolean }
  | { status: 'nothing' }
  | { status: 'error', message: string }

/** Every expressing's column of results: for each expressing's label, each question's, by id */
export type ExpressedForQuiz = ReadonlyMap<string, ReadonlyMap<string, Expressed>>

/** What a sort reads from a cell: a number, a string, or nothing at all */
export type ExpressedSortValue = string | number | null

/**
 * The document a formula reads.
 *
 * Ids are stripped and everything is referred to by label: a question's `chains_to` is the
 * label of the question it chains to, so `qns[label = $$.qn.chains_to]` is that question. Each
 * question also carries its `rank` -- its 1-based place once the quiz is put in Q# order, or
 * null when it has no Q#.
 */
export type QuizBag = {
  /** The quiz's own fields, without its questions and its expressings */
  quiz:       Record<string, unknown>
  /** Every question in the quiz, in the quiz's order */
  qns:        Record<string, unknown>[]
  /** The question being worked out; the very object also found in `qns` */
  qn:         Record<string, unknown>
  qn_label:   string
  quiz_label: string
}

const Nothing: Expressed = { status: 'nothing' }

/** What a formula can come to that a cell shows as nothing */
const Absent: ReadonlySet<unknown> = new Set([undefined, null, ''])

/** The keys of the object a formula returns when it wants to say a value is stale */
const MarkedKeys: ReadonlySet<string> = new Set(['value', 'stale'])

/**
 * Every expressing of `quiz` worked out for every question, from the formulas in `expressions`.
 *
 * Nothing here throws or is stored: a formula that fails costs its own cells and no others, and
 * a formula that will not stop is stopped, after which the rest of its column reads the same
 * failure rather than waiting on it again.
 *
 * @param quiz - The quiz whose columns are wanted.
 * @param expressions - The workspace's expressions, which the quiz's expressings name.
 * @returns For each expressing's label, each question's result by id.
 *
 * @example forQuiz(quiz, expressions).get('clueing_full')?.get(question.id)
 */
export function forQuiz(quiz: QuizT, expressions: readonly ExpressionT[]): ExpressedForQuiz {
  const formulaForLabel = new Map(expressions.map((expression) => [expression.label, expression.formula]))
  const bags = bagsFor(quiz)
  return new Map(quiz.expressings.map((expressing) => [
    expressing.label,
    columnFor(expressing, formulaForLabel.get(expressing.expression_label) ?? null, bags),
  ]))
}

/**
 * What `formula` comes to for one question's bag: the preview an author sees while writing it.
 *
 * @param formula - JSONata source, however unfinished.
 * @param bag - The question's bag, from `bagsFor`; nothing is worked out without one.
 * @returns What a cell would show.
 *
 * @example previewOf('qn.title', bagsFor(quiz).get(question.id))
 */
export function previewOf(formula: string, bag: QuizBag | undefined): Expressed {
  return bag ? reading(Formulas.evaluate(formula, bag)) : Nothing
}

/**
 * One question's result in `expressed`, or `nothing` when the column or the question is not there.
 *
 * @param expressed - A quiz's results.
 * @param expressing_label - Which column.
 * @param question_id - Which question.
 */
export function readingOf(expressed: ExpressedForQuiz, expressing_label: string, question_id: string): Expressed {
  return expressed.get(expressing_label)?.get(question_id) ?? Nothing
}

/**
 * What a column's sort reads from `reading`: numbers and text as they are, a boolean as 0 or 1,
 * and nothing -- or an error -- as nothing, which sinks to the bottom in either direction.
 *
 * @param reading - One cell's result.
 * @returns A value the sorter can compare, or null.
 */
export function sortValueOf(reading: Expressed): ExpressedSortValue {
  if (reading.status !== 'value') { return null }
  return typeof reading.val === 'boolean' ? Number(reading.val) : reading.val
}

/**
 * The bag a formula reads for each question of `quiz`.
 *
 * @param quiz - The quiz.
 * @returns One bag per question, by the question's id, in the quiz's order.
 */
export function bagsFor(quiz: QuizT): ReadonlyMap<string, QuizBag> {
  const ranks = Rank.ranksOf(quiz.questions)
  const labelForId = new Map(quiz.questions.map((question) => [question.id, Labelmaker.effectiveLabelOf(question)]))
  const qns = quiz.questions.map((question) => stripped(question, ranks.get(question.id) ?? null, labelForId))
  const quiz_label = Labelmaker.effectiveLabelOf(quiz)
  const quizBag = { ..._.omit(quiz, ['id', 'questions', 'expressings', 'forced_label']), label: quiz_label }
  return new Map(quiz.questions.map((question, idx) => [question.id, {
    quiz:     quizBag,
    qns,
    qn:       qns[idx] ?? {},
    qn_label: labelForId.get(question.id) ?? '',
    quiz_label,
  }]))
}

/** `question` as a formula sees it: no ids, its label the one in force, its chain named by label, its rank added */
function stripped(question: QuestionT, rank: number | null, labelForId: ReadonlyMap<string, string>): Record<string, unknown> {
  const chained = question.chains_to === null ? null : labelForId.get(question.chains_to) ?? null
  return { ..._.omit(question, ['id', 'forced_label']), label: labelForId.get(question.id) ?? question.label, chains_to: chained, rank }
}

/** One expressing's results for every question; `formula` is null when the expression it names is gone */
function columnFor(expressing: ExpressingT, formula: string | null, bags: ReadonlyMap<string, QuizBag>): ReadonlyMap<string, Expressed> {
  if (formula === null) {
    const gone: Expressed = { status: 'error', message: `There is no expression called "${expressing.expression_label}" any more` }
    return new Map(Array.from(bags, ([question_id]) => [question_id, gone]))
  }
  const results = new Map<string, Expressed>()
  let stopped: Expressed | null = null
  for (const [question_id, bag] of bags) {
    if (stopped !== null) { results.set(question_id, stopped); continue }
    const outcome = Formulas.evaluate(formula, bag)
    const result = reading(outcome)
    results.set(question_id, result)
    if (! outcome.ok && outcome.failkind === 'timeout') { stopped = result }
  }
  return results
}

/** What a formula's outcome shows in a cell */
function reading(outcome: Formulas.FormulaOutcome): Expressed {
  if (! outcome.ok) { return { status: 'error', message: outcome.message } }
  const { val } = outcome
  if (isFunction(val)) { return { status: 'error', message: 'The formula came to a function rather than a value' } }
  if (isMarked(val)) { return valued(val.value, val.stale === true) }
  return valued(val, false)
}

/** Whether a formula came to a function: JSONata hands one back as a marked object, or as a plain function */
function isFunction(val: unknown): boolean {
  if (typeof val === 'function') { return true }
  return typeof val === 'object' && val !== null && '_jsonata_function' in val
}

/** A value as a cell shows it: scalars as they are, anything bigger as its JSON, and nothing for nothing */
function valued(val: unknown, stale: boolean): Expressed {
  if (Absent.has(val)) { return Nothing }
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') { return { status: 'value', val, stale } }
  return { status: 'value', val: UU.jsonify(val), stale }
}

/** Whether a formula answered in the `{ value, stale }` form, rather than with a bare value */
function isMarked(val: unknown): val is { value?: unknown, stale?: unknown } {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) { return false }
  const keys = Object.keys(val)
  return keys.length > 0 && keys.every((key) => MarkedKeys.has(key))
}
