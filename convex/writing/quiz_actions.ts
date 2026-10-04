import _ from 'es-toolkit/compat'
import type { Doc, Id } from '../_generated/dataModel'
import * as Chain from '../../src/lib/chain'
import * as Labelmaker from '../../src/lib/labelmaker'
import * as Rank from '../../src/lib/rank'
import * as Runner from '../../src/lib/formulary/runner'
import * as Sortings from '../../src/lib/sortings'
import * as PA from '../../src/lib/vv/patterns'
import { qnumSortkeyOf } from '../../src/lib/columns'
import { refuse } from '../../src/lib/refusals'
import { quizFrom, widgetFrom, type LayoutRows, type QuizRows } from '../../src/lib/rows'
import type { ImportedQuestionT } from '../../src/models/import'
import { Question, QuestionValidators, type QuestionPatch, type QuestionT } from '../../src/models/question'
import type { OpenQuizT } from '../../src/models/actions'
import type { QuizT, Sortkey } from '../../src/models/quiz'
import type { WidgetedEnteringT, WidgetedRecordingT } from '../../src/models/widgeted'
import { EntryFormulary } from '../../src/lib/formulary/entry'
import { formularyFor } from '../../src/lib/formulary/formularies'
import { allStoredOf, layoutRowsOf, libraryOf, questionOf, questionsOf, quizForLabel, quizRowsOf, quizzesOf, widgetForLabel, widgetingsOf } from '../reading'
import { deleteQuestion, deleteQuiz, insertQuiz, insertWidgeted, updateQuestion, updateQuiz, upsertWidgeted, type Writer } from './quiz_writing'

// Each action reads what it needs and no more: the open quiz's own row, the questions it names
// by id, and the whole quiz only for an order worked out across every question. What an action
// reads is what Convex bills, and what a mutation holds in its transaction.

/** Refuse a change to a quiz that is gone or locked. The freeze is a property of the quiz, not of whether a button happened to be greyed out. */
function revisable<RT extends { quiz: Doc<'quizzes'> }>(rows: RT | null): RT {
  if (! rows) { refuse('quizGone') }
  if (rows.quiz.locked) { refuse('quizLocked') }
  return rows
}

/**
 * The open quiz's own row, refusing when the quiz is locked or gone.
 *
 * @throws A refusal (`quizGone`, `quizLocked`); nothing is written.
 */
export async function openQuizRow(db: Writer, open: OpenQuizT): Promise<Doc<'quizzes'>> {
  const quiz = await db.get('quizzes', open.quiz_id)
  return revisable(quiz && { quiz }).quiz
}

/**
 * Run `write` against the open quiz's own row and its widgetings and columns, refusing as
 * `openQuizRow` does. What a change to the quiz's layout needs.
 */
export async function reviseOpenLayout(db: Writer, open: OpenQuizT, write: (rows: LayoutRows) => Promise<void>): Promise<void> {
  await write(revisable(await layoutRowsOf(db, open.quiz_id)))
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
  const [hunt, realm] = await Promise.all([db.get('hunts', open.hunt_id), db.get('realms', open.realm_id)])
  if (! hunt || ! realm) { refuse('quizGone') }
  return Runner.placeOf(hunt, realm)
}

/** What a new order is worked out from: the quiz's own rows and questions, with what they stored only when asked for */
type ReorderReads = { stored: boolean }

/**
 * The open quiz and its questions, for an action that works out a new order, refusing as
 * `openQuizRow` does. What the questions stored is read only for an order that can depend on it
 * (a sort, by a widgeting's column); every other order leaves it unread, and the questions it is
 * handed show none.
 */
async function reorderOpenQuiz(db: Writer, open: OpenQuizT, reads: ReorderReads, reorder: (quiz: QuizT) => { questions: readonly QuestionT[], last_sortkey?: Sortkey | null }): Promise<void> {
  const layout = revisable(await layoutRowsOf(db, open.quiz_id))
  const questions = await questionsOf(db, layout.quiz)
  const rows = { ...layout, questions, stored: reads.stored ? await allStoredOf(db, questions, layout.widgetings) : new Map() }
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
  await updateQuiz(db, await openQuizRow(db, open), { title })
}

/**
 * Give the open quiz the label `label`, the last part of its address; the label it had answers to
 * nothing afterwards. Refused when another quiz of its realm already answers to it; its own label
 * is no clash, and changes nothing.
 *
 * @throws A refusal (`quizGone`, `quizLocked`, `labelTaken`); nothing is written.
 */
export async function relabelQuiz(db: Writer, open: OpenQuizT, label: string): Promise<void> {
  const [quiz, holder] = await Promise.all([openQuizRow(db, open), quizForLabel(db, open.realm_id, label)])
  if (holder && holder._id !== quiz._id) { refuse('labelTaken') }
  await updateQuiz(db, quiz, { label })
}

/**
 * Put the open quiz on another version. Naming one its history has not seen starts a branch
 * there, not here; the shape of the name is the caller's to check.
 */
export async function reversionQuiz(db: Writer, open: OpenQuizT, version: string): Promise<void> {
  await updateQuiz(db, await openQuizRow(db, open), { version })
}

/** Rewrite the open quiz's smith's note. An empty note is kept as it is: the screen shows its placeholder. */
export async function setSmithsNote(db: Writer, open: OpenQuizT, smiths_note: string): Promise<void> {
  await updateQuiz(db, await openQuizRow(db, open), { smiths_note })
}

/**
 * Revise one question of the open quiz by a patch. A chain in the patch names the question it
 * points at; one that names no other question of the quiz is cleared. A question not in the
 * quiz is refused.
 *
 * What the question's widgetings stored stays as it was.
 */
export async function editQuestion(db: Writer, open: OpenQuizT, question_id: string, patch: QuestionPatch): Promise<void> {
  const quiz = await openQuizRow(db, open)
  const held = await questionIn(db, quiz, question_id)
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
  const quiz = await openQuizRow(db, open)
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
  const quiz = await openQuizRow(db, open)
  const [gone, kept] = _.partition(await questionsOf(db, quiz), (row) => doomed.has(row._id))
  const goneLabels = new Set(gone.map((row) => row.label))
  for (const row of gone) { await deleteQuestion(db, row._id) }
  for (const row of kept) {
    if (row.chains_to !== null && goneLabels.has(row.chains_to)) { await updateQuestion(db, row, { chains_to: null }) }
  }
  await updateQuiz(db, quiz, { row_ordering: kept.map((row) => row._id) })
}

/**
 * Sort the open quiz's questions by a column, or by any sort memory, and commit the order: the
 * new positions are written, not draped over the top, and the quiz remembers what put it so.
 */
export async function sortQuestions(db: Writer, open: OpenQuizT, sortkey: Sortkey, descending: boolean): Promise<void> {
  const rows = await libraryOf(db)
  const library = rows.map((row) => widgetFrom(row))
  const place = await placeOfOpen(db, open)
  await reorderOpenQuiz(db, open, { stored: true }, (quiz) => {
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
  await reorderOpenQuiz(db, open, { stored: false }, (quiz) => ({ questions: Rank.renumberByRank(quiz.questions) }))
}

/** Drag one question of the open quiz to `onto_idx`, then number every question by where it sits. A drag leaves the quiz in Q# order. */
export async function moveQuestion(db: Writer, open: OpenQuizT, question_id: string, onto_idx: number): Promise<void> {
  await reorderOpenQuiz(db, open, { stored: false }, (quiz) => ({
    questions:    Rank.renumberByPosition(Rank.moveQuestion(quiz.questions, question_id, onto_idx)),
    last_sortkey: qnumSortkeyOf(quiz),
  }))
}

/**
 * Chain one question of the open quiz to another, or unchain it with null. A chain to itself or
 * to no question here is no chain; a question not in the quiz is refused.
 */
export async function setChain(db: Writer, open: OpenQuizT, question_id: string, chains_to: string | null): Promise<void> {
  const held = await questionIn(db, await openQuizRow(db, open), question_id)
  await updateQuestion(db, held, { chains_to: await chainLabelFor(db, held, chains_to) })
}

/** Put the open quiz in the order its chains walk, and remember that */
export async function sortByChainOrder(db: Writer, open: OpenQuizT, descending: boolean): Promise<void> {
  await reorderOpenQuiz(db, open, { stored: false }, (quiz) => ({ questions: Chain.chainOrder(quiz.questions, descending), last_sortkey: 'chain_order' }))
}

/**
 * Record what one widgeting of the open quiz came to for one of its questions, as the newest row
 * in that cell. What the cell held before stays in its history. A question not in the quiz, a
 * widgeting it does not have, or one whose widget is not asked from its cell (worked out on
 * render, or typed), is refused.
 *
 * @throws A refusal (`quizGone`, `quizLocked`, `questionGone`, `widgetingGone`, `notStored`); nothing is written.
 */
export async function recordWidgeted(db: Writer, open: OpenQuizT, widgeted: WidgetedRecordingT): Promise<void> {
  const layout = revisable(await layoutRowsOf(db, open.quiz_id))
  const held = await questionIn(db, layout.quiz, widgeted.question_id)
  const widgeting = layout.widgetings.find((each) => each.label === widgeted.widgeting_label)
  if (! widgeting) { refuse('widgetingGone') }
  const widget = await widgetForLabel(db, widgeting.widget_label)
  if (! widget || formularyFor(widget).store !== 'append') { refuse('notStored') }
  await insertWidgeted(db, held._id, widgeting._id, widgeted)
}

/**
 * Put what was typed into one entry cell of the open quiz, as that cell's one row: revised in
 * place, never appended; an emptied cell (null) holds no row. The value is held to the entry
 * widget's kind. A question not in the quiz, a widgeting it does not have, or one whose widget is
 * not an entry, is refused.
 *
 * @throws A refusal (`quizGone`, `quizLocked`, `questionGone`, `widgetingGone`, `notEntered`), or a Zod error when the value is not of the entry's kind; nothing is written.
 */
export async function enterWidgeted(db: Writer, open: OpenQuizT, entered: WidgetedEnteringT): Promise<void> {
  const layout = revisable(await layoutRowsOf(db, open.quiz_id))
  const held = await questionIn(db, layout.quiz, entered.question_id)
  const widgeting = layout.widgetings.find((each) => each.label === entered.widgeting_label)
  if (! widgeting) { refuse('widgetingGone') }
  const widget = await widgetForLabel(db, widgeting.widget_label)
  if (widget?.formulary !== 'entry') { refuse('notEntered') }
  const value = entered.value === null ? null : EntryFormulary.valueOf(widget).parse(entered.value)
  await upsertWidgeted(db, held._id, widgeting._id, value)
}

/**
 * Fold imported questions into the open quiz, each by its label: one a question of
 * the quiz answers to is revised by its patch; one none answers to adds a question under it,
 * at the end, titled from its label unless the patch says otherwise. What each types into its
 * entry cells is upserted there. Nothing is deleted, and Q#s are then renumbered by rank, as the
 * Import panel promises. A chain names its target by label: one naming no question the quiz will
 * hold, or the question itself, is no chain.
 *
 * @throws A refusal (`quizGone`, `quizLocked`, `questionsFull`), or a Zod error when an entered value is not of its entry's kind; nothing is written.
 */
export async function importQuestions(db: Writer, open: OpenQuizT, imported: readonly ImportedQuestionT[]): Promise<void> {
  const quiz = await openQuizRow(db, open)
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
  await updateQuiz(db, quiz, { row_ordering: [...quiz.row_ordering, ...added] })
  await enterImported(db, quiz._id, imported, idFor)
  await reorderOpenQuiz(db, open, { stored: false }, (tree) => ({ questions: Rank.renumberByRank(tree.questions) }))
}

/**
 * Type what an import carries into the quiz's entry cells, each value held to its entry's kind: a
 * value is upserted, a null empties the cell. A label naming no entry widgeting of the quiz (one
 * whose adding was refused, say) is passed over, as an import passes over what it cannot place.
 */
async function enterImported(db: Writer, quiz_id: Id<'quizzes'>, imported: readonly ImportedQuestionT[], idFor: ReadonlyMap<string, Id<'questions'>>): Promise<void> {
  if (imported.every(({ entered }) => _.isEmpty(entered))) { return }
  const [widgetings, library] = await Promise.all([widgetingsOf(db, quiz_id), libraryOf(db)])
  const widgetFor = new Map(library.map((widget) => [widget.label, widget]))
  const entries = new Map(widgetings.flatMap((widgeting) => {
    const widget = widgetFor.get(widgeting.widget_label)
    return widget?.formulary === 'entry' ? [[widgeting.label, { widgeting, widget }] as const] : []
  }))
  const cells = imported.flatMap(({ label, entered }) => Object.entries(entered).flatMap(([widgeting_label, value]) => {
    const question_id = idFor.get(label)
    const entry = entries.get(widgeting_label)
    return question_id && entry ? [{ question_id, entry, value }] : []
  }))
  for (const { question_id, entry, value } of cells) {
    await upsertWidgeted(db, question_id, entry.widgeting._id, value === null ? null : EntryFormulary.valueOf(entry.widget).parse(value))
  }
}

// What follows is about the realm rather than a quiz's contents, so a locked quiz refuses none of
// it. Locking must never be a trap: you can always switch away, make another quiz, delete one, or
// unlock.

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
  const [realm, siblings] = await Promise.all([db.get('realms', open.realm_id), quizzesOf(db, open.realm_id)])
  const taken = label !== undefined && siblings.some((quiz) => quiz.label === label)
  if (realm?.hunt_id !== open.hunt_id) { refuse('realmGone') }
  if (taken) { refuse('labelTaken') }
  if (siblings.length >= PA.QuizzesPerRealm.max) { refuse('quizzesFull') }
  return await insertQuiz(db, open, '', label ?? Labelmaker.freshLabelFor(siblings))
}

/**
 * Delete a quiz of the open quiz's realm and all it holds. The realm's last quiz cannot go on
 * its own: an empty realm would leave its address leading nowhere, and the author with no way
 * back. It goes only with its hunt (`deleteHunt`). A quiz already gone is gone; one of another
 * realm is refused.
 *
 * @throws A refusal (`notInRealm`, `lastQuiz`); nothing is written.
 */
export async function deleteQuizFrom(db: Writer, open: OpenQuizT, quiz_id: Id<'quizzes'>): Promise<void> {
  const doomed = await quizRowsOf(db, quiz_id)
  if (! doomed) { return }
  if (doomed.quiz.realm_id !== open.realm_id) { refuse('notInRealm') }
  const siblings = await quizzesOf(db, open.realm_id)
  if (siblings.length <= 1) { refuse('lastQuiz') }
  await deleteQuiz(db, doomed)
}

/** Lock or unlock a quiz. Works from inside the lock, and changes nothing else about the quiz; a quiz gone is refused. */
export async function setLock(db: Writer, quiz_id: Id<'quizzes'>, locked: boolean): Promise<void> {
  const quiz = await db.get('quizzes', quiz_id)
  if (! quiz) { refuse('quizGone') }
  await updateQuiz(db, quiz, { locked })
}
