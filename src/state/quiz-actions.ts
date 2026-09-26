import type { Db } from 'jazz-tools'
import { app, type QuestionRow } from '../db/schema'
import * as Chain from '../lib/chain'
import * as Expressed from '../lib/expressed'
import * as Labelmaker from '../lib/labelmaker'
import * as Rank from '../lib/rank'
import * as Sortings from '../lib/sortings'
import { qnumSortkeyOf } from '../lib/columns'
import { askError, type LastErrT } from '../models/ask'
import { PlaySlots, unrecordedPlayings, type PlaySlot } from '../models/playing'
import { Question, QuestionValidators, type QuestionPatch, type QuestionT } from '../models/question'
import { Quiz } from '../models/quiz'
import { defaultLayoutFor } from '../models/layout'
import type { GuessT } from '../models/guess'
import type { IshesT } from '../models/ish'
import type { BulkLanding } from '../lib/ask/bulk'
import type { Textkind } from '../lib/ask/contract'
import type { BulkIshesRunT, QuizT, Sortkey } from '../models/quiz'
import { Workspace, type WorkspaceT } from '../models/workspace'
import { expressionFrom, loadQuizRows, loadWorkspaceRows, quizFrom, type QuizRows } from './quiz-rows'
import { deleteQuiz, playingFieldsOf, transact, updateQuestion, updateQuiz, updateWorkspace, writeQuiz, writeWorkspace, type Tx } from './quiz-writing'

/** The quiz an author has on screen, and the workspace it belongs to: where every action lands */
export type OpenQuiz = {
  workspace_id: string
  quiz_id:      string
}

/**
 * Run `write` against the open quiz's rows in one transaction, unless the quiz is locked or gone.
 * The freeze is a property of the quiz, not of whether a button happened to be greyed out.
 */
export async function reviseOpenQuiz(db: Db, open: OpenQuiz, write: (tx: Tx, rows: QuizRows) => void): Promise<void> {
  const rows = await loadQuizRows(db, open.quiz_id)
  if (! rows || rows.quiz.locked) { return }
  await transact(db, (tx) => { write(tx, rows) })
}

/** The open quiz's rows and the quiz they make up, for an action that works out a new order */
async function reorderOpenQuiz(db: Db, open: OpenQuiz, reorder: (quiz: QuizT) => { questions: readonly QuestionT[], last_sortkey?: Sortkey | null }): Promise<void> {
  await reviseOpenQuiz(db, open, (tx, rows) => {
    const { questions, last_sortkey } = reorder(quizFrom(rows))
    writeOrder(tx, rows, questions)
    if (last_sortkey !== undefined) { updateQuiz(tx, rows.quiz, { last_sortkey }) }
  })
}

/** Each question's row put at its place in `ordered`, with the Q# `ordered` gives it */
function writeOrder(tx: Tx, rows: QuizRows, ordered: readonly QuestionT[]): void {
  const heldFor = new Map(rows.questions.map((row) => [row.id, row]))
  for (const [position, question] of ordered.entries()) {
    const held = heldFor.get(question.id)
    if (held) { updateQuestion(tx, held, { position, qnum: question.qnum }) }
  }
}

/** Retitle the open quiz. An empty title is kept as it is; the screen shows it as "Untitled quiz". */
export async function retitleQuiz(db: Db, open: OpenQuiz, title: string): Promise<void> {
  await reviseOpenQuiz(db, open, (tx, rows) => { updateQuiz(tx, rows.quiz, { title }) })
}

/**
 * Override the open quiz's generated label, which is kept. The label itself, and uniqueness
 * against sibling quizzes, are the caller's to check first.
 */
export async function relabelQuiz(db: Db, open: OpenQuiz, label: string): Promise<void> {
  await reviseOpenQuiz(db, open, (tx, rows) => { updateQuiz(tx, rows.quiz, { forced_label: label }) })
}

/**
 * Put the open quiz on another version. Naming one its history has not seen starts a branch
 * there, not here; the shape of the name is the caller's to check.
 */
export async function reversionQuiz(db: Db, open: OpenQuiz, version: string): Promise<void> {
  await reviseOpenQuiz(db, open, (tx, rows) => { updateQuiz(tx, rows.quiz, { version }) })
}

/**
 * Revise one question of the open quiz by a patch, validated first. A chain in the patch names
 * the question it points at; one that names no other question of the quiz is cleared. A reply
 * in the patch is recorded as the newest for its cell.
 *
 * Nothing is marked stale here: a reply is stale exactly when the text it was asked about is no
 * longer the question's, which reading the rows works out.
 *
 * @throws When the patch is not valid; nothing is written.
 */
export async function editQuestion(db: Db, open: OpenQuiz, question_id: string, patch: QuestionPatch): Promise<void> {
  const clean = QuestionValidators.questionPatch(patch)
  await reviseOpenQuiz(db, open, (tx, rows) => {
    const held = rows.questions.find((row) => row.id === question_id)
    if (! held) { return }
    const { guess, clueing_ishes, hint_ishes, chains_to, ...fields } = clean
    updateQuestion(tx, held, { ...fields, ...(chains_to !== undefined && { chains_to: chainLabelFor(rows, held, chains_to) }) })
    const results = { guess, clueing_ishes, hint_ishes }
    for (const slot of PlaySlots) {
      const result = results[slot.field]
      if (result) { recordResult(tx, quizFrom(rows), held, slot, result) }
    }
  })
}

/** The label a chain from `held` to the question `chains_to` names is written as; null when it names no other question here */
function chainLabelFor(rows: QuizRows, held: QuestionRow, chains_to: string | null): string | null {
  const target = rows.questions.find((row) => row.id === chains_to && row.id !== held.id)
  return target ? Labelmaker.effectiveLabelOf(target) : null
}

/** Add a blank question to the end of the open quiz */
export async function addQuestion(db: Db, open: OpenQuiz): Promise<void> {
  await reviseOpenQuiz(db, open, (tx, rows) => {
    const blank = Question.blank()
    tx.insert(app.questions, QuestionValidators.row({
      ...blank,
      quiz_id:  rows.quiz.id,
      position: rows.questions.length,
      chains_to: null,
    }))
  })
}

/**
 * Sort the open quiz's questions by a column, or by any sort memory, and commit the order: the
 * new positions are written, not draped over the top, and the quiz remembers what put it so.
 */
export async function sortQuestions(db: Db, open: OpenQuiz, sortkey: Sortkey, descending: boolean): Promise<void> {
  const workspace = await loadWorkspaceRows(db, open.workspace_id)
  const expressions = (workspace?.expressions ?? []).map((row) => expressionFrom(row))
  await reorderOpenQuiz(db, open, (quiz) => ({
    questions:    Sortings.sortQuestions(quiz.questions, Sortings.sortValueFor(sortkey, quiz, Expressed.forQuiz(quiz, expressions)), descending),
    last_sortkey: sortkey,
  }))
}

/**
 * Tidy the open quiz's Q#s into whole numbers, rank by rank, with no question moving.
 *
 * The sort memory is left alone: claiming the quiz is now in Q# order would flip the grid into a
 * mode that re-sorts at once, undoing the promise that nothing moved.
 */
export async function renumberQnums(db: Db, open: OpenQuiz): Promise<void> {
  await reorderOpenQuiz(db, open, (quiz) => ({ questions: Rank.renumberByRank(quiz.questions) }))
}

/** Drag one question of the open quiz to `onto_idx`, then number every question by where it sits. A drag leaves the quiz in Q# order. */
export async function moveQuestion(db: Db, open: OpenQuiz, question_id: string, onto_idx: number): Promise<void> {
  await reorderOpenQuiz(db, open, (quiz) => ({
    questions:    Rank.renumberByPosition(Rank.moveQuestion(quiz.questions, question_id, onto_idx)),
    last_sortkey: qnumSortkeyOf(quiz),
  }))
}

/** Chain one question of the open quiz to another, or unchain it with null. A chain to itself or to no question here is no chain. */
export async function setChain(db: Db, open: OpenQuiz, question_id: string, chains_to: string | null): Promise<void> {
  await reviseOpenQuiz(db, open, (tx, rows) => {
    const held = rows.questions.find((row) => row.id === question_id)
    if (held) { updateQuestion(tx, held, { chains_to: chainLabelFor(rows, held, chains_to) }) }
  })
}

/** Put the open quiz in the order its chains walk, and remember that */
export async function sortByChainOrder(db: Db, open: OpenQuiz, descending: boolean): Promise<void> {
  await reorderOpenQuiz(db, open, (quiz) => ({ questions: Chain.chainOrder(quiz.questions, descending), last_sortkey: 'chain_order' }))
}

/** The slot a player's reply to a question's text lands in */
function slotFor(field: PlaySlot['field']): PlaySlot {
  return PlaySlots.find((slot) => slot.field === field) ?? PlaySlots[0]
}

/**
 * Record `result` as the newest in `slot` of the question `held`: a reply as a playing that
 * answered, a failure as one that failed. What the cell held before stays in its history.
 */
function recordResult(tx: Tx, quiz: QuizT, held: QuestionRow, slot: PlaySlot, result: NonNullable<GuessT | IshesT>): void {
  const question = quiz.questions.find((each) => each.id === held.id)
  if (! question) { return }
  const alone = { ...question, guess: null, clueing_ishes: null, hint_ishes: null, [slot.field]: result }
  const recording = unrecordedPlayings(alone, new Map())
  for (const playing of recording) { tx.insert(app.playings, playingFieldsOf(playing)) }
}

/** Record a reply, or a failure, in one played cell of a question of the open quiz */
async function recordInCell(db: Db, open: OpenQuiz, question_id: string, field: PlaySlot['field'], result: NonNullable<GuessT | IshesT>): Promise<void> {
  await reviseOpenQuiz(db, open, (tx, rows) => {
    const held = rows.questions.find((row) => row.id === question_id)
    if (held) { recordResult(tx, quizFrom(rows), held, slotFor(field), result) }
  })
}

/** Record dumdum's guess at a question. Null records nothing: a cell's history is never erased. */
export async function setGuess(db: Db, open: OpenQuiz, question_id: string, guess: GuessT): Promise<void> {
  if (guess) { await recordInCell(db, open, question_id, 'guess', guess) }
}

/** Record numnum's extraction from one of a question's texts. Null records nothing. */
export async function setIshes(db: Db, open: OpenQuiz, question_id: string, textkind: Textkind, ishes: IshesT): Promise<void> {
  if (ishes) { await recordInCell(db, open, question_id, textkind === 'clueing' ? 'clueing_ishes' : 'hint_ishes', ishes) }
}

/**
 * Record a failed ask for dumdum's guess. A failure never replaces a value: it rides along on
 * the newest reply as its `last_err`, and is the cell's only content when there never was one.
 */
export async function failGuess(db: Db, open: OpenQuiz, question_id: string, err: LastErrT): Promise<void> {
  await recordInCell(db, open, question_id, 'guess', askError(err))
}

/** Record a failed ask for numnum's extraction, as `failGuess` does for a guess */
export async function failIshes(db: Db, open: OpenQuiz, question_id: string, textkind: Textkind, err: LastErrT): Promise<void> {
  await recordInCell(db, open, question_id, textkind === 'clueing' ? 'clueing_ishes' : 'hint_ishes', askError(err))
}

/**
 * Record what one combined run found, text by text: an extraction where it gave one, a failure
 * riding on whatever the cell held where it left a text out. The quiz keeps what the run cost.
 */
export async function applyBulkIshes(db: Db, open: OpenQuiz, landings: readonly BulkLanding[], run: BulkIshesRunT): Promise<void> {
  await reviseOpenQuiz(db, open, (tx, rows) => {
    const quiz = quizFrom(rows)
    for (const landing of landings) {
      const held = rows.questions.find((row) => row.id === landing.question_id)
      const result = landing.ishes ?? (landing.err ? askError(landing.err) : null)
      if (held && result) { recordResult(tx, quiz, held, slotFor(landing.textkind === 'clueing' ? 'clueing_ishes' : 'hint_ishes'), result) }
    }
    updateQuiz(tx, rows.quiz, { bulk_ishes_last: run })
  })
}

/** Replace the open quiz with `quiz`, whole, as an import merged it: see `writeQuiz` */
export async function replaceOpenQuiz(db: Db, open: OpenQuiz, quiz: QuizT): Promise<void> {
  await reviseOpenQuiz(db, open, (tx, rows) => { writeQuiz(tx, open.workspace_id, quiz, rows) })
}

/**
 * The account's workspace, made when it has none yet: one blank quiz, open, with the standard
 * expressions and columns.
 *
 * An account's rows are its own, so the workspace is whichever this account made. Before making
 * one, this asks the server when it can reach it, so a device that has not synced yet does not
 * make a second. Should two ever exist, the one made first is the one used.
 *
 * @param db - The account's database.
 * @returns The workspace's row id.
 *
 * @example const workspace_id = await ensureWorkspace(db)
 */
export async function ensureWorkspace(db: Db): Promise<string> {
  const [held] = await db.all(app.workspaces.orderBy('$createdAt').limit(1), { tier: 'remote-if-possible' })
  if (held) { return held.id }
  const made = await transact(db, (tx) => writeWorkspace(tx, Workspace.blank(), null))
  if (made === null) { throw new Error('Making a workspace wrote nothing') }
  return made
}

// What follows is about the workspace rather than a quiz's contents, so a locked quiz refuses
// none of it. Locking must never be a trap: you can always switch away, make another quiz,
// delete one, or unlock.

/** Remember `quiz_id` as the quiz on screen, when the workspace holds it */
export async function openQuiz(db: Db, open: OpenQuiz, quiz_id: string): Promise<void> {
  const held = await loadWorkspaceRows(db, open.workspace_id)
  if (! held?.quizzes.some((quiz) => quiz.id === quiz_id)) { return }
  await transact(db, (tx) => { updateWorkspace(tx, held.workspace, { active_quiz_id: quiz_id }) })
}

/**
 * Make a fresh quiz, with its blank questions and the standard layout for the expressions the
 * workspace holds, and open it.
 *
 * A label some quiz already answers to is refused rather than disambiguated, as a duplicate
 * widget or column label is: a label is an address, and a caller that has already put this one
 * in one would be sent to the wrong quiz. `Labelmaker.freshLabelFor` gives one that will do.
 *
 * @returns The new quiz's row id; null when the label was refused.
 */
export async function newQuiz(db: Db, open: OpenQuiz, label?: string): Promise<string | null> {
  const held = await loadWorkspaceRows(db, open.workspace_id)
  if (! held) { return null }
  const fresh = { ...Quiz.blank('', label), ...defaultLayoutFor(held.expressions.map((row) => expressionFrom(row))) }
  if (held.quizzes.some((quiz) => Labelmaker.effectiveLabelOf(quiz) === Labelmaker.effectiveLabelOf(fresh))) { return null }
  return await transact(db, (tx) => {
    const made = writeQuiz(tx, held.workspace.id, fresh, null)
    updateWorkspace(tx, held.workspace, { active_quiz_id: made })
    return made
  })
}

/**
 * Delete a quiz and all it holds, opening its neighbour in its place when it was open. The last
 * remaining quiz cannot go: a workspace with nothing in it would leave the author staring at an
 * empty screen with no way back.
 */
export async function deleteQuizFrom(db: Db, open: OpenQuiz, quiz_id: string): Promise<void> {
  const held = await loadWorkspaceRows(db, open.workspace_id)
  const doomed = await loadQuizRows(db, quiz_id)
  if (! held || ! doomed || held.quizzes.length <= 1) { return }
  const idx = held.quizzes.findIndex((quiz) => quiz.id === quiz_id)
  if (idx === -1) { return }
  const remaining = held.quizzes.filter((quiz) => quiz.id !== quiz_id)
  const neighbour = remaining[Math.min(idx, remaining.length - 1)]
  await transact(db, (tx) => {
    deleteQuiz(tx, doomed)
    if (neighbour && held.workspace.active_quiz_id === quiz_id) { updateWorkspace(tx, held.workspace, { active_quiz_id: neighbour.id }) }
  })
}

/** Lock or unlock a quiz. Works from inside the lock, and changes nothing else about the quiz. */
export async function setLock(db: Db, quiz_id: string, locked: boolean): Promise<void> {
  const rows = await loadQuizRows(db, quiz_id)
  if (rows) { await transact(db, (tx) => { updateQuiz(tx, rows.quiz, { locked }) }) }
}

/** Replace the whole workspace with `workspace`, as `writeWorkspace` does */
export async function replaceWorkspace(db: Db, open: OpenQuiz, workspace: WorkspaceT): Promise<void> {
  const rows = await loadWorkspaceRows(db, open.workspace_id)
  if (! rows) { return }
  const quizzes = await Promise.all(rows.quizzes.map(async (quiz) => await loadQuizRows(db, quiz.id)))
  await transact(db, (tx) => { writeWorkspace(tx, workspace, { rows, quizzes: quizzes.filter((each) => each !== null) }) })
}
