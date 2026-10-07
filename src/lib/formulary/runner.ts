import _ from 'es-toolkit/compat'
import * as Rank from '../rank'
import * as Estimates from '../estimates'
import * as Wheel from '../wheel'
import { huntTitleOf, realmTitleOf } from '../rows'
import { formularyFor, type InputOutcome } from './formularies'
import { Hunt, type HuntT } from '../../models/hunt'
import { Question, RankField, type QuestionT } from '../../models/question'
import { Quiz, type QuizT } from '../../models/quiz'
import { Realm, type RealmT } from '../../models/realm'
import { Widgeted, type JsonT, type StoredWidgetedT, type WidgetedErrT, type WidgetedHistoryT, type WidgetedStatus, type WidgetedT } from '../../models/widgeted'
import type { CategoryLabel, WheelT } from '../../models/category'
import type { WidgetingPart } from '../../models/column'
import type { WidgetT } from '../../models/widget'
import type { WidgetingT } from '../../models/widgeting'

/**
 * Where a quiz sits: its hunt and its realm, each as the outside world sees it -- the label in
 * force and the title as shown -- and the hunt's categories in their total order. What a formula
 * reads as `hunt` and `realm`, where the quiz's history keeps its files, and what its category
 * estimates are read against.
 */
export type QuizPlace = {
  hunt:  Pick<HuntT, typeof Hunt.exposed[number]>
  realm: Pick<RealmT, typeof Realm.exposed[number]>
  /** The hunt's total order of categories (`Wheel.orderOf`), which Masie, Artie and Poppy's chances are read against */
  order: readonly CategoryLabel[]
}

/**
 * The document a widget's input formula reads, for one question and one widgeting.
 *
 * Ids are stripped and everything is referred to by label: a question's `chains_to` is the
 * label of the question it chains to, so `qns[label = $$.qn.chains_to]` is that question. Each
 * question carries its `rank`, and the widgeted of every widgeting before this one under that
 * widgeting's label.
 */
export type QuizBag = Pick<QuizPlace, 'hunt' | 'realm'> & {
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
  widget:    WidgetT | null
}

/** What a quiz is run from: its questions, where it sits, its widgetings, and its stored widgeteds */
export type RunSource = {
  quiz:     QuizT
  place:    QuizPlace
  /** Its widgetings in position order, which is their run order, each with its widget */
  steps:    readonly RunStep[]
  /** A stored widgeting's history for one question; null when nothing was ever recorded there */
  storedOf: (widgeting: WidgetingT, question: QuestionT) => WidgetedHistoryT | null
  /** A stored widgeting's history for the quiz itself, for one that runs once for the whole quiz; null when nothing was ever recorded */
  quizStoredOf: (widgeting: WidgetingT) => WidgetedHistoryT | null
}

/** Each widgeting's label to something per question, by the question's id */
type ByWidgeting<VT> = ReadonlyMap<string, ReadonlyMap<string, VT>>

/** A quiz, run: every widgeting's widgeted for every question, or for the quiz, and what its runs were worked out from */
export type QuizRun = {
  /** Its widgetings, in run order: their positions, the two tiers mixed as the author placed them */
  steps:     readonly RunStep[]
  /** Every question widgeting's widgeted, for every question */
  widgeteds: ByWidgeting<WidgetedT>
  /** Every widgeting for the whole quiz, and what it came to, by its label */
  quizWidgeteds: ReadonlyMap<string, WidgetedT>
  /** For each category-estimate widgeting, what each question's estimates come to; null for a cell that failed */
  parts:     ByWidgeting<Estimates.EstimatePartsT | null>
  /** For each widgeting asked from the cell, what each question's ask would be put */
  inputs:    ByWidgeting<InputOutcome>
  /** The questions as each widgeting's bag holds them, by its label */
  qnsAt:     ReadonlyMap<string, readonly Record<string, unknown>[]>
  /** The questions as they stand once every widgeting has run */
  qnsAfter:  readonly Record<string, unknown>[]
  /** The quiz as each widgeting's bag holds it, with the widgeteds of the quiz's own widgetings before it, by its label */
  quizAt:    ReadonlyMap<string, Record<string, unknown>>
  /** What every bag holds besides its questions and its widgeting; its quiz as it stands once every widgeting has run */
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
 * A quiz run: each widgeting in run order (its position, whichever tier it runs at), each worked
 * out for every question, or projected from what was stored, with the widgeteds of those before
 * it in its bag. A widgeting for the whole quiz is worked out once, over a bag for no question
 * (`qn` empty) whose questions stand as the widgetings before it left them, and its widgeted
 * joins every later bag's quiz, as `quiz.<label>`; a question widgeting reads every one before it.
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
  const { steps } = source
  const widgeteds = new Map<string, ReadonlyMap<string, WidgetedT>>()
  const quizWidgeteds = new Map<string, WidgetedT>()
  const parts = new Map<string, ReadonlyMap<string, Estimates.EstimatePartsT | null>>()
  const inputs = new Map<string, ReadonlyMap<string, InputOutcome>>()
  const qnsAt = new Map<string, readonly Record<string, unknown>[]>()
  const quizAt = new Map<string, Record<string, unknown>>()
  let qns = baseQns(quiz)
  let quizNow = frame.quiz
  for (const step of steps) {
    const { label } = step.widgeting
    qnsAt.set(label, qns)
    quizAt.set(label, quizNow)
    if (step.widgeting.tier === 'quiz') {
      const widgeted = quizCellOf(step, quizBagOf(frame, quizNow, qns, step.widgeting), source.quizStoredOf)
      quizWidgeteds.set(label, widgeted)
      quizNow = { ...quizNow, [label]: widgeted }
      continue
    }
    const bags = bagsOf(frame, quizNow, qns, step.widgeting)
    const column = columnOf(step, bags, quiz.questions, source.storedOf)
    widgeteds.set(label, new Map(frame.question_ids.map((question_id, idx) => [question_id, column.widgeteds[idx] ?? Widgeted.missing])))
    if (column.inputs) { inputs.set(label, new Map(frame.question_ids.map((question_id, idx) => [question_id, column.inputs?.[idx] ?? { status: 'missing' }]))) }
    const cellParts = Estimates.isEstimating(step.widget) ? column.widgeteds.map((widgeted) => Estimates.partsOf(frame.order, widgeted)) : null
    if (cellParts) { parts.set(label, new Map(frame.question_ids.map((question_id, idx) => [question_id, cellParts[idx] ?? null]))) }
    qns = withWidgeteds(qns, label, column.widgeteds, cellParts)
  }
  return { steps, widgeteds, quizWidgeteds, parts, inputs, qnsAt, qnsAfter: qns, quizAt, frame: { ...frame, quiz: quizNow } }
}

/**
 * What a quiz is run from, read from what the browser holds: its widgetings in run order, each
 * with the library's widget by its `widget_label`, and what each question stored for them.
 *
 * @param quiz - The quiz, each question carrying what its stored widgetings recorded.
 * @param library - The library's widgets.
 * @param place - Where the quiz sits.
 * @returns The source for `runQuiz`.
 *
 * @example runQuiz(sourceOf(quiz, library, place))
 */
export function sourceOf(quiz: QuizT, library: readonly WidgetT[], place: QuizPlace): RunSource {
  const widgetFor = new Map(library.map((widget) => [widget.label, widget]))
  return {
    quiz,
    place,
    steps:    quiz.widgetings.map((widgeting) => ({ widgeting, widget: widgetFor.get(widgeting.widget_label) ?? null })),
    storedOf: (widgeting, question) => question.stored[widgeting.label] ?? null,
    quizStoredOf: (widgeting) => quiz.stored[widgeting.label] ?? null,
  }
}

/**
 * What a widgeting for the whole quiz came to, or `missing` when the run has no such widgeting
 * (or it runs for each question).
 *
 * @example quizWidgetedOf(runQuiz(source), 'playtesters')  // => { status: 'ok', value: 'Ada and Grace', err: null }
 */
export function quizWidgetedOf(run: QuizRun, label: string): WidgetedT {
  return run.quizWidgeteds.get(label) ?? Widgeted.missing
}

/**
 * Whether the widgeting labelled `label` runs once for the whole quiz in this run.
 *
 * @example isQuizWide(run, 'playtesters')  // => true
 */
export function isQuizWide(run: QuizRun, label: string): boolean {
  return run.quizWidgeteds.has(label)
}

/**
 * One question's widgeted for one widgeting, or for one part of it, or `missing` when the run has
 * no such cell (a widgeting for the whole quiz has none for any question). A part of a category-estimate widgeting is `ok` with its value, whether or not
 * anything was typed (an empty cell draws on no category in particular), and fails as the cell
 * does; a part of any other widgeting is `missing`.
 *
 * @param run - The quiz, run.
 * @param label - The widgeting's label.
 * @param question_id - The question's id.
 * @param part - One part of what the widgeting came to, or null for the whole of it.
 *
 * @example widgetedOf(run, 'numnum_clueing', question._id).status    // => 'ok'
 * @example widgetedOf(run, 'categories', question._id, 'masie')      // => { status: 'ok', value: 0.525, err: null }
 */
export function widgetedOf(run: QuizRun, label: string, question_id: string, part: WidgetingPart | null = null): WidgetedT {
  const widgeted = run.widgeteds.get(label)?.get(question_id) ?? Widgeted.missing
  if (part === null) { return widgeted }
  const cells = run.parts.get(label)
  if (! cells) { return Widgeted.missing }
  const parts = cells.get(question_id)
  return parts ? Widgeted.ok(parts[part]) : widgeted
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
 * The step working the widgeting labelled `label`, or null when the quiz has none.
 *
 * @example stepOf(run, 'dumdum')?.widget?.formulary  // => 'aibot'
 */
export function stepOf(run: QuizRun, label: string): RunStep | null {
  return run.steps.find((step) => step.widgeting.label === label) ?? null
}

/**
 * Each question's bag as `widgeting` sees it: with the widgeteds of those before it, when the
 * quiz runs it; with every widgeting's, when it does not (a widgeting not yet put to work). A
 * widgeting for the whole quiz sees one bag, for no question, whichever question it is asked for.
 *
 * @param run - The quiz, run.
 * @param widgeting - Whose bag: its label, and the params it hands on.
 * @returns One bag per question, by the question's id, in the quiz's order.
 *
 * @example bagsAt(run, { label: 'clueing_full', params: {} }).get(question._id)?.qn.numnum_clueing
 */
export function bagsAt(run: QuizRun, widgeting: Pick<WidgetingT, 'label' | 'params'>): ReadonlyMap<string, QuizBag> {
  const qns = run.qnsAt.get(widgeting.label) ?? run.qnsAfter
  const quiz = run.quizAt.get(widgeting.label) ?? run.frame.quiz
  if (isQuizWide(run, widgeting.label)) {
    const bag = quizBagOf(run.frame, quiz, qns, widgeting)
    return new Map(run.frame.question_ids.map((question_id) => [question_id, bag]))
  }
  const bags = bagsOf(run.frame, quiz, qns, widgeting)
  return new Map(run.frame.question_ids.map((question_id, idx) => [question_id, bags[idx] ?? emptyBag(run.frame, widgeting)]))
}

/**
 * The bag a widgeting for the whole quiz reads, or would read: for no question, with the
 * widgeteds of those before it (of every widgeting, for one the quiz does not run).
 *
 * @example quizBagAt(run, { label: 'total', params: {} }).qns[0]?.clueing_full
 */
export function quizBagAt(run: QuizRun, widgeting: Pick<WidgetingT, 'label' | 'params'>): QuizBag {
  return quizBagOf(run.frame, run.quizAt.get(widgeting.label) ?? run.frame.quiz, run.qnsAt.get(widgeting.label) ?? run.qnsAfter, widgeting)
}

/**
 * How many of a widgeting's cells are `ok`, `errored` and `missing`: one for each question, or the
 * one of a widgeting for the whole quiz.
 *
 * @example statusCounts(run, 'dumdum')       // => { ok: 3, errored: 1, missing: 2 }
 * @example statusCounts(run, 'playtesters')  // => { ok: 1, errored: 0, missing: 0 }
 */
export function statusCounts(run: QuizRun, label: string): StatusCounts {
  const counts: StatusCounts = { ok: 0, errored: 0, missing: 0 }
  if (isQuizWide(run, label)) {
    counts[quizWidgetedOf(run, label).status] += 1
    return counts
  }
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
 * exposed fields, each title as shown, never blank; and the total order of the hunt's wheel, the
 * default one for a hunt that holds none.
 *
 * @param hunt - The quiz's hunt, as a row or a screen holds it, with its wheel when it has one.
 * @param realm - The realm it sits in.
 * @returns Its place.
 *
 * @example placeOf({ label: 'deep_lake', title: '' }, { label: 'home', title: '' })
 *   // => { hunt: { label: 'deep_lake', title: 'Deep Lake' }, realm: { label: 'home', title: 'Home' }, order: ['math_econ', 'gen_sci', ...] }
 */
export function placeOf(hunt: Pick<HuntT, 'label' | 'title'> & { wheel?: WheelT }, realm: Pick<RealmT, 'label' | 'title'>): QuizPlace {
  return {
    hunt:  { ..._.pick(hunt, Hunt.exposed), title: huntTitleOf(hunt) },
    realm: { ..._.pick(realm, Realm.exposed), title: realmTitleOf(realm) },
    order: Wheel.orderOf(hunt.wheel ?? Wheel.defaultWheel()),
  }
}

/** A stored failure, as the `err` its cell carries */
function errOf(row: StoredWidgetedT): WidgetedErrT {
  return { message: row.message ?? '', at: Math.floor(row._creationTime), response: row.result_meta.response ?? null }
}

/** What every bag of `quiz` holds besides its questions and its widgeting */
function frameOf(quiz: QuizT, place: QuizPlace): BagFrame {
  const quiz_label = quiz.label
  return {
    hunt:         place.hunt,
    realm:        place.realm,
    order:        place.order,
    quiz:         { ..._.pick(quiz, Quiz.exposed), label: quiz_label },
    quiz_label,
    question_ids: quiz.questions.map((question) => question._id),
    qn_labels:    quiz.questions.map((question) => question.label),
  }
}

/** Each question's bag for `widgeting`, in the quiz's order, over `quiz` and `qns` as they stand when it runs */
function bagsOf(frame: BagFrame, quiz: Record<string, unknown>, qns: readonly Record<string, unknown>[], widgeting: Pick<WidgetingT, 'label' | 'params'>): QuizBag[] {
  const shared = qns as Record<string, unknown>[]
  return frame.qn_labels.map((qn_label, idx) => ({
    hunt:            frame.hunt,
    realm:           frame.realm,
    quiz,
    qns:             shared,
    qn:              shared[idx] ?? {},
    qn_label,
    quiz_label:      frame.quiz_label,
    params:          widgeting.params,
    widgeting_label: widgeting.label,
  }))
}

/** The one bag of a widgeting for the whole quiz: for no question, over `quiz` and `qns` as they stand when it runs */
function quizBagOf(frame: BagFrame, quiz: Record<string, unknown>, qns: readonly Record<string, unknown>[], widgeting: Pick<WidgetingT, 'label' | 'params'>): QuizBag {
  return { hunt: frame.hunt, realm: frame.realm, quiz, qns: qns as Record<string, unknown>[], qn: {}, qn_label: '', quiz_label: frame.quiz_label, params: widgeting.params, widgeting_label: widgeting.label }
}

/** A bag for no question, for a quiz with none */
function emptyBag(frame: BagFrame, widgeting: Pick<WidgetingT, 'label' | 'params'>): QuizBag {
  return { hunt: frame.hunt, realm: frame.realm, quiz: frame.quiz, qns: [], qn: {}, qn_label: '', quiz_label: frame.quiz_label, params: widgeting.params, widgeting_label: widgeting.label }
}

/**
 * Every question as a formula sees it before any widgeting has run: only its exposed fields, its
 * chain named by label, and its rank added.
 */
function baseQns(quiz: QuizT): Record<string, unknown>[] {
  const ranks = Rank.ranksOf(quiz.questions)
  const labelForId = new Map(quiz.questions.map((question) => [question._id, question.label]))
  return quiz.questions.map((question) => ({
    ..._.pick(question, Question.exposed),
    label:       labelForId.get(question._id) ?? question.label,
    chains_to:   question.chains_to === null ? null : labelForId.get(question.chains_to) ?? null,
    [RankField]: ranks.get(question._id) ?? null,
  }))
}

/**
 * `qns` with each question's widgeted for one widgeting added under its label: new objects, so
 * the bags already handed out keep the questions as they were. No widgeting's label is one a
 * question already answers to (`ReservedWidgetingLabels`), so nothing is shadowed. A
 * category-estimate widgeting's widgeted carries its parts beside its status and value, so a
 * formula reads `qn.<label>.masie`.
 */
function withWidgeteds(qns: readonly Record<string, unknown>[], label: string, widgeteds: readonly WidgetedT[], parts: readonly (Estimates.EstimatePartsT | null)[] | null): Record<string, unknown>[] {
  return qns.map((qn, idx) => ({ ...qn, [label]: { ...widgeteds[idx] ?? Widgeted.missing, ...parts?.[idx] } }))
}

/** One widgeting's cells, in the quiz's order: their widgeteds, and the inputs of a widgeting asked from the cell */
type Column = {
  widgeteds: WidgetedT[]
  inputs:    InputOutcome[] | null
}

/**
 * One widgeting for the whole quiz worked out over its one bag, or projected from what the quiz
 * stored for it; one whose widget is gone reads as that failure.
 */
function quizCellOf(step: RunStep, bag: QuizBag, quizStoredOf: RunSource['quizStoredOf']): WidgetedT {
  const { widgeting, widget } = step
  if (widget === null) { return Widgeted.errored({ message: GoneMessage(widgeting.widget_label), at: null, response: null }) }
  const formulary = formularyFor(widget)
  if (formulary.refresh === 'live') { return formulary.run(widget, widgeting, bag).widgeted }
  return widgetedFrom(quizStoredOf(widgeting))
}

/** One widgeting worked out, or projected from what it stored (asked or typed), for every question */
function columnOf(step: RunStep, bags: readonly QuizBag[], questions: readonly QuestionT[], storedOf: RunSource['storedOf']): Column {
  const { widgeting, widget } = step
  if (widget === null) {
    const gone = Widgeted.errored({ message: GoneMessage(widgeting.widget_label), at: null, response: null })
    return { widgeteds: bags.map(() => gone), inputs: null }
  }
  const formulary = formularyFor(widget)
  if (formulary.refresh === 'live') {
    const widgeteds: WidgetedT[] = []
    let stopped: WidgetedT | null = null
    for (const bag of bags) {
      if (stopped !== null) { widgeteds.push(stopped); continue }
      const ran = formulary.run(widget, widgeting, bag)
      widgeteds.push(ran.widgeted)
      if (ran.stops) { stopped = ran.widgeted }
    }
    return { widgeteds, inputs: null }
  }
  // A stored widgeting is projected from its rows; only one asked from the cell has inputs to say.
  return {
    widgeteds: questions.map((question) => widgetedFrom(storedOf(widgeting, question))),
    inputs:    formulary.refresh === 'click' ? bags.map((bag) => formulary.input(widget, bag)) : null,
  }
}
