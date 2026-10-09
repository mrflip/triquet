import _ from 'es-toolkit/compat'
import type { OptimisticLocalStore } from 'convex/browser'
import type { FunctionArgs } from 'convex/server'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { qnumSortkeyOf } from '../lib/columns'
import * as Postmortem from '../lib/postmortem'
import * as Rank from '../lib/rank'
import { assembledQuiz, type QuizFrameT, type SeenQuestionT } from '../lib/rows'
import { ActionValidators, type HuntActionT } from '../models/actions'
import { refOf, sortkeyOf, widgetingSourceOf, type ColumnPatch, type ColumnT } from '../models/column'
import type { QuestionPatch } from '../models/question'
import type { Sortkey } from '../models/quiz'
import type { EntryValueT } from '../models/widget'
import type { WidgetedHistoryT } from '../models/widgeted'
import type { WidgetingPatch, WidgetingT } from '../models/widgeting'

/*
 * What the quiz on screen shows of a change before the server has it: Convex's optimistic
 * updates (`withOptimisticUpdate`) on the one mutation a quiz's screen writes through,
 * `hunts.perform`. Each patches the watched readings the change touches, the quiz's frame
 * (`quizzes.open`) and its questions (`questions.open`), as the server will write them, through
 * the same pure functions wherever there are some; the server's answer replaces it, and a change
 * it refuses is taken back. Every one lives here, so they move with the quiz's queries.
 */

/** The actions a quiz's screen shows at once: those whose wait for the server shows */
export const ShownEarlyKindVals = [
  'edit_question', 'set_chain', 'enter_widgeted', 'enter_quiz_widgeted',
  'edit_column', 'edit_widgeting', 'sort_questions', 'move_question',
] as const

/** An action shown at once, validated */
type ShownEarlyT = Extract<HuntActionT, { kind: typeof ShownEarlyKindVals[number] }>

/** What `hunts.perform` is called with: the browser's affirms, and the action */
type PerformArgs = FunctionArgs<typeof api.hunts.perform>

/** Whether an action of `kind` is one shown at once */
function isShownEarly(kind: string): kind is ShownEarlyT['kind'] {
  return (ShownEarlyKindVals as readonly string[]).includes(kind)
}

/**
 * Every watched reading of the quiz on screen an action changes, shown with the change made while
 * the write is on its way. An action not shown early, or one that does not read as an action (the
 * server refuses it), changes nothing here.
 *
 * @param store - The client's watched results, to patch.
 * @param args - What the mutation was called with.
 *
 * @example useMutation(api.hunts.perform).withOptimisticUpdate(showPerformed)
 */
export function showPerformed(store: OptimisticLocalStore, args: PerformArgs): void {
  // Convex runs an update again at every result while its write is on its way, and sends nothing
  // when one throws: one that cannot be shown is reported, and the change goes as it would have.
  try {
    showEarly(store, args)
  } catch (err) {
    Postmortem.report(`show a change at once (${args.action.kind})`, err, { action: args.action })
  }
}

/** As `showPerformed`, throwing what goes wrong */
function showEarly(store: OptimisticLocalStore, { affirms, action }: PerformArgs): void {
  if (! isShownEarly(action.kind)) { return }
  const read = ActionValidators.huntAction.safeParse(action)
  if (! read.success) { return }
  const performed = read.data as ShownEarlyT
  const { quiz_id } = affirms
  switch (performed.kind) {
  case 'edit_question':       { showEdited(store, performed.question_id, performed.patch); return }
  case 'set_chain':           { showEdited(store, performed.question_id, { chains_to: performed.chains_to }); return }
  case 'enter_widgeted': {
    const { question_id, widgeting_label, value } = performed.entered
    reviseQuestions(store, [question_id], (seen) => ('stored' in seen ? { ...seen, stored: enteredInto(seen.stored, widgeting_label, value) } : seen))
    return
  }
  case 'enter_quiz_widgeted': {
    const { widgeting_label, value } = performed.entered
    reviseFrames(store, quiz_id, (frame) => ({ ...frame, stored: enteredInto(frame.stored, widgeting_label, value) }))
    return
  }
  case 'edit_column':         { reviseFrames(store, quiz_id, (frame) => columnEdited(frame, performed.label, performed.patch)); return }
  case 'edit_widgeting':      { showWidgetingEdited(store, quiz_id, performed.label, performed.patch); return }
  case 'sort_questions':      { reviseFrames(store, quiz_id, (frame) => sorted(frame, performed.sortkey, performed.question_ids)); return }
  case 'move_question':       { showMoved(store, quiz_id, performed.question_id, performed.onto_idx) }
  }
}

/** Every watched frame of the quiz `quiz_id`, rewritten by `revise` */
function reviseFrames(store: OptimisticLocalStore, quiz_id: string, revise: (frame: QuizFrameT) => QuizFrameT): void {
  for (const { args, value: frame } of store.getAllQueries(api.quizzes.open)) {
    if (frame?._id === quiz_id) { store.setQuery(api.quizzes.open, args, revise(frame)) }
  }
}

/** Every watched reading of each question of `question_ids`, rewritten by `revise` */
function reviseQuestions(store: OptimisticLocalStore, question_ids: readonly string[], revise: (seen: SeenQuestionT) => SeenQuestionT): void {
  const revised = new Set(question_ids)
  for (const { args, value: seen } of store.getAllQueries(api.questions.open)) {
    if (seen && revised.has(seen._id)) { store.setQuery(api.questions.open, args, revise(seen)) }
  }
}

/** The quiz `quiz_id`'s frame as watched; null when it is not */
function frameIn(store: OptimisticLocalStore, quiz_id: string): QuizFrameT | null {
  return store.getAllQueries(api.quizzes.open).find(({ value: frame }) => frame?._id === quiz_id)?.value ?? null
}

/** The question `question_id` as watched; undefined when it is not */
function seenIn(store: OptimisticLocalStore, question_id: string): SeenQuestionT | undefined {
  return store.getAllQueries(api.questions.open).find(({ value: seen }) => seen?._id === (question_id as Id<'questions'>))?.value ?? undefined
}

/**
 * The question `question_id` revised by `patch`, as `editQuestion` writes it: a chain names the
 * label of the question it points at, and one pointing at no other question is none. A chain to a
 * question not watched here is left to the server.
 */
function showEdited(store: OptimisticLocalStore, question_id: string, patch: QuestionPatch): void {
  const { chains_to, ...fields } = patch
  const chained = chains_to === undefined ? {} : chainOf(store, question_id, chains_to)
  reviseQuestions(store, [question_id], (seen) => ({ ...seen, ...fields, ...chained }))
}

/** The chain the question `question_id` holds once pointed at `chains_to`: its label; none for none or itself; nothing said when it is not watched here */
function chainOf(store: OptimisticLocalStore, question_id: string, chains_to: string | null): { chains_to?: string | null } {
  if (chains_to === null || chains_to === question_id) { return { chains_to: null } }
  const target = seenIn(store, chains_to)
  return target && 'label' in target ? { chains_to: target.label } : {}
}

/** `stored` with what was typed into the cell of `widgeting_label`, as `upsertWidgeted` keeps it: one `ok` row, or none for a cell emptied */
function enteredInto(stored: Readonly<Record<string, WidgetedHistoryT>>, widgeting_label: string, entered: EntryValueT | null): Record<string, WidgetedHistoryT> {
  if (entered === null) { return _.omit(stored, [widgeting_label]) }
  const row = { status: 'ok', value: entered, message: null, result_meta: {}, _creationTime: Date.now() } as const
  return { ...stored, [widgeting_label]: { newest: row, ok: row } }
}

/** `frame` with its column `label` revised by `patch`, as `editColumn` writes it: a field of null taken off, and a rename carrying the sort memory */
function columnEdited(frame: QuizFrameT, label: string, patch: ColumnPatch): QuizFrameT {
  const columns = frame.columns.map((column) => (column.label === label ? _.omitBy({ ...column, ...patch }, _.isNil) as ColumnT : column))
  const renamedOnto = patch.label ?? label
  const last_sortkey = frame.last_sortkey === sortkeyOf({ label }) ? sortkeyOf({ label: renamedOnto }) : frame.last_sortkey
  return { ...frame, columns, last_sortkey }
}

/**
 * The widgeting `label` revised by `patch`, as `editWidgeting` writes it: a rename carrying with it
 * the columns showing it, its place among the templateable sources, and what it stored, for the
 * quiz and each question. New params are not shown early: the folded line shows what it sent
 * itself, and keeps showing params the server refuses beside the sentence saying why
 * (`FoldedParams`), which a rollback here would take away.
 */
function showWidgetingEdited(store: OptimisticLocalStore, quiz_id: string, label: string, patch: WidgetingPatch): void {
  const frame = frameIn(store, quiz_id)
  const held = frame?.widgetings.find((widgeting) => widgeting.label === label)
  const shown: WidgetingPatch = _.omitBy(_.omit(patch, ['params']), _.isUndefined)
  if (! frame || ! held || _.isEmpty(shown)) { return }
  const renamedOnto = shown.label ?? label
  reviseFrames(store, quiz_id, (each) => widgetingEdited(each, held, shown))
  if (renamedOnto === label) { return }
  reviseQuestions(store, frame.row_ordering, (seen) => ('stored' in seen ? { ...seen, stored: rekeyed(seen.stored, label, renamedOnto) } : seen))
}

/** `frame` with the widgeting `held` revised by `patch`, a rename carried to its columns, its templateable place and what it stored for the quiz */
function widgetingEdited(frame: QuizFrameT, held: WidgetingT, patch: WidgetingPatch): QuizFrameT {
  const { label } = held
  const widgetings = frame.widgetings.map((widgeting) => (widgeting.label === label ? { ...widgeting, ...patch } : widgeting))
  const renamedOnto = patch.label ?? label
  if (renamedOnto === label) { return { ...frame, widgetings } }
  const columns = frame.columns.map((column) => {
    const ref = refOf(column.source)
    return ref.kind === 'widgeting' && ref.label === label ? { ...column, source: widgetingSourceOf(renamedOnto, ref.tier) } : column
  })
  const templateable = frame.templateable.map((source) => (source === label ? renamedOnto : source))
  return { ...frame, widgetings, columns, templateable, stored: rekeyed(frame.stored, label, renamedOnto) }
}

/** `bag` with what it held under `from` held under `onto` instead */
function rekeyed<VT>(bag: Readonly<Record<string, VT>>, from: string, onto: string): Record<string, VT> {
  if (! Object.hasOwn(bag, from)) { return { ...bag } }
  return { ..._.omit(bag, [from]), [onto]: bag[from] as VT }
}

/**
 * `frame` in the order a sort came to in the browser, remembering its sortkey, as `sortQuestions`
 * writes it. Ids that are not exactly the quiz's questions, each once, are the server's to refuse
 * (`sortStale`), and the frame is left as it is.
 */
function sorted(frame: QuizFrameT, sortkey: Sortkey, question_ids: readonly string[]): QuizFrameT {
  const held = new Set<string>(frame.row_ordering)
  const exact = question_ids.length === held.size && new Set(question_ids).size === held.size && question_ids.every((question_id) => held.has(question_id))
  return exact ? { ...frame, row_ordering: question_ids as readonly Id<'questions'>[], last_sortkey: sortkey } : frame
}

/**
 * The question `question_id` dragged to `onto_idx`, every question numbered by where it sits and
 * the quiz left in Q# order, as `moveQuestion` writes it (`Rank.moveQuestion`,
 * `Rank.renumberByPosition`). Left to the server until every question of the quiz is watched here.
 */
function showMoved(store: OptimisticLocalStore, quiz_id: string, question_id: string, onto_idx: number): void {
  const frame = frameIn(store, quiz_id)
  const quiz = frame && assembledQuiz(frame, (each) => seenIn(store, each))
  if (! quiz) { return }
  const moved = Rank.renumberByPosition(Rank.moveQuestion(quiz.questions, question_id, onto_idx))
  const qnumFor = new Map(moved.map((question) => [question._id, question.qnum]))
  const renumbered = quiz.questions.filter((question) => qnumFor.get(question._id) !== question.qnum).map((question) => question._id)
  reviseFrames(store, quiz_id, (each) => ({ ...each, row_ordering: moved.map((question) => question._id as Id<'questions'>), last_sortkey: qnumSortkeyOf(each) }))
  reviseQuestions(store, renumbered, (seen) => ({ ...seen, qnum: qnumFor.get(seen._id) ?? '' }))
}
