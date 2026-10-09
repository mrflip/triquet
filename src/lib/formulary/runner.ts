import * as Estimates from '../estimates'
import * as Wheel from '../wheel'
import { huntTitleOf, realmTitleOf } from '../rows'
import { clockNow, soonerOf } from '../clock'
import type { CategoryBodyT, HuntBodyT, RealmBodyT } from '../jsonball'
import { formularyFor, type Formulary, type InputOutcome, type LiveFormulary } from './formularies'
import type { HuntT } from '../../models/hunt'
import type { QuestionT } from '../../models/question'
import type { QuizT } from '../../models/quiz'
import { Bagged } from '../../models/quiz-bag'
import type { RealmT } from '../../models/realm'
import { Widgeted, type JsonT, type StoredWidgetedT, type WidgetedErrT, type WidgetedHistoryT, type WidgetedStatus, type WidgetedT } from '../../models/widgeted'
import type { CategoryLabel, WheelT } from '../../models/category'
import type { WidgetT } from '../../models/widget'
import type { WidgetingT } from '../../models/widgeting'

/**
 * Where a quiz sits: its hunt and its realm, each as the outside world sees it -- the label in
 * force and the title as shown, and the hunt's branch and stamps -- and the hunt's categories by
 * label and in their total order. What a formula reads as `hunt`, `realm` and `categories`, where
 * the quiz's history keeps its files, and what its category estimates are read against.
 */
export type QuizPlace = {
  hunt:       HuntBodyT
  realm:      RealmBodyT
  /** The hunt's categories by label, in its total order, each with the slot of its wheel it holds (`Bagged.categories`) */
  categories: Readonly<Record<CategoryLabel, CategoryBodyT>>
  /** The hunt's total order of categories (`Wheel.orderOf`), which Masie, Artie and Poppy's chances are read against */
  order:      readonly CategoryLabel[]
}

/**
 * The document a widget's input formula reads, for one question and one widgeting: the quiz in
 * the shape its export holds it (`QuizBagValidators.quizBag`), as it stands when the widgeting runs.
 *
 * Ids are stripped and everything is referred to by label: `questions` holds every question under
 * its label, in the quiz's order, so `$lookup(questions, question.chains_to)` is the question this
 * one chains to. Each question carries its place, its own fields, its viz and stamps, its `rank`,
 * whether it is `archived` and whether it is `secondary` (an alternate), and the widgeted of every
 * widgeting before this one under that widgeting's label, as its `status` and `value`.
 */
export type QuizBag = Pick<QuizPlace, 'hunt' | 'realm' | 'categories'> & {
  /** The quiz's own fields, without its questions and its layout, and the widgeteds of its widgetings for the whole quiz before this one */
  quiz:            Record<string, unknown>
  /** Every question in the quiz under its label, the archived among them, in the quiz's order */
  questions:       Readonly<Record<string, Record<string, unknown>>>
  /** The question being worked out; the very object also found in `questions`. Empty for none */
  question:        Record<string, unknown>
  hunt_label:      string
  realm_label:     string
  quiz_label:      string
  /** The label of `question`; blank for none */
  question_label:  string
  /** The running widgeting's params */
  params:          Record<string, JsonT>
  /** The running widgeting's label */
  widgeting_label: string
}

/** The bag less what only a running widgeting has (its `params` and `widgeting_label`): what a template reads (`Templating.TemplateBag`) */
export type BaseBag = Omit<QuizBag, 'params' | 'widgeting_label'>

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
  /** Its widgetings, in run order (`inRunOrder`): every entry first, then the rest by their positions, the two tiers mixed as the author placed them */
  steps:     readonly RunStep[]
  /** Every question widgeting's widgeted, for every question */
  widgeteds: ByWidgeting<WidgetedT>
  /** Every widgeting for the whole quiz, and what it came to, by its label */
  quizWidgeteds: ReadonlyMap<string, WidgetedT>
  /** For each widgeting asked from the cell, what each question's ask would be put */
  inputs:    ByWidgeting<InputOutcome>
  /** The questions, in the quiz's order, as each widgeting's bag holds them, by its label */
  questionsAt:    ReadonlyMap<string, readonly Record<string, unknown>[]>
  /** The questions, in the quiz's order, as they stand once every widgeting has run */
  questionsAfter: readonly Record<string, unknown>[]
  /** The quiz as each widgeting's bag holds it, with the widgeteds of the quiz's own widgetings before it, by its label */
  quizAt:    ReadonlyMap<string, Record<string, unknown>>
  /** What every bag holds besides its questions and its widgeting; its quiz as it stands once every widgeting has run */
  frame:     BagFrame
}

/** What every one of a quiz's bags holds, whichever question and widgeting it is for */
export type BagFrame = QuizPlace & Pick<QuizBag, 'quiz'> & {
  question_ids:    readonly string[]
  question_labels: readonly string[]
}

/** How many of a widgeting's cells are in each state */
export type StatusCounts = Record<WidgetedStatus, number>

/**
 * How long one run of a quiz may spend working out its formulas and templates, all its columns
 * told, in milliseconds: five seconds, a loose bound on how long one change may hang a page. Only
 * the browser runs a quiz (a sort is worked out there, and the server commits its order), so no
 * mutation's time limit sets it. A column begun after it is not worked out at all; one under way
 * when it runs out is stopped where it stands. An ordinary quiz's run takes a few milliseconds; a
 * formula searching every question for each (`questions.*[label = $$.question.chains_to]`) about
 * a quarter second a column over 300 questions; a lookup by label (`$lookup`) far less. A column's own formula, worked out apart from the run, has as long
 * (`Columns.shownOf`).
 */
export const RunMs = 5000

/** What every cell of a column reads when the run's time ran out before the column was begun */
const RunOverMessage = 'The quiz took too long to work out, so this column was not: a slow formula or template in a column before it, perhaps.'

/** What a widgeting reads as when the library holds no widget by its name */
const GoneMessage = (widget_label: string) => `There is no widget called "${widget_label}" any more`

/**
 * A quiz run: each widgeting in run order (`inRunOrder`: every entry first, then the rest by its
 * position, whichever tier it runs at), each worked out for every question, or projected from
 * what was stored, with the widgeteds of those before it in its bag. A widgeting for the whole
 * quiz is worked out once, over a bag for no question (`question` empty) whose questions stand as
 * the widgetings before it left them, and its widgeted joins every later bag's quiz, as
 * `quiz.<label>`; a question widgeting reads every one before it.
 *
 * Nothing here throws, and nothing is asked of a model. A formula that fails costs its own cells;
 * one that will not stop is stopped, after which the rest of its widgeting reads the same failure
 * rather than waiting on it again; and a formulary that bounds a whole column (`columnMs`, a
 * template's) is stopped there too, once the column has had its time. The run as a whole has
 * `RunMs`: a column under way when it runs out is stopped as at its own bound, and every column
 * after reads that the run ran out. A widgeting whose widget is gone reads as that failure.
 *
 * @param source - The quiz, its place, its widgetings and their widgets, and its stored widgeteds.
 * @returns The run.
 *
 * @example widgetedOf(runQuiz(source), 'clueing_full', question._id)  // => { status: 'ok', value: 312, err: null }
 */
export function runQuiz(source: RunSource): QuizRun {
  const { quiz } = source
  const frame = frameOf(quiz, source.place)
  const steps = inRunOrder(source.steps)
  const widgeteds = new Map<string, ReadonlyMap<string, WidgetedT>>()
  const quizWidgeteds = new Map<string, WidgetedT>()
  const inputs = new Map<string, ReadonlyMap<string, InputOutcome>>()
  const questionsAt = new Map<string, readonly Record<string, unknown>[]>()
  const quizAt = new Map<string, Record<string, unknown>>()
  let questions = baseQuestionsOf(quiz)
  let quizNow = frame.quiz
  const runDeadline = clockNow() + RunMs
  for (const step of steps) {
    const { label } = step.widgeting
    questionsAt.set(label, questions)
    quizAt.set(label, quizNow)
    if (step.widgeting.tier === 'quiz') {
      const widgeted = quizCellOf(step, quizBagOf(frame, quizNow, questions, step.widgeting), source.quizStoredOf, runDeadline)
      quizWidgeteds.set(label, widgeted)
      quizNow = { ...quizNow, [label]: Bagged.widgeted(widgeted) }
      continue
    }
    const bags = bagsOf(frame, quizNow, questions, step.widgeting)
    const column = columnOf(step, bags, quiz.questions, source.storedOf, runDeadline)
    widgeteds.set(label, new Map(frame.question_ids.map((question_id, idx) => [question_id, column.widgeteds[idx] ?? Widgeted.missing])))
    if (column.inputs) { inputs.set(label, new Map(frame.question_ids.map((question_id, idx) => [question_id, column.inputs?.[idx] ?? { status: 'missing' }]))) }
    const cellParts = Estimates.isEstimating(step.widget) ? column.widgeteds.map((widgeted) => Estimates.partsOf(frame.order, widgeted)) : null
    questions = withWidgeteds(questions, label, column.widgeteds, cellParts)
  }
  return { steps, widgeteds, quizWidgeteds, inputs, questionsAt, questionsAfter: questions, quizAt, frame: { ...frame, quiz: quizNow } }
}

/**
 * Steps in the order they run: every entry first, of either tier, and then the rest as placed.
 * An entry reads nothing, so nothing it could read is ever missed by running it early, and every
 * formula and prompt after it reads what was typed. The order among the entries is theirs as
 * placed, and harmless. A step whose widget is gone is not known to be an entry, and keeps its place.
 *
 * @param steps - Widgetings, or anything carrying one with its widget, in position order.
 * @returns The same, entries first.
 *
 * @example inRunOrder([guess, remark]).map((step) => step.widgeting.label)  // => ['remark', 'guess']
 */
export function inRunOrder<ST extends Pick<RunStep, 'widget'>>(steps: readonly ST[]): ST[] {
  return [...steps.filter((step) => isEntryStep(step)), ...steps.filter((step) => ! isEntryStep(step))]
}

/**
 * Whether a step is an entry's, which runs ahead of every other and is never placed among them.
 *
 * @example isEntryStep({ widget: remarkEntry })  // => true
 * @example isEntryStep({ widget: null })         // => false
 */
export function isEntryStep(step: Pick<RunStep, 'widget'>): boolean {
  return step.widget?.formulary === 'entry'
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
 * One question's widgeted for one widgeting, or `missing` when the run has no such cell (a
 * widgeting for the whole quiz has none for any question).
 *
 * @param run - The quiz, run.
 * @param label - The widgeting's label.
 * @param question_id - The question's id.
 *
 * @example widgetedOf(run, 'numnum_clueing', question._id).status    // => 'ok'
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
 * @example bagsAt(run, { label: 'clueing_full', params: {} }).get(question._id)?.question.numnum_clueing
 */
export function bagsAt(run: QuizRun, widgeting: Pick<WidgetingT, 'label' | 'params'>): ReadonlyMap<string, QuizBag> {
  const questions = run.questionsAt.get(widgeting.label) ?? run.questionsAfter
  const quiz = run.quizAt.get(widgeting.label) ?? run.frame.quiz
  if (isQuizWide(run, widgeting.label)) {
    const bag = quizBagOf(run.frame, quiz, questions, widgeting)
    return new Map(run.frame.question_ids.map((question_id) => [question_id, bag]))
  }
  const bags = bagsOf(run.frame, quiz, questions, widgeting)
  return new Map(run.frame.question_ids.map((question_id, idx) => [question_id, bags[idx] ?? emptyBag(run.frame, widgeting)]))
}

/**
 * The bag a widgeting for the whole quiz reads, or would read: for no question, with the
 * widgeteds of those before it (of every widgeting, for one the quiz does not run).
 *
 * @example quizBagAt(run, { label: 'grand_total', params: {} }).questions.leon?.clueing_full
 */
export function quizBagAt(run: QuizRun, widgeting: Pick<WidgetingT, 'label' | 'params'>): QuizBag {
  return quizBagOf(run.frame, run.quizAt.get(widgeting.label) ?? run.frame.quiz, run.questionsAt.get(widgeting.label) ?? run.questionsAfter, widgeting)
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
 * Where a quiz sits, as its formulas and its history are told: the hunt's own fields (`Bagged.hunt`)
 * and the realm's, each title as shown, never blank; and the hunt's categories, by label and in
 * the total order of its wheel, the default one for a hunt that holds none.
 *
 * @param hunt - The quiz's hunt, as a row or a screen holds it, with its wheel when it has one.
 * @param realm - The realm it sits in.
 * @returns Its place.
 *
 * @example placeOf({ label: 'deep_lake', title: '' }, { label: 'home', title: '' })
 *   // => { hunt: { label: 'deep_lake', title: 'Deep Lake', branch: 'main', ... }, realm: { label: 'home', title: 'Home' }, categories: { math_econ: { ... }, ... }, order: ['math_econ', 'gen_sci', ...] }
 */
export function placeOf(hunt: Pick<HuntT, 'label' | 'title'> & { branch?: string, created_at?: number | null, updated_at?: number | null, wheel?: WheelT }, realm: Pick<RealmT, 'label' | 'title'>): QuizPlace {
  const wheel = hunt.wheel ?? Wheel.defaultWheel()
  return {
    hunt:       Bagged.hunt({ ...hunt, title: huntTitleOf(hunt) }),
    realm:      Bagged.realm({ label: realm.label, title: realmTitleOf(realm) }),
    categories: Bagged.categories(wheel),
    order:      Wheel.orderOf(wheel),
  }
}

/** A stored failure, as the `err` its cell carries */
function errOf(row: StoredWidgetedT): WidgetedErrT {
  return { message: row.message ?? '', at: Math.floor(row._creationTime), response: row.result_meta.response ?? null }
}

/** What every bag of `quiz` holds besides its questions and its widgeting */
function frameOf(quiz: QuizT, place: QuizPlace): BagFrame {
  return {
    ...place,
    quiz:            Bagged.quiz(quiz),
    question_ids:    quiz.questions.map((question) => question._id),
    question_labels: quiz.questions.map((question) => question.label),
  }
}

/**
 * The bag over `questions` (every question of the run, in its order, as they stand at some step)
 * and `quiz` as it stands then, for the question at `idx` among them, or for none (-1); less what
 * only a running widgeting has. The one place a bag is made: a formula's adds its widgeting's
 * own (`bagsOf`, `quizBagOf`), and a template's reads it as it is (`Templating.bagOf`).
 *
 * @param frame - What every bag of the run holds.
 * @param quiz - The quiz, as the bag holds it then.
 * @param questions - Every question, in the quiz's order, as the bag holds it then.
 * @param idx - The question being worked out among them, or -1 for none.
 *
 * @example baseBagOf(run.frame, run.frame.quiz, run.questionsAfter, 0).question_label  // => 'leon'
 */
export function baseBagOf(frame: BagFrame, quiz: Record<string, unknown>, questions: readonly Record<string, unknown>[], idx: number): BaseBag {
  return {
    hunt:           frame.hunt,
    realm:          frame.realm,
    categories:     frame.categories,
    quiz,
    questions:      Bagged.keyed(questions),
    question:       questions[idx] ?? {},
    hunt_label:     frame.hunt.label,
    realm_label:    frame.realm.label,
    quiz_label:     frame.quiz.label as string,
    question_label: frame.question_labels[idx] ?? '',
  }
}

/** Each question's bag for `widgeting`, in the quiz's order, over `quiz` and `questions` as they stand when it runs */
function bagsOf(frame: BagFrame, quiz: Record<string, unknown>, questions: readonly Record<string, unknown>[], widgeting: Pick<WidgetingT, 'label' | 'params'>): QuizBag[] {
  return frame.question_labels.map((_label, idx) => ({ ...baseBagOf(frame, quiz, questions, idx), params: widgeting.params, widgeting_label: widgeting.label }))
}

/** The one bag of a widgeting for the whole quiz: for no question, over `quiz` and `questions` as they stand when it runs */
function quizBagOf(frame: BagFrame, quiz: Record<string, unknown>, questions: readonly Record<string, unknown>[], widgeting: Pick<WidgetingT, 'label' | 'params'>): QuizBag {
  return { ...baseBagOf(frame, quiz, questions, -1), params: widgeting.params, widgeting_label: widgeting.label }
}

/** A bag for no question, for a quiz with none */
function emptyBag(frame: BagFrame, widgeting: Pick<WidgetingT, 'label' | 'params'>): QuizBag {
  return quizBagOf(frame, frame.quiz, [], widgeting)
}

/**
 * Every question as a formula sees it before any widgeting has run: as its export holds it
 * (`Bagged.questions`: its place, label, own fields, viz, chain by label and stamps), and its rank
 * and its viz, as two yes-or-nos, worked out beside them.
 */
function baseQuestionsOf(quiz: QuizT): Record<string, unknown>[] {
  const workedOut = Bagged.workedOut(quiz.questions)
  return Bagged.questions(quiz.questions).map((question, idx) => ({ ...question, ...workedOut[idx] }))
}

/**
 * `questions` with each question's widgeted for one widgeting added under its label, as its
 * status and value (`Bagged.widgeted`): new objects, so the bags already handed out keep the
 * questions as they were. No widgeting's label is one a question already answers to
 * (`ReservedWidgetingLabels`), so nothing is shadowed. A category-estimate widgeting's widgeted
 * carries its parts beside its status and value, so a formula reads `question.<label>.masie`.
 */
function withWidgeteds(questions: readonly Record<string, unknown>[], label: string, widgeteds: readonly WidgetedT[], parts: readonly (Estimates.EstimatePartsT | null)[] | null): Record<string, unknown>[] {
  return questions.map((question, idx) => ({ ...question, [label]: { ...Bagged.widgeted(widgeteds[idx] ?? Widgeted.missing), ...parts?.[idx] } }))
}

/** One widgeting's cells, in the quiz's order: their widgeteds, and the inputs of a widgeting asked from the cell */
type Column = {
  widgeteds: WidgetedT[]
  inputs:    InputOutcome[] | null
}

/**
 * One widgeting for the whole quiz worked out over its one bag by `runDeadline`, or projected from
 * what the quiz stored for it; one whose widget is gone reads as that failure.
 */
function quizCellOf(step: RunStep, bag: QuizBag, quizStoredOf: RunSource['quizStoredOf'], runDeadline: number): WidgetedT {
  const { widgeting, widget } = step
  if (widget === null) { return Widgeted.errored({ message: GoneMessage(widgeting.widget_label), at: null, response: null }) }
  const formulary = formularyFor(widget)
  if (formulary.refresh === 'live') {
    if (clockNow() >= runDeadline) { return runOver }
    return formulary.run(widget, widgeting, bag, deadlineOf(formulary, runDeadline)).widgeted
  }
  return widgetedFrom(quizStoredOf(widgeting))
}

/** What a live widgeting begun after its run's time ran out reads as */
const runOver = Widgeted.errored({ message: RunOverMessage, at: null, response: null })

/**
 * When a column of `formulary`'s, begun now, must be worked out by, on a clock that moves inside a
 * Convex mutation: its `columnMs` from now, or the run's deadline, whichever is sooner.
 */
function deadlineOf(formulary: LiveFormulary, runDeadline: number): number | undefined {
  return soonerOf(formulary.columnMs === null ? undefined : clockNow() + formulary.columnMs, runDeadline)
}

/** One widgeting worked out by `runDeadline`, or projected from what it stored (asked or typed), for every question */
function columnOf(step: RunStep, bags: readonly QuizBag[], questions: readonly QuestionT[], storedOf: RunSource['storedOf'], runDeadline: number): Column {
  const { widgeting, widget } = step
  if (widget === null) {
    const gone = Widgeted.errored({ message: GoneMessage(widgeting.widget_label), at: null, response: null })
    return { widgeteds: bags.map(() => gone), inputs: null }
  }
  const formulary = formularyFor(widget)
  if (formulary.refresh === 'live') {
    if (clockNow() >= runDeadline) { return { widgeteds: bags.map(() => runOver), inputs: null } }
    const widgeteds: WidgetedT[] = []
    const deadline = deadlineOf(formulary, runDeadline)
    let stopped: WidgetedT | null = null
    for (const bag of bags) {
      if (stopped !== null) { widgeteds.push(stopped); continue }
      const ran = formulary.run(widget, widgeting, bag, deadline)
      widgeteds.push(ran.widgeted)
      if (ran.stops) { stopped = ran.widgeted }
    }
    return { widgeteds, inputs: null }
  }
  // A stored widgeting is projected from its rows; only one asked from the cell has inputs to say.
  return {
    widgeteds: questions.map((question) => widgetedFrom(storedOf(widgeting, question))),
    inputs:    formulary.refresh === 'click' ? inputsOf(formulary, widget, bags, runDeadline) : null,
  }
}

/** What the input of a widgeting asked from the cell reads as, begun after its run's time ran out */
const inputRunOver: InputOutcome = { status: 'errored', message: RunOverMessage, stops: true }

/**
 * What each question's ask of a widgeting asked from the cell would be put, its input formula
 * worked out by `runDeadline`: one that will not stop stops the rest, each reading the same failure.
 * Begun after the run's time ran out, every one reads that the run ran out, as a live column does.
 */
function inputsOf(formulary: Formulary, widget: WidgetT, bags: readonly QuizBag[], runDeadline: number): InputOutcome[] {
  if (clockNow() >= runDeadline) { return bags.map(() => inputRunOver) }
  const inputs: InputOutcome[] = []
  let stopped: InputOutcome | null = null
  for (const bag of bags) {
    const input: InputOutcome = stopped ?? formulary.input(widget, bag, runDeadline)
    if (input.status === 'errored' && input.stops) { stopped = input }
    inputs.push(input)
  }
  return inputs
}
