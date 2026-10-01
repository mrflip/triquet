import _ from 'es-toolkit/compat'
import * as Labelmaker from '../labelmaker'
import * as Rank from '../rank'
import { huntTitleOf, realmTitleOf } from '../rows'
import { formularyFor, type InputOutcome } from './formularies'
import { exposeGuess, exposeIshes } from '../../models/botting'
import { Hunt, type HuntT } from '../../models/hunt'
import { Question, type QuestionT } from '../../models/question'
import { Quiz, type QuizT } from '../../models/quiz'
import { Realm, type RealmT } from '../../models/realm'
import { Widgeted, type JsonT, type StoredWidgetedT, type WidgetedErrT, type WidgetedHistoryT, type WidgetedStatus, type WidgetedT } from '../../models/widgeted'
import type { LibraryWidgetT } from '../../models/widget'
import type { WidgetingT } from '../../models/widgeting'

/**
 * Where a quiz sits: its hunt and its realm, each as the outside world sees it -- the label in
 * force and the title as shown. What a formula reads as `hunt` and `realm`, and where the quiz's
 * history keeps its files.
 */
export type QuizPlace = {
  hunt:  Pick<HuntT, typeof Hunt.exposed[number]>
  realm: Pick<RealmT, typeof Realm.exposed[number]>
}

/**
 * The document a widget's input formula reads, for one question and one widgeting.
 *
 * Ids are stripped and everything is referred to by label: a question's `chains_to` is the
 * label of the question it chains to, so `qns[label = $$.qn.chains_to]` is that question. Each
 * question carries its `rank`, and the widgeted of every widgeting before this one under that
 * widgeting's label.
 */
export type QuizBag = QuizPlace & {
  /** The quiz's own exposed fields, without its questions and its widgetings */
  quiz:            Record<string, unknown>
  /** Every question in the quiz, in the quiz's order */
  qns:             Record<string, unknown>[]
  /** The question being worked out; the very object also found in `qns` */
  qn:              Record<string, unknown>
  qn_label:        string
  quiz_label:      string
  /** The running widgeting's params */
  params:          Record<string, JsonT>
  /** The running widgeting's label */
  widgeting_label: string
}

/** One widgeting in the run order, and the widget it works: null when the library holds none by its `widget_label` */
export type RunStep = {
  widgeting: WidgetingT
  widget:    LibraryWidgetT | null
}

/** What a quiz is run from: its questions, where it sits, its widgetings in run order, and its stored widgeteds */
export type RunSource = {
  quiz:     QuizT
  place:    QuizPlace
  steps:    readonly RunStep[]
  /** A stored widgeting's history for one question; null when nothing was ever recorded there */
  storedOf: (widgeting: WidgetingT, question: QuestionT) => WidgetedHistoryT | null
}

/** Each widgeting's label to something per question, by the question's id */
type ByWidgeting<VT> = ReadonlyMap<string, ReadonlyMap<string, VT>>

/** A quiz, run: every widgeting's widgeted for every question, and what its runs were worked out from */
export type QuizRun = {
  steps:     readonly RunStep[]
  /** Every widgeting's widgeted, for every question */
  widgeteds: ByWidgeting<WidgetedT>
  /** For each widgeting asked from the cell, what each question's ask would be put */
  inputs:    ByWidgeting<InputOutcome>
  /** The cells whose formula marked its value stale, by `cellkeyOf` (the `{ value, stale }` form, retiring) */
  stale:     ReadonlySet<string>
  /** The questions as each widgeting's bag holds them, by its label */
  qnsAt:     ReadonlyMap<string, readonly Record<string, unknown>[]>
  /** The questions as they stand once every widgeting has run */
  qnsAfter:  readonly Record<string, unknown>[]
  /** What every bag holds besides its questions and its widgeting */
  frame:     BagFrame
}

/** What every one of a quiz's bags holds, whichever question and widgeting it is for */
type BagFrame = QuizPlace & Pick<QuizBag, 'quiz' | 'quiz_label'> & {
  question_ids: readonly string[]
  qn_labels:    readonly string[]
}

/** How many of a widgeting's cells are in each state */
export type StatusCounts = Record<WidgetedStatus, number>

/** What a widgeting reads as when the library holds no widget by its name */
const GoneMessage = (widget_label: string) => `There is no widget called "${widget_label}" any more`

/**
 * A quiz run: each widgeting in run order, each worked out for every question, or projected from
 * what was stored, with the widgeteds of those before it in its bag.
 *
 * Nothing here throws, and nothing is asked of a model. A formula that fails costs its own cells;
 * one that will not stop is stopped, after which the rest of its widgeting reads the same failure
 * rather than waiting on it again. A widgeting whose widget is gone reads as that failure.
 *
 * @param source - The quiz, its place, its widgetings and their widgets, and its stored widgeteds.
 * @returns The run.
 *
 * @example widgetedOf(runQuiz(source), 'clueing_full', question._id)  // => { status: 'ok', value: 312, err: null }
 */
export function runQuiz(source: RunSource): QuizRun {
  const { quiz } = source
  const frame = frameOf(quiz, source.place)
  const widgeteds = new Map<string, ReadonlyMap<string, WidgetedT>>()
  const inputs = new Map<string, ReadonlyMap<string, InputOutcome>>()
  const stale = new Set<string>()
  const qnsAt = new Map<string, readonly Record<string, unknown>[]>()
  let qns = baseQns(quiz)
  for (const step of source.steps) {
    const { label } = step.widgeting
    qnsAt.set(label, qns)
    const bags = bagsOf(frame, qns, step.widgeting)
    const column = columnOf(step, bags, quiz.questions, source.storedOf)
    widgeteds.set(label, new Map(frame.question_ids.map((question_id, idx) => [question_id, column.widgeteds[idx] ?? Widgeted.missing])))
    if (column.inputs) { inputs.set(label, new Map(frame.question_ids.map((question_id, idx) => [question_id, column.inputs?.[idx] ?? { status: 'missing' }]))) }
    for (const idx of column.stale) { stale.add(cellkeyOf(label, frame.question_ids[idx] ?? '')) }
    qns = withWidgeteds(qns, label, column.widgeteds)
  }
  return { steps: source.steps, widgeteds, inputs, stale, qnsAt, qnsAfter: qns, frame }
}

/**
 * One question's widgeted for one widgeting, or `missing` when the run has no such cell.
 *
 * @example widgetedOf(run, 'numnum_clueing', question._id).status  // => 'ok'
 */
export function widgetedOf(run: QuizRun, label: string, question_id: string): WidgetedT {
  return run.widgeteds.get(label)?.get(question_id) ?? Widgeted.missing
}

/**
 * What one question's ask of a widgeting would be put, or `missing` when there is nothing to ask
 * about (or the widgeting is not asked from the cell).
 *
 * @example inputOf(run, 'dumdum', question._id)  // => { status: 'ok', input: { clueing: 'Who?' } }
 */
export function inputOf(run: QuizRun, label: string, question_id: string): InputOutcome {
  return run.inputs.get(label)?.get(question_id) ?? { status: 'missing' }
}

/**
 * Whether one cell's formula marked its value as out of date. Retiring with the `{ value,
 * stale }` form.
 */
export function isStale(run: QuizRun, label: string, question_id: string): boolean {
  return run.stale.has(cellkeyOf(label, question_id))
}

/**
 * The step working the widgeting labelled `label`, or null when the quiz has none.
 *
 * @example stepOf(run, 'dumdum')?.widget?.formulary  // => 'aibot'
 */
export function stepOf(run: QuizRun, label: string): RunStep | null {
  return run.steps.find((step) => step.widgeting.label === label) ?? null
}

/**
 * Each question's bag as `widgeting` sees it: with the widgeteds of those before it, when the
 * quiz runs it; with every widgeting's, when it does not (a widgeting not yet put to work).
 *
 * @param run - The quiz, run.
 * @param widgeting - Whose bag: its label, and the params it hands on.
 * @returns One bag per question, by the question's id, in the quiz's order.
 *
 * @example bagsAt(run, { label: 'clueing_full', params: {} }).get(question._id)?.qn.numnum_clueing
 */
export function bagsAt(run: QuizRun, widgeting: Pick<WidgetingT, 'label' | 'params'>): ReadonlyMap<string, QuizBag> {
  const qns = run.qnsAt.get(widgeting.label) ?? run.qnsAfter
  const bags = bagsOf(run.frame, qns, widgeting)
  return new Map(run.frame.question_ids.map((question_id, idx) => [question_id, bags[idx] ?? emptyBag(run.frame, widgeting)]))
}

/**
 * How many of a widgeting's cells are `ok`, `errored` and `missing`.
 *
 * @example statusCounts(run, 'dumdum')  // => { ok: 3, errored: 1, missing: 2 }
 */
export function statusCounts(run: QuizRun, label: string): StatusCounts {
  const counts: StatusCounts = { ok: 0, errored: 0, missing: 0 }
  for (const question_id of run.frame.question_ids) { counts[widgetedOf(run, label, question_id).status] += 1 }
  return counts
}

/**
 * A stored cell's widgeted, from its history: the newest `ok` row is the value, and a newer
 * `errored` row rides along on it as `err`; only `errored` rows make the cell `errored`; no row
 * makes it `missing`.
 *
 * @param history - The cell's newest row and newest `ok` row, or null when it has none.
 * @returns The widgeted, as everyone reads it.
 *
 * @example widgetedFrom(null)  // => { status: 'missing', value: null, err: null }
 * @example widgetedFrom({ newest: failedRow, ok: answeredRow })  // => { status: 'ok', value: answeredRow.value, err: { message: failedRow.message, ... } }
 */
export function widgetedFrom(history: WidgetedHistoryT | null): WidgetedT {
  if (history === null) { return Widgeted.missing }
  const { newest, ok } = history
  if (ok === null) { return Widgeted.errored(errOf(newest)) }
  return Widgeted.ok(ok.value, newest.status === 'errored' ? errOf(newest) : null)
}

/**
 * Where a quiz sits, as its formulas and its history are told: the hunt's and the realm's
 * exposed fields, each label the one in force and each title as shown, never blank.
 *
 * @param hunt - The quiz's hunt, as a row or a screen holds it.
 * @param realm - The realm it sits in.
 * @returns Its place.
 *
 * @example placeOf({ label: 'deep_lake', forced_label: null, title: '' }, { label: 'home', title: '' })
 *   // => { hunt: { label: 'deep_lake', title: 'Deep Lake' }, realm: { label: 'home', title: 'Home' } }
 */
export function placeOf(hunt: Pick<HuntT, 'label' | 'forced_label' | 'title'>, realm: Pick<RealmT, 'label' | 'title'>): QuizPlace {
  return {
    hunt:  { ..._.pick(hunt, Hunt.exposed), label: Labelmaker.effectiveLabelOf(hunt), title: huntTitleOf(hunt) },
    realm: { ..._.pick(realm, Realm.exposed), title: realmTitleOf(realm) },
  }
}

/** One cell, as one string */
function cellkeyOf(label: string, question_id: string): string {
  return `${label}:${question_id}`
}

/** A stored failure, as the `err` its cell carries */
function errOf(row: StoredWidgetedT): WidgetedErrT {
  return { message: row.message ?? '', at: Math.floor(row._creationTime), response: row.result_meta.response ?? null }
}

/** What every bag of `quiz` holds besides its questions and its widgeting */
function frameOf(quiz: QuizT, place: QuizPlace): BagFrame {
  const quiz_label = Labelmaker.effectiveLabelOf(quiz)
  return {
    hunt:         place.hunt,
    realm:        place.realm,
    quiz:         { ..._.pick(quiz, Quiz.exposed), label: quiz_label },
    quiz_label,
    question_ids: quiz.questions.map((question) => question._id),
    qn_labels:    quiz.questions.map((question) => Labelmaker.effectiveLabelOf(question)),
  }
}

/** Each question's bag for `widgeting`, in the quiz's order, over `qns` */
function bagsOf(frame: BagFrame, qns: readonly Record<string, unknown>[], widgeting: Pick<WidgetingT, 'label' | 'params'>): QuizBag[] {
  const shared = qns as Record<string, unknown>[]
  return frame.qn_labels.map((qn_label, idx) => ({
    hunt:            frame.hunt,
    realm:           frame.realm,
    quiz:            frame.quiz,
    qns:             shared,
    qn:              shared[idx] ?? {},
    qn_label,
    quiz_label:      frame.quiz_label,
    params:          widgeting.params,
    widgeting_label: widgeting.label,
  }))
}

/** A bag for no question, for a quiz with none */
function emptyBag(frame: BagFrame, widgeting: Pick<WidgetingT, 'label' | 'params'>): QuizBag {
  return { hunt: frame.hunt, realm: frame.realm, quiz: frame.quiz, qns: [], qn: {}, qn_label: '', quiz_label: frame.quiz_label, params: widgeting.params, widgeting_label: widgeting.label }
}

/**
 * Every question as a formula sees it before any widgeting has run: only its exposed fields, its
 * label the one in force and its chain named by label, its rank added, and what the bots answered
 * under the fields they have always had (`guess`, `clueing_ishes`, `hint_ishes`, retiring).
 */
function baseQns(quiz: QuizT): Record<string, unknown>[] {
  const ranks = Rank.ranksOf(quiz.questions)
  const labelForId = new Map(quiz.questions.map((question) => [question._id, Labelmaker.effectiveLabelOf(question)]))
  return quiz.questions.map((question) => ({
    ..._.pick(question, Question.exposed),
    label:         labelForId.get(question._id) ?? question.label,
    chains_to:     question.chains_to === null ? null : labelForId.get(question.chains_to) ?? null,
    rank:          ranks.get(question._id) ?? null,
    guess:         exposeGuess(question.guess),
    clueing_ishes: exposeIshes(question.clueing_ishes),
    hint_ishes:    exposeIshes(question.hint_ishes),
  }))
}

/**
 * `qns` with each question's widgeted for one widgeting added under its label: new objects, so
 * the bags already handed out keep the questions as they were. A label that would shadow one of
 * a question's own keys is left out of the bag, so a formula never reads the wrong thing under a
 * question's own name.
 */
function withWidgeteds(qns: readonly Record<string, unknown>[], label: string, widgeteds: readonly WidgetedT[]): Record<string, unknown>[] {
  return qns.map((qn, idx) => (Object.hasOwn(qn, label) ? qn : { ...qn, [label]: widgeteds[idx] ?? Widgeted.missing }))
}

/** One widgeting's cells, in the quiz's order: their widgeteds, the inputs of a widgeting asked from the cell, and which are marked stale */
type Column = {
  widgeteds: WidgetedT[]
  inputs:    InputOutcome[] | null
  stale:     number[]
}

/** One widgeting worked out, or projected, for every question */
function columnOf(step: RunStep, bags: readonly QuizBag[], questions: readonly QuestionT[], storedOf: RunSource['storedOf']): Column {
  const { widgeting, widget } = step
  if (widget === null) {
    const gone = Widgeted.errored({ message: GoneMessage(widgeting.widget_label), at: null, response: null })
    return { widgeteds: bags.map(() => gone), inputs: null, stale: [] }
  }
  const formulary = formularyFor(widget)
  if (formulary.refresh === 'live') {
    const widgeteds: WidgetedT[] = []
    const stale: number[] = []
    let stopped: WidgetedT | null = null
    for (const [idx, bag] of bags.entries()) {
      if (stopped !== null) { widgeteds.push(stopped); continue }
      const ran = formulary.run(widget, widgeting, bag)
      widgeteds.push(ran.widgeted)
      if (ran.stale) { stale.push(idx) }
      if (ran.stops) { stopped = ran.widgeted }
    }
    return { widgeteds, inputs: null, stale }
  }
  return {
    widgeteds: questions.map((question) => widgetedFrom(storedOf(widgeting, question))),
    inputs:    bags.map((bag) => formulary.input(widget, bag)),
    stale:     [],
  }
}
