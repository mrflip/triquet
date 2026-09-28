import _ from 'es-toolkit/compat'
import type { Db } from 'jazz-tools'
import { app, type QuestionRow } from '../db/schema'
import * as Chain from '../lib/chain'
import * as Expressed from '../lib/expressed'
import * as Labelmaker from '../lib/labelmaker'
import * as Rank from '../lib/rank'
import * as Sortings from '../lib/sortings'
import { qnumSortkeyOf } from '../lib/columns'
import { askError, type LastErrT } from '../models/ask'
import { BotSlots, unrecordedBottings, type BotSlot } from '../models/botting'
import { Question, QuestionValidators, type QuestionPatch, type QuestionT } from '../models/question'
import { Quiz } from '../models/quiz'
import { defaultLayoutFor } from '../models/layout'
import type { GuessT } from '../models/guess'
import type { IshesT } from '../models/ish'
import type { BulkLanding } from '../lib/ask/bulk'
import type { Textkind } from '../lib/ask/contract'
import type { BulkIshesRunT, QuizT, Sortkey } from '../models/quiz'
import { expressionFrom, huntRowsOf, quizFrom, quizRowsOf, type HeldRows, type QuizRows } from './quiz-rows'
import { deleteQuiz, bottingFieldsOf, transact, updateQuestion, updateQuiz, writeQuiz, type Tx } from './quiz-writing'

/** The quiz an author has on screen, and the realm and hunt it belongs to: where every action lands */
export type OpenQuiz = {
  hunt_id:  string
  realm_id: string
  quiz_id:  string
}

/**
 * Run `write` against the open quiz's rows, as `held` has them, in one transaction, unless the
 * quiz is locked or gone.
 * The freeze is a property of the quiz, not of whether a button happened to be greyed out.
 */
export async function reviseOpenQuiz(db: Db, held: HeldRows, open: OpenQuiz, write: (tx: Tx, rows: QuizRows) => void): Promise<void> {
  const rows = quizRowsOf(held, open.quiz_id)
  if (! rows || rows.quiz.locked) { return }
  await transact(db, (tx) => { write(tx, rows) })
}

/** The open quiz's rows and the quiz they make up, for an action that works out a new order */
async function reorderOpenQuiz(db: Db, held: HeldRows, open: OpenQuiz, reorder: (quiz: QuizT) => { questions: readonly QuestionT[], last_sortkey?: Sortkey | null }): Promise<void> {
  await reviseOpenQuiz(db, held, open, (tx, rows) => {
    const { questions, last_sortkey } = reorder(quizFrom(rows))
    writeOrder(tx, rows, questions)
    if (last_sortkey !== undefined) { updateQuiz(tx, rows.quiz, { last_sortkey }) }
  })
}

/** Each question's row put at its place in `ordered`, with the Q# `ordered` gives it */
function writeOrder(tx: Tx, rows: QuizRows, ordered: readonly QuestionT[]): void {
  const heldFor = new Map(rows.questions.map((row) => [row.id, row]))
  for (const [position, question] of ordered.entries()) {
    const held = heldFor.get(question._id)
    if (held) { updateQuestion(tx, held, { position, qnum: question.qnum }) }
  }
}

/** Retitle the open quiz. An empty title is kept as it is; the screen shows it as "Untitled quiz". */
export async function retitleQuiz(db: Db, held: HeldRows, open: OpenQuiz, title: string): Promise<void> {
  await reviseOpenQuiz(db, held, open, (tx, rows) => { updateQuiz(tx, rows.quiz, { title }) })
}

/**
 * Override the open quiz's generated label, which is kept. The label itself, and uniqueness
 * against sibling quizzes, are the caller's to check first.
 */
export async function relabelQuiz(db: Db, held: HeldRows, open: OpenQuiz, label: string): Promise<void> {
  await reviseOpenQuiz(db, held, open, (tx, rows) => { updateQuiz(tx, rows.quiz, { forced_label: label }) })
}

/**
 * Put the open quiz on another version. Naming one its history has not seen starts a branch
 * there, not here; the shape of the name is the caller's to check.
 */
export async function reversionQuiz(db: Db, held: HeldRows, open: OpenQuiz, version: string): Promise<void> {
  await reviseOpenQuiz(db, held, open, (tx, rows) => { updateQuiz(tx, rows.quiz, { version }) })
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
export async function editQuestion(db: Db, held: HeldRows, open: OpenQuiz, question_id: string, patch: QuestionPatch): Promise<void> {
  const clean = QuestionValidators.questionPatch(patch)
  await reviseOpenQuiz(db, held, open, (tx, rows) => {
    const held = rows.questions.find((row) => row.id === question_id)
    if (! held) { return }
    const { guess, clueing_ishes, hint_ishes, chains_to, ...fields } = clean
    updateQuestion(tx, held, { ...fields, ...(chains_to !== undefined && { chains_to: chainLabelFor(rows, held, chains_to) }) })
    const results = { guess, clueing_ishes, hint_ishes }
    for (const slot of BotSlots) {
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
export async function addQuestion(db: Db, held: HeldRows, open: OpenQuiz): Promise<void> {
  await reviseOpenQuiz(db, held, open, (tx, rows) => {
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
 * Delete questions from the open quiz, with every reply their bots gave. The questions left
 * close ranks and keep their Q#s; a chain to a deleted question is cleared rather than left to
 * be picked up by whichever question answers to that label next. Ids of no question here are
 * passed over.
 */
export async function deleteQuestions(db: Db, held: HeldRows, open: OpenQuiz, question_ids: readonly string[]): Promise<void> {
  const doomed = new Set(question_ids)
  await reviseOpenQuiz(db, held, open, (tx, rows) => {
    const [gone, kept] = _.partition(rows.questions, (row) => doomed.has(row.id))
    const goneLabels = new Set(gone.map((row) => Labelmaker.effectiveLabelOf(row)))
    for (const botting of rows.bottings) {
      if (doomed.has(botting.question_id)) { tx.delete(app.bottings, botting.id) }
    }
    for (const row of gone) { tx.delete(app.questions, row.id) }
    for (const [position, row] of kept.entries()) {
      const orphaned = row.chains_to !== null && goneLabels.has(row.chains_to)
      updateQuestion(tx, row, { position, ...(orphaned && { chains_to: null }) })
    }
  })
}

/**
 * Sort the open quiz's questions by a column, or by any sort memory, and commit the order: the
 * new positions are written, not draped over the top, and the quiz remembers what put it so.
 */
export async function sortQuestions(db: Db, held: HeldRows, open: OpenQuiz, sortkey: Sortkey, descending: boolean): Promise<void> {
  const expressions = (huntRowsOf(held, open.hunt_id)?.expressions ?? []).map((row) => expressionFrom(row))
  await reorderOpenQuiz(db, held, open, (quiz) => ({
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
export async function renumberQnums(db: Db, held: HeldRows, open: OpenQuiz): Promise<void> {
  await reorderOpenQuiz(db, held, open, (quiz) => ({ questions: Rank.renumberByRank(quiz.questions) }))
}

/** Drag one question of the open quiz to `onto_idx`, then number every question by where it sits. A drag leaves the quiz in Q# order. */
export async function moveQuestion(db: Db, held: HeldRows, open: OpenQuiz, question_id: string, onto_idx: number): Promise<void> {
  await reorderOpenQuiz(db, held, open, (quiz) => ({
    questions:    Rank.renumberByPosition(Rank.moveQuestion(quiz.questions, question_id, onto_idx)),
    last_sortkey: qnumSortkeyOf(quiz),
  }))
}

/** Chain one question of the open quiz to another, or unchain it with null. A chain to itself or to no question here is no chain. */
export async function setChain(db: Db, held: HeldRows, open: OpenQuiz, question_id: string, chains_to: string | null): Promise<void> {
  await reviseOpenQuiz(db, held, open, (tx, rows) => {
    const held = rows.questions.find((row) => row.id === question_id)
    if (held) { updateQuestion(tx, held, { chains_to: chainLabelFor(rows, held, chains_to) }) }
  })
}

/** Put the open quiz in the order its chains walk, and remember that */
export async function sortByChainOrder(db: Db, held: HeldRows, open: OpenQuiz, descending: boolean): Promise<void> {
  await reorderOpenQuiz(db, held, open, (quiz) => ({ questions: Chain.chainOrder(quiz.questions, descending), last_sortkey: 'chain_order' }))
}

/** The slot a bot's reply to a question's text lands in */
function slotFor(field: BotSlot['field']): BotSlot {
  return BotSlots.find((slot) => slot.field === field) ?? BotSlots[0]
}

/**
 * Record `result` as the newest in `slot` of the question `held`: a reply as a botting that
 * answered, a failure as one that failed. What the cell held before stays in its history.
 */
function recordResult(tx: Tx, quiz: QuizT, held: QuestionRow, slot: BotSlot, result: NonNullable<GuessT | IshesT>): void {
  const question = quiz.questions.find((each) => each._id === held.id)
  if (! question) { return }
  const alone = { ...question, guess: null, clueing_ishes: null, hint_ishes: null, [slot.field]: result }
  const recording = unrecordedBottings(alone, new Map())
  for (const botting of recording) { tx.insert(app.bottings, bottingFieldsOf(botting)) }
}

/** Record a reply, or a failure, in one played cell of a question of the open quiz */
async function recordInCell(db: Db, held: HeldRows, open: OpenQuiz, question_id: string, field: BotSlot['field'], result: NonNullable<GuessT | IshesT>): Promise<void> {
  await reviseOpenQuiz(db, held, open, (tx, rows) => {
    const held = rows.questions.find((row) => row.id === question_id)
    if (held) { recordResult(tx, quizFrom(rows), held, slotFor(field), result) }
  })
}

/** Record dumdum's guess at a question. Null records nothing: a cell's history is never erased. */
export async function setGuess(db: Db, held: HeldRows, open: OpenQuiz, question_id: string, guess: GuessT): Promise<void> {
  if (guess) { await recordInCell(db, held, open, question_id, 'guess', guess) }
}

/** Record numnum's extraction from one of a question's texts. Null records nothing. */
export async function setIshes(db: Db, held: HeldRows, open: OpenQuiz, question_id: string, textkind: Textkind, ishes: IshesT): Promise<void> {
  if (ishes) { await recordInCell(db, held, open, question_id, textkind === 'clueing' ? 'clueing_ishes' : 'hint_ishes', ishes) }
}

/**
 * Record a failed ask for dumdum's guess. A failure never replaces a value: it rides along on
 * the newest reply as its `last_err`, and is the cell's only content when there never was one.
 */
export async function failGuess(db: Db, held: HeldRows, open: OpenQuiz, question_id: string, err: LastErrT): Promise<void> {
  await recordInCell(db, held, open, question_id, 'guess', askError(err))
}

/** Record a failed ask for numnum's extraction, as `failGuess` does for a guess */
export async function failIshes(db: Db, held: HeldRows, open: OpenQuiz, question_id: string, textkind: Textkind, err: LastErrT): Promise<void> {
  await recordInCell(db, held, open, question_id, textkind === 'clueing' ? 'clueing_ishes' : 'hint_ishes', askError(err))
}

/**
 * Record what one combined run found, text by text: an extraction where it gave one, a failure
 * riding on whatever the cell held where it left a text out. The quiz keeps what the run cost.
 */
export async function applyBulkIshes(db: Db, held: HeldRows, open: OpenQuiz, landings: readonly BulkLanding[], run: BulkIshesRunT): Promise<void> {
  await reviseOpenQuiz(db, held, open, (tx, rows) => {
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
export async function replaceOpenQuiz(db: Db, held: HeldRows, open: OpenQuiz, quiz: QuizT): Promise<void> {
  await reviseOpenQuiz(db, held, open, (tx, rows) => { writeQuiz(tx, rows.quiz.realm_id, quiz, rows) })
}

// What follows is about the realm rather than a quiz's contents, so a locked quiz refuses none of
// it. Locking must never be a trap: you can always switch away, make another quiz, delete one, or
// unlock.

/**
 * Make a fresh quiz in the open quiz's realm, with its blank questions and the standard layout
 * for the expressions the hunt holds.
 *
 * A label some quiz of the realm already answers to is refused rather than disambiguated, as a
 * duplicate widget or column label is: a label is an address, and a caller that has already put
 * this one in one would be sent to the wrong quiz. `Labelmaker.freshLabelFor` gives one that will
 * do.
 *
 * @returns The new quiz's row id; null when the label was refused.
 */
export async function newQuiz(db: Db, held: HeldRows, open: OpenQuiz, label?: string): Promise<string | null> {
  const rows = huntRowsOf(held, open.hunt_id)
  if (! rows) { return null }
  const siblings = rows.quizzes.filter((quiz) => quiz.realm_id === open.realm_id)
  const fresh = { ...Quiz.blank('', label), ...defaultLayoutFor(rows.expressions.map((row) => expressionFrom(row))) }
  if (siblings.some((quiz) => Labelmaker.effectiveLabelOf(quiz) === Labelmaker.effectiveLabelOf(fresh))) { return null }
  return await transact(db, (tx) => writeQuiz(tx, open.realm_id, fresh, null))
}

/**
 * Delete a quiz of the open quiz's realm and all it holds. The realm's last quiz cannot go: an
 * empty realm would leave its address leading nowhere, and the author with no way back.
 */
export async function deleteQuizFrom(db: Db, held: HeldRows, open: OpenQuiz, quiz_id: string): Promise<void> {
  const siblings = held.quizzes.filter((quiz) => quiz.realm_id === open.realm_id)
  const doomed = quizRowsOf(held, quiz_id)
  if (doomed?.quiz.realm_id !== open.realm_id || siblings.length <= 1) { return }
  await transact(db, (tx) => { deleteQuiz(tx, doomed) })
}

/** Lock or unlock a quiz. Works from inside the lock, and changes nothing else about the quiz. */
export async function setLock(db: Db, held: HeldRows, quiz_id: string, locked: boolean): Promise<void> {
  const rows = quizRowsOf(held, quiz_id)
  if (rows) { await transact(db, (tx) => { updateQuiz(tx, rows.quiz, { locked }) }) }
}
