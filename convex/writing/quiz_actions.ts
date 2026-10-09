import _ from 'es-toolkit/compat'
import type { Doc, Id } from '../_generated/dataModel'
import * as Chain from '../../src/lib/chain'
import * as Labelmaker from '../../src/lib/labelmaker'
import * as Rank from '../../src/lib/rank'
import * as Runner from '../../src/lib/formulary/runner'
import * as Sortings from '../../src/lib/sortings'
import * as Stamps from '../../src/lib/stamps'
import * as PA from '../../src/lib/vv/patterns'
import { qnumSortkeyOf } from '../../src/lib/columns'
import { refuse } from '../../src/lib/refusals'
import { quizFrom, widgetFrom, widgetingFrom, type LayoutRows, type QuizRows } from '../../src/lib/rows'
import type { ImportedQuestionT } from '../../src/models/import'
import { Question, QuestionValidators, type QuestionPatch, type QuestionT, type QuestionViz } from '../../src/models/question'
import type { QuizT, Sortkey } from '../../src/models/quiz'
import type { HuntActionT } from '../../src/models/actions'
import type { QuizEnteringT, WidgetedEnteringT, WidgetedRecordingT } from '../../src/models/widgeted'
import type { WidgetingTier } from '../../src/models/widgeting'
import type { EntryValueT, WidgetT } from '../../src/models/widget'
import { EntryFormulary } from '../../src/lib/formulary/entry'
import { formularyFor } from '../../src/lib/formulary/formularies'
import { allStoredOf, layoutOf, libraryOf, questionOf, questionsOf, quizForLabel, quizStoredOf, quizzesOf, widgetForLabel, widgetingsOf } from '../reading'
import { deleteQuestion, deleteQuiz, insertQuiz, insertWidgeted, updateQuestion, updateQuiz, upsertQuizWidgeted, upsertWidgeted, type LayoutPlace, type OpenQuizT, type Writer } from './quiz_writing'

// Each action reads what it needs and no more: the open quiz's own row comes with the claims
// `authorize` checked, and an action reads beside it the questions it names by id, and the whole
// quiz only for an order worked out across every question. What an action reads is what Convex
// bills, and what a mutation holds in its transaction. Whether the actor may revise the quiz at
// all is settled before any of this (`Approve.mayReviseQuiz`).

/** The quiz `quiz`, refusing when it is gone */
function revisable(quiz: Doc<'quizzes'> | null): Doc<'quizzes'> {
  if (! quiz) { refuse('quizGone') }
  return quiz
}

/**
 * The open quiz's own row, as the claims hold it, refusing when the quiz is gone.
 *
 * @throws A refusal (`quizGone`); nothing is written.
 */
export function openQuizRow(open: OpenQuizT): Doc<'quizzes'> {
  return revisable(open.quiz)
}

/**
 * Run `write` against the open quiz's own row and its widgetings and columns, refusing as
 * `openQuizRow` does. What a change to the quiz's layout needs.
 */
export async function reviseOpenLayout(db: Writer, open: OpenQuizT, write: (rows: LayoutRows) => Promise<void>): Promise<void> {
  await write(await layoutOf(db, openQuizRow(open)))
}

/** The row of the question `question_id` of `quiz`, refusing when it is not the quiz's */
async function questionIn(db: Writer, quiz: Doc<'quizzes'>, question_id: string): Promise<Doc<'questions'>> {
  const id = db.normalizeId('questions', question_id)
  const held = id && await questionOf(db, quiz._id, id)
  if (! held) { refuse('questionGone') }
  return held
}

/** Where the open quiz sits, as its formulas are told: its hunt and realm, refusing as a gone quiz when either is */
async function placeOfOpen(db: Writer, open: OpenQuizT): Promise<Runner.QuizPlace> {
  const hunt = await db.get('hunts', open.hunt_id)
  if (! hunt || ! open.realm) { refuse('quizGone') }
  return Runner.placeOf(hunt, open.realm)
}

/** What a new order is worked out from: the quiz's own rows and questions, with what they stored only when asked for */
type ReorderReads = { stored: boolean }

/**
 * The quiz `quiz` and its questions, put in a new order. What the questions and the quiz stored is
 * read only for an order that can depend on it (a sort, by a widgeting's column, which may read
 * the quiz's own entries); every other order leaves it unread, and the quiz it is handed shows
 * none.
 */
async function reorderQuiz(db: Writer, quiz: Doc<'quizzes'>, reads: ReorderReads, reorder: (tree: QuizT) => { questions: readonly QuestionT[], last_sortkey?: Sortkey | null }): Promise<void> {
  const layout = await layoutOf(db, quiz)
  const questions = await questionsOf(db, layout.quiz)
  const [stored, quizStored] = reads.stored ? await Promise.all([allStoredOf(db, questions, layout.widgetings), quizStoredOf(db, quiz._id, layout.widgetings)]) : [new Map(), new Map()]
  const rows = { ...layout, questions, stored, quizStored }
  const ordered = reorder(quizFrom(rows))
  await writeOrder(db, rows, ordered.questions, ordered.last_sortkey)
}

/** The quiz put in the order of `ordered`, each question with the Q# `ordered` gives it */
async function writeOrder(db: Writer, rows: QuizRows, ordered: readonly QuestionT[], last_sortkey: Sortkey | null | undefined): Promise<void> {
  const heldFor = new Map(rows.questions.map((row) => [row._id as string, row]))
  const placed = ordered.flatMap((question) => {
    const held = heldFor.get(question._id)
    return held ? [{ held, qnum: question.qnum }] : []
  })
  for (const { held, qnum } of placed) { await updateQuestion(db, held, { qnum }) }
  await updateQuiz(db, rows.quiz, { row_ordering: placed.map(({ held }) => held._id), ...(last_sortkey !== undefined && { last_sortkey }) })
}

/** Retitle the open quiz. An empty title is kept as it is; the screen shows it as "Untitled quiz". */
export async function retitleQuiz(db: Writer, open: OpenQuizT, title: string): Promise<void> {
  await updateQuiz(db, openQuizRow(open), { title })
}

/**
 * Give the open quiz the label `label`, the last part of its address; the label it had answers to
 * nothing afterwards. Refused when another quiz of its realm already answers to it; its own label
 * is no clash, and changes nothing.
 *
 * @throws A refusal (`quizGone`, `labelTaken`); nothing is written.
 */
export async function relabelQuiz(db: Writer, open: OpenQuizT, label: string): Promise<void> {
  const quiz = openQuizRow(open)
  const holder = await quizForLabel(db, open.realm_id, label)
  if (holder && holder._id !== quiz._id) { refuse('labelTaken') }
  await updateQuiz(db, quiz, { label })
}

/** An action rewriting one of the quiz's own notes */
export type QuizNoteActionT = Extract<HuntActionT, { kind: 'set_smiths_note' | 'set_q1_preamble' | 'set_recap_head' | 'set_recap_tail' }>

/**
 * Rewrite one of the open quiz's own notes: its smith's note, what its LL export puts ahead of its
 * first question when going live, or what its recap note says ahead of its questions or after
 * them. An empty note is kept as it is: the screen shows its placeholder, and an export puts
 * nothing there.
 *
 * @example await setQuizNote(db, claims, { kind: 'set_recap_head', recap_head: 'Thanks to our playtesters!' })
 */
export async function setQuizNote(db: Writer, open: OpenQuizT, action: QuizNoteActionT): Promise<void> {
  await updateQuiz(db, openQuizRow(open), _.omit(action, ['kind']))
}

/**
 * Give the open quiz a recap template of its own, or, with null, take it away, so the quiz follows
 * the default recap template (`Recap.DefaultTemplate`) again.
 *
 * @example await setRecapTemplate(db, claims, '{{recap_head}}\n\n{{#played}}{{number}}. {{title}}\n{{/played}}')
 * @example await setRecapTemplate(db, claims, null)   // back to the default
 */
export async function setRecapTemplate(db: Writer, open: OpenQuizT, recap_template: string | null): Promise<void> {
  await updateQuiz(db, openQuizRow(open), { recap_template: recap_template ?? undefined })
}

/**
 * Revise one question of the open quiz by a patch. A chain in the patch names the question it
 * points at; one that names no other question of the quiz is cleared. A question not in the
 * quiz is refused.
 *
 * What the question's widgetings stored stays as it was.
 */
export async function editQuestion(db: Writer, open: OpenQuizT, question_id: string, patch: QuestionPatch): Promise<void> {
  const held = await questionIn(db, openQuizRow(open), question_id)
  const { chains_to, ...fields } = patch
  await updateQuestion(db, held, { ...fields, ...(chains_to !== undefined && { chains_to: await chainLabelFor(db, held, chains_to) }) })
}

/** The label a chain from `held` to the question `chains_to` names is written as; null when it names no other question of its quiz */
async function chainLabelFor(db: Writer, held: Doc<'questions'>, chains_to: string | null): Promise<string | null> {
  const id = chains_to === null ? null : db.normalizeId('questions', chains_to)
  const target = id === null || id === held._id ? null : await questionOf(db, held.quiz_id, id)
  return target?.label ?? null
}

/** Add a blank question to the end of the open quiz; refused when it holds as many as a quiz may */
export async function addQuestion(db: Writer, open: OpenQuizT): Promise<void> {
  const quiz = openQuizRow(open)
  if (quiz.row_ordering.length >= PA.QuestionsPerQuiz.max) { refuse('questionsFull') }
  const question_id = await db.insert('questions', Question.blankRow({ hunt_id: open.hunt_id, quiz_id: quiz._id }))
  await updateQuiz(db, quiz, { row_ordering: [...quiz.row_ordering, question_id] })
}

/**
 * Delete questions from the open quiz, with everything their widgetings stored. The questions left
 * close ranks and keep their Q#s; a chain to a deleted question is cleared rather than left to
 * be picked up by whichever question answers to that label next. Ids of no question here are
 * passed over.
 */
export async function deleteQuestions(db: Writer, open: OpenQuizT, question_ids: readonly string[]): Promise<void> {
  const doomed = new Set(question_ids)
  const quiz = openQuizRow(open)
  const [gone, kept] = _.partition(await questionsOf(db, quiz), (row) => doomed.has(row._id))
  const goneLabels = new Set(gone.map((row) => row.label))
  for (const row of gone) { await deleteQuestion(db, row._id) }
  for (const row of kept) {
    if (row.chains_to !== null && goneLabels.has(row.chains_to)) { await updateQuestion(db, row, { chains_to: null }) }
  }
  await updateQuiz(db, quiz, { row_ordering: kept.map((row) => row._id) })
}

/**
 * Show questions of the open quiz as `viz` says: archived, secondary, or normal. Nothing else about
 * them changes, nor the quiz's order; one already so is left as it is. Ids of no question here are
 * passed over.
 */
export async function setViz(db: Writer, open: OpenQuizT, question_ids: readonly string[], viz: QuestionViz): Promise<void> {
  const named = new Set(question_ids)
  const questions = await questionsOf(db, openQuizRow(open))
  for (const row of questions) {
    if (named.has(row._id)) { await updateQuestion(db, row, { viz }) }
  }
}

/**
 * Sort the open quiz's questions by a column, or by any sort memory, and commit the order: the
 * new positions are written, not draped over the top, and the quiz remembers what put it so.
 */
export async function sortQuestions(db: Writer, open: OpenQuizT, sortkey: Sortkey, descending: boolean): Promise<void> {
  const rows = await libraryOf(db)
  const library = rows.map((row) => widgetFrom(row))
  const place = await placeOfOpen(db, open)
  await reorderQuiz(db, openQuizRow(open), { stored: true }, (quiz) => {
    const run = Runner.runQuiz(Runner.sourceOf(quiz, library, place))
    return { questions: Sortings.sortQuestions(quiz.questions, Sortings.sortValueFor(sortkey, quiz, run), descending), last_sortkey: sortkey }
  })
}

/**
 * Tidy the open quiz's Q#s into whole numbers, rank by rank, with no question moving.
 *
 * The sort memory is left alone: claiming the quiz is now in Q# order would flip the grid into a
 * mode that re-sorts at once, undoing the promise that nothing moved.
 */
export async function renumberQnums(db: Writer, open: OpenQuizT): Promise<void> {
  await reorderQuiz(db, openQuizRow(open), { stored: false }, (quiz) => ({ questions: Rank.renumberByRank(quiz.questions) }))
}

/** Drag one question of the open quiz to `onto_idx`, then number every question by where it sits. A drag leaves the quiz in Q# order. */
export async function moveQuestion(db: Writer, open: OpenQuizT, question_id: string, onto_idx: number): Promise<void> {
  await reorderQuiz(db, openQuizRow(open), { stored: false }, (quiz) => ({
    questions:    Rank.renumberByPosition(Rank.moveQuestion(quiz.questions, question_id, onto_idx)),
    last_sortkey: qnumSortkeyOf(quiz),
  }))
}

/**
 * Chain one question of the open quiz to another, or unchain it with null. A chain to itself or
 * to no question here is no chain; a question not in the quiz is refused.
 */
export async function setChain(db: Writer, open: OpenQuizT, question_id: string, chains_to: string | null): Promise<void> {
  const held = await questionIn(db, openQuizRow(open), question_id)
  await updateQuestion(db, held, { chains_to: await chainLabelFor(db, held, chains_to) })
}

/** Put the open quiz in the order its chains walk, and remember that */
export async function sortByChainOrder(db: Writer, open: OpenQuizT, descending: boolean): Promise<void> {
  await reorderQuiz(db, openQuizRow(open), { stored: false }, (quiz) => ({ questions: Chain.chainOrder(quiz.questions, descending), last_sortkey: 'chain_order' }))
}

/**
 * The widgeting of `layout` labelled `label`, refusing when it has none, or it runs at another
 * tier than `tier`.
 *
 * @throws A refusal (`widgetingGone`, `wrongTier`).
 */
function widgetingAt(layout: LayoutRows, label: string, tier: WidgetingTier): Doc<'widgetings'> {
  const widgeting = layout.widgetings.find((each) => each.label === label)
  if (! widgeting) { refuse('widgetingGone') }
  if (widgetingFrom(widgeting).tier !== tier) { refuse('wrongTier') }
  return widgeting
}

/**
 * Record what one widgeting of the open quiz came to for one of its questions, as the newest row
 * in that cell. What the cell held before stays in its history. A question not in the quiz, a
 * widgeting it does not have or that runs once for the whole quiz, or one whose widget is not
 * asked from its cell (worked out on render, or typed), is refused.
 *
 * @throws A refusal (`quizGone`, `questionGone`, `widgetingGone`, `wrongTier`, `notStored`); nothing is written.
 */
export async function recordWidgeted(db: Writer, open: OpenQuizT, widgeted: WidgetedRecordingT): Promise<void> {
  const layout = await layoutOf(db, openQuizRow(open))
  const held = await questionIn(db, layout.quiz, widgeted.question_id)
  const widgeting = widgetingAt(layout, widgeted.widgeting_label, 'question')
  const widget = await widgetForLabel(db, widgeting.widget_label)
  if (! widget || formularyFor(widget).store !== 'append') { refuse('notStored') }
  await insertWidgeted(db, held, widgeting._id, widgeted)
}

/**
 * Put what was typed into one entry cell of the open quiz, as that cell's one row: revised in
 * place, never appended; an emptied cell (null) holds no row. The value is held to the entry
 * widget's kind. A question not in the quiz, a widgeting it does not have or that runs once for
 * the whole quiz, or one whose widget is not an entry, is refused.
 *
 * @throws A refusal (`quizGone`, `questionGone`, `widgetingGone`, `wrongTier`, `notEntered`), or a Zod error when the value is not of the entry's kind; nothing is written.
 */
export async function enterWidgeted(db: Writer, open: OpenQuizT, entered: WidgetedEnteringT): Promise<void> {
  const layout = await layoutOf(db, openQuizRow(open))
  const held = await questionIn(db, layout.quiz, entered.question_id)
  const widgeting = widgetingAt(layout, entered.widgeting_label, 'question')
  const value = await enteredValueOf(db, widgeting, entered.value)
  await upsertWidgeted(db, held, widgeting._id, value)
}

/**
 * Put what was typed into the open quiz's own cell of an entry run once for the whole quiz, as
 * that cell's one row, as `enterWidgeted` does a question's. A widgeting the quiz does not have or
 * that runs for each question, or one whose widget is not an entry, is refused.
 *
 * @throws A refusal (`quizGone`, `widgetingGone`, `wrongTier`, `notEntered`), or a Zod error when the value is not of the entry's kind; nothing is written.
 *
 * @example await enterQuizWidgeted(db, claims, { widgeting_label: 'playtesters', value: 'Ada and Grace' })
 */
export async function enterQuizWidgeted(db: Writer, open: OpenQuizT, entered: QuizEnteringT): Promise<void> {
  const layout = await layoutOf(db, openQuizRow(open))
  const widgeting = widgetingAt(layout, entered.widgeting_label, 'quiz')
  const value = await enteredValueOf(db, widgeting, entered.value)
  await upsertQuizWidgeted(db, { hunt_id: open.hunt_id, quiz_id: layout.quiz._id }, widgeting._id, value)
}

/**
 * What was typed into a cell of `widgeting`, held to its entry widget's kind and the params in
 * force; null for a cell emptied. A widgeting whose widget is not an entry is refused.
 *
 * @throws A refusal (`notEntered`), or a Zod error when the value is not of the entry's kind or breaks its params.
 */
async function enteredValueOf(db: Writer, widgeting: Doc<'widgetings'>, value: WidgetedEnteringT['value']): Promise<EntryValueT | null> {
  const widget = await widgetForLabel(db, widgeting.widget_label)
  if (widget?.formulary !== 'entry') { refuse('notEntered') }
  return value === null ? null : EntryFormulary.valueOf(widget, widgeting).parse(value)
}

/**
 * Fold imported questions into the open quiz, each by its label: one a question of
 * the quiz answers to is revised by its patch; one none answers to adds a question under it,
 * at the end, titled from its label unless the patch says otherwise. What each types into its
 * entry cells is upserted there, and the bots' replies it carries fill those of its asked cells
 * that hold nothing (`carryReplies`). Nothing is deleted, and Q#s are then renumbered by rank, as the
 * Import panel promises. A chain names its target by label: one naming no question the quiz will
 * hold, or the question itself, is no chain. A quiz that held no questions takes them in the
 * order pasted, and so takes the sort memory they were exported under, `last_sortkey`, when one
 * is given; a quiz that held some keeps its own.
 *
 * An import that brings in any question tidies away the quiz's untouched starters: each question
 * it did not name that is blank (`Question.isBlank`), has never been edited (its stamps equal) and
 * holds nothing typed into its cells is archived, as a new quiz's five blank questions are once a
 * paste has filled it.
 *
 * @throws A refusal (`quizGone`, `questionsFull`), or a Zod error when an entered value is not of its entry's kind; nothing is written.
 */
export async function importQuestions(db: Writer, open: OpenQuizT, imported: readonly ImportedQuestionT[], last_sortkey?: Sortkey | null): Promise<void> {
  const quiz = openQuizRow(open)
  const rows = await questionsOf(db, quiz)
  const held = new Map(rows.map((row) => [row.label, row]))
  const known = new Set([...held.keys(), ...imported.map((question) => question.label)])
  if (known.size > PA.QuestionsPerQuiz.max) { refuse('questionsFull') }
  const added: Id<'questions'>[] = []
  const idFor = new Map<string, Id<'questions'>>()
  for (const { label, patch } of imported) {
    const chained = patch.chains_to === undefined ? {} : { chains_to: patch.chains_to !== null && patch.chains_to !== label && known.has(patch.chains_to) ? patch.chains_to : null }
    const fields = { ...patch, ...chained }
    const row = held.get(label)
    if (row) {
      await updateQuestion(db, row, fields)
      idFor.set(label, row._id)
    } else {
      const fresh = QuestionValidators.row({ ...Question.blankRow({ hunt_id: open.hunt_id, quiz_id: quiz._id }, label), ...fields })
      const question_id = await db.insert('questions', fresh)
      added.push(question_id)
      idFor.set(label, question_id)
    }
  }
  const remembered = last_sortkey !== undefined && rows.length === 0 ? { last_sortkey } : {}
  await updateQuiz(db, quiz, { row_ordering: [...quiz.row_ordering, ...added], ...remembered })
  await enterImported(db, { hunt_id: open.hunt_id, quiz_id: quiz._id }, imported, idFor)
  await carryReplies(db, { hunt_id: open.hunt_id, quiz_id: quiz._id }, imported, idFor)
  if (imported.length > 0) { await archiveStarters(db, rows.filter((row) => ! idFor.has(row.label))) }
  // Read again: its order has just been written, and the renumbering works from that.
  await reorderQuiz(db, revisable(await db.get('quizzes', quiz._id)), { stored: false }, (tree) => ({ questions: Rank.renumberByRank(tree.questions) }))
}

/**
 * Archive each of `rows` that is an untouched starter: shown, blank, never edited since it was
 * made, and holding nothing typed into or recorded for its cells.
 */
async function archiveStarters(db: Writer, rows: readonly Doc<'questions'>[]): Promise<void> {
  const candidates = rows.filter((row) => row.viz === 'normal' && Question.isBlank(row) && Stamps.isUntouched(Stamps.of(row)))
  for (const row of candidates) {
    const stored = await db.query('widgeteds').withIndex('by_question_id_and_widgeting_id', (cvx) => cvx.eq('question_id', row._id)).first()
    if (! stored) { await updateQuestion(db, row, { viz: 'archived' }) }
  }
}

/**
 * Type what an import carries into the quiz's entry cells, each value held to its entry's kind
 * (`EntryFormulary.kindValueOf`), not its params, since an export is a promise and a constraint
 * bites only on the next edit of a cell: a value is upserted, a null empties the cell. A label
 * naming no entry widgeting of the quiz that runs for each question (one whose adding was
 * refused, say) is passed over, as an import passes over what it cannot place.
 */
async function enterImported(db: Writer, { hunt_id, quiz_id }: LayoutPlace, imported: readonly ImportedQuestionT[], idFor: ReadonlyMap<string, Id<'questions'>>): Promise<void> {
  if (imported.every(({ entered }) => _.isEmpty(entered))) { return }
  const entries = await questionCellsOf(db, quiz_id, (widget) => widget.formulary === 'entry')
  const cells = imported.flatMap(({ label, entered }) => Object.entries(entered).flatMap(([widgeting_label, value]) => {
    const question_id = idFor.get(label)
    const entry = entries.get(widgeting_label)
    return question_id && entry?.widget.formulary === 'entry' ? [{ question_id, widgeting: entry.widgeting, widget: entry.widget, value }] : []
  }))
  for (const { question_id, widgeting, widget, value } of cells) {
    await upsertWidgeted(db, { _id: question_id, hunt_id, quiz_id }, widgeting._id, value === null ? null : EntryFormulary.kindValueOf(widget).parse(value))
  }
}

/**
 * Fill the quiz's asked cells with the bots' replies an import carries, each as an `ok` row
 * marked `result_meta.imported`, and only in a cell holding no row at all, so a pasted reply never
 * buries what was asked here. A label naming no widgeting of the quiz asked from the cell that
 * runs for each question (one whose adding was refused, say) is passed over.
 */
async function carryReplies(db: Writer, { hunt_id, quiz_id }: LayoutPlace, imported: readonly ImportedQuestionT[], idFor: ReadonlyMap<string, Id<'questions'>>): Promise<void> {
  if (imported.every(({ replied }) => _.isEmpty(replied))) { return }
  const asked = await questionCellsOf(db, quiz_id, (widget) => formularyFor(widget).store === 'append')
  const cells = imported.flatMap(({ label, replied }) => Object.entries(replied).flatMap(([widgeting_label, value]) => {
    const question_id = idFor.get(label)
    const cell = asked.get(widgeting_label)
    return question_id && cell ? [{ question_id, widgeting_id: cell.widgeting._id, value }] : []
  }))
  for (const { question_id, widgeting_id, value } of cells) {
    const stored = await db.query('widgeteds').withIndex('by_question_id_and_widgeting_id', (cvx) => cvx.eq('question_id', question_id).eq('widgeting_id', widgeting_id)).first()
    if (stored) { continue }
    await insertWidgeted(db, { _id: question_id, hunt_id, quiz_id }, widgeting_id, { status: 'ok', value, message: null, result_meta: { imported: true } })
  }
}

/** The quiz's widgetings that run for each question and work a widget `keep` takes, by label, each with that widget */
async function questionCellsOf(db: Writer, quiz_id: Id<'quizzes'>, keep: (widget: WidgetT) => boolean): Promise<ReadonlyMap<string, { widgeting: Doc<'widgetings'>, widget: WidgetT }>> {
  const [widgetings, library] = await Promise.all([widgetingsOf(db, quiz_id), libraryOf(db)])
  const widgetFor = new Map(library.map((widget) => [widget.label, widget]))
  return new Map(widgetings.flatMap((widgeting) => {
    const widget = widgetFor.get(widgeting.widget_label)
    return widget && keep(widget) && widgetingFrom(widgeting).tier === 'question' ? [[widgeting.label, { widgeting, widget }] as const] : []
  }))
}

/**
 * Make a fresh quiz in the open quiz's realm, with its blank questions and the standard layout.
 *
 * A label some quiz of the realm already answers to is refused rather than disambiguated, as a
 * duplicate widgeting or column label is: a label is an address, and a caller that has already put
 * this one in one would be sent to the wrong quiz. `Labelmaker.freshLabelFor` gives one that will
 * do. A realm holding as many quizzes as a realm may refuses another.
 *
 * @returns The new quiz's row id.
 * @throws A refusal (`realmGone`, `labelTaken`, `quizzesFull`); nothing is written.
 */
export async function newQuiz(db: Writer, open: OpenQuizT, label?: string): Promise<Id<'quizzes'>> {
  if (! open.realm) { refuse('realmGone') }
  const siblings = await quizzesOf(db, open.realm_id)
  if (label !== undefined && siblings.some((quiz) => quiz.label === label)) { refuse('labelTaken') }
  if (siblings.length >= PA.QuizzesPerRealm.max) { refuse('quizzesFull') }
  return await insertQuiz(db, open, '', label ?? Labelmaker.freshLabelFor(siblings))
}

/**
 * Delete `doomed`, a quiz of the open quiz's realm, and all it holds. The realm's last quiz cannot
 * go on its own: an empty realm would leave its address leading nowhere, and the author with no
 * way back. It goes only with its hunt (`deleteHunt`). A quiz already gone (null) is gone; one of
 * another realm is refused.
 *
 * @throws A refusal (`notInRealm`, `lastQuiz`); nothing is written.
 */
export async function deleteQuizFrom(db: Writer, open: OpenQuizT, doomed: Doc<'quizzes'> | null): Promise<void> {
  if (! doomed) { return }
  if (doomed.realm_id !== open.realm_id) { refuse('notInRealm') }
  const siblings = await quizzesOf(db, open.realm_id)
  if (siblings.length <= 1) { refuse('lastQuiz') }
  await deleteQuiz(db, doomed._id)
}

/** Lock or unlock `quiz`, as read, changing nothing else about it; a quiz gone (null) is refused. */
export async function setLock(db: Writer, quiz: Doc<'quizzes'> | null, locked: boolean): Promise<void> {
  await updateQuiz(db, revisable(quiz), { locked })
}
