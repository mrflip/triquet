import _ from 'es-toolkit/compat'
import type { Doc, Id } from '../_generated/dataModel'
import * as Chain from '../../src/lib/chain'
import * as Expressed from '../../src/lib/expressed'
import * as Labelmaker from '../../src/lib/labelmaker'
import * as Rank from '../../src/lib/rank'
import * as Sortings from '../../src/lib/sortings'
import * as PA from '../../src/lib/vv/patterns'
import { qnumSortkeyOf } from '../../src/lib/columns'
import { refuse } from '../../src/lib/refusals'
import { expressionFrom, quizFrom, type QuizRows } from '../../src/lib/rows'
import { askError, type LastErrT } from '../../src/models/ask'
import { BotSlots, unrecordedBottings, type BotSlot } from '../../src/models/botting'
import { Question, QuestionValidators, type QuestionPatch, type QuestionT } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { defaultLayoutFor } from '../../src/models/layout'
import type { OpenQuizT } from '../../src/models/actions'
import type { GuessT } from '../../src/models/guess'
import type { IshesT } from '../../src/models/ish'
import type { Textkind } from '../../src/lib/ask/contract'
import type { BulkIshesRunT, QuizT, Sortkey } from '../../src/models/quiz'
import { expressionsOf, quizRowsOf, quizzesOf } from '../reading'
import { deleteQuestion, deleteQuiz, insertBottings, updateQuestion, updateQuiz, writeQuiz, type Writer } from './quiz_writing'

/** One landing of a combined run: where one text's answer lands, the extraction or the failure */
export type BulkLandingT = {
  question_id: Id<'questions'>
  textkind:    Textkind
  ishes:       NonNullable<IshesT> | null
  err:         LastErrT | null
}

/**
 * Run `write` against the open quiz's rows, as they stand, refusing when the quiz is locked or
 * gone. The freeze is a property of the quiz, not of whether a button happened to be greyed out.
 *
 * @throws A refusal (`quizGone`, `quizLocked`); nothing is written.
 */
export async function reviseOpenQuiz(db: Writer, open: OpenQuizT, write: (rows: QuizRows) => Promise<void>): Promise<void> {
  const rows = await quizRowsOf(db, open.quiz_id)
  if (! rows) { refuse('quizGone') }
  if (rows.quiz.locked) { refuse('quizLocked') }
  await write(rows)
}

/** The row of the question `question_id` among the open quiz's, refusing when it is not there */
function questionIn(rows: QuizRows, question_id: string): Doc<'questions'> {
  const held = rows.questions.find((row) => row._id === question_id)
  if (! held) { refuse('questionGone') }
  return held
}

/** The open quiz's rows and the quiz they make up, for an action that works out a new order */
async function reorderOpenQuiz(db: Writer, open: OpenQuizT, reorder: (quiz: QuizT) => { questions: readonly QuestionT[], last_sortkey?: Sortkey | null }): Promise<void> {
  await reviseOpenQuiz(db, open, async (rows) => {
    const { questions, last_sortkey } = reorder(quizFrom(rows))
    await writeOrder(db, rows, questions)
    if (last_sortkey !== undefined) { await updateQuiz(db, rows.quiz, { last_sortkey }) }
  })
}

/** Each question's row put at its place in `ordered`, with the Q# `ordered` gives it */
async function writeOrder(db: Writer, rows: QuizRows, ordered: readonly QuestionT[]): Promise<void> {
  const heldFor = new Map(rows.questions.map((row) => [row._id as string, row]))
  for (const [position, question] of ordered.entries()) {
    const held = heldFor.get(question._id)
    if (held) { await updateQuestion(db, held, { position, qnum: question.qnum }) }
  }
}

/** Retitle the open quiz. An empty title is kept as it is; the screen shows it as "Untitled quiz". */
export async function retitleQuiz(db: Writer, open: OpenQuizT, title: string): Promise<void> {
  await reviseOpenQuiz(db, open, async (rows) => { await updateQuiz(db, rows.quiz, { title }) })
}

/**
 * Override the open quiz's generated label, which is kept. The label itself, and uniqueness
 * against sibling quizzes, are the caller's to check first.
 */
export async function relabelQuiz(db: Writer, open: OpenQuizT, label: string): Promise<void> {
  await reviseOpenQuiz(db, open, async (rows) => { await updateQuiz(db, rows.quiz, { forced_label: label }) })
}

/**
 * Put the open quiz on another version. Naming one its history has not seen starts a branch
 * there, not here; the shape of the name is the caller's to check.
 */
export async function reversionQuiz(db: Writer, open: OpenQuizT, version: string): Promise<void> {
  await reviseOpenQuiz(db, open, async (rows) => { await updateQuiz(db, rows.quiz, { version }) })
}

/**
 * Revise one question of the open quiz by a patch. A chain in the patch names the question it
 * points at; one that names no other question of the quiz is cleared. A reply in the patch is
 * recorded as the newest for its cell. A question not in the quiz is refused.
 *
 * Nothing is marked stale here: a reply is stale exactly when the text it was asked about is no
 * longer the question's, which reading the rows works out.
 */
export async function editQuestion(db: Writer, open: OpenQuizT, question_id: string, patch: QuestionPatch): Promise<void> {
  await reviseOpenQuiz(db, open, async (rows) => {
    const held = questionIn(rows, question_id)
    const { guess, clueing_ishes, hint_ishes, chains_to, ...fields } = patch
    await updateQuestion(db, held, { ...fields, ...(chains_to !== undefined && { chains_to: chainLabelFor(rows, held, chains_to) }) })
    const results = { guess, clueing_ishes, hint_ishes }
    for (const slot of BotSlots) {
      const result = results[slot.field]
      if (result) { await recordResult(db, quizFrom(rows), held, slot, result) }
    }
  })
}

/** The label a chain from `held` to the question `chains_to` names is written as; null when it names no other question here */
function chainLabelFor(rows: QuizRows, held: Doc<'questions'>, chains_to: string | null): string | null {
  const target = rows.questions.find((row) => row._id === chains_to && row._id !== held._id)
  return target ? Labelmaker.effectiveLabelOf(target) : null
}

/** Add a blank question to the end of the open quiz; refused when it holds as many as a quiz may */
export async function addQuestion(db: Writer, open: OpenQuizT): Promise<void> {
  await reviseOpenQuiz(db, open, async (rows) => {
    if (rows.questions.length >= PA.QuestionsPerQuiz.max) { refuse('questionsFull') }
    await db.insert('questions', QuestionValidators.row({ ...Question.blank(), quiz_id: rows.quiz._id, position: rows.questions.length, chains_to: null }))
  })
}

/**
 * Delete questions from the open quiz, with every reply their bots gave. The questions left
 * close ranks and keep their Q#s; a chain to a deleted question is cleared rather than left to
 * be picked up by whichever question answers to that label next. Ids of no question here are
 * passed over.
 */
export async function deleteQuestions(db: Writer, open: OpenQuizT, question_ids: readonly string[]): Promise<void> {
  const doomed = new Set(question_ids)
  await reviseOpenQuiz(db, open, async (rows) => {
    const [gone, kept] = _.partition(rows.questions, (row) => doomed.has(row._id))
    const goneLabels = new Set(gone.map((row) => Labelmaker.effectiveLabelOf(row)))
    for (const row of gone) { await deleteQuestion(db, row._id) }
    for (const [position, row] of kept.entries()) {
      const orphaned = row.chains_to !== null && goneLabels.has(row.chains_to)
      await updateQuestion(db, row, { position, ...(orphaned && { chains_to: null }) })
    }
  })
}

/**
 * Sort the open quiz's questions by a column, or by any sort memory, and commit the order: the
 * new positions are written, not draped over the top, and the quiz remembers what put it so.
 */
export async function sortQuestions(db: Writer, open: OpenQuizT, sortkey: Sortkey, descending: boolean): Promise<void> {
  const rows = await expressionsOf(db, open.hunt_id)
  const expressions = rows.map((row) => expressionFrom(row))
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
export async function renumberQnums(db: Writer, open: OpenQuizT): Promise<void> {
  await reorderOpenQuiz(db, open, (quiz) => ({ questions: Rank.renumberByRank(quiz.questions) }))
}

/** Drag one question of the open quiz to `onto_idx`, then number every question by where it sits. A drag leaves the quiz in Q# order. */
export async function moveQuestion(db: Writer, open: OpenQuizT, question_id: string, onto_idx: number): Promise<void> {
  await reorderOpenQuiz(db, open, (quiz) => ({
    questions:    Rank.renumberByPosition(Rank.moveQuestion(quiz.questions, question_id, onto_idx)),
    last_sortkey: qnumSortkeyOf(quiz),
  }))
}

/**
 * Chain one question of the open quiz to another, or unchain it with null. A chain to itself or
 * to no question here is no chain; a question not in the quiz is refused.
 */
export async function setChain(db: Writer, open: OpenQuizT, question_id: string, chains_to: string | null): Promise<void> {
  await reviseOpenQuiz(db, open, async (rows) => {
    const held = questionIn(rows, question_id)
    await updateQuestion(db, held, { chains_to: chainLabelFor(rows, held, chains_to) })
  })
}

/** Put the open quiz in the order its chains walk, and remember that */
export async function sortByChainOrder(db: Writer, open: OpenQuizT, descending: boolean): Promise<void> {
  await reorderOpenQuiz(db, open, (quiz) => ({ questions: Chain.chainOrder(quiz.questions, descending), last_sortkey: 'chain_order' }))
}

/** The slot a bot's reply to a question's text lands in */
function slotFor(field: BotSlot['field']): BotSlot {
  return BotSlots.find((slot) => slot.field === field) ?? BotSlots[0]
}

/**
 * Record `result` as the newest in `slot` of the question `held`: a reply as a botting that
 * answered, a failure as one that failed. What the cell held before stays in its history.
 */
async function recordResult(db: Writer, quiz: QuizT, held: Doc<'questions'>, slot: BotSlot, result: NonNullable<GuessT | IshesT>): Promise<void> {
  const question = quiz.questions.find((each) => each._id === held._id)
  if (! question) { return }
  const alone = { ...question, guess: null, clueing_ishes: null, hint_ishes: null, [slot.field]: result }
  await insertBottings(db, unrecordedBottings(alone, new Map()))
}

/** Record a reply, or a failure, in one played cell of a question of the open quiz; a question not in it is refused */
async function recordInCell(db: Writer, open: OpenQuizT, question_id: string, field: BotSlot['field'], result: NonNullable<GuessT | IshesT>): Promise<void> {
  await reviseOpenQuiz(db, open, async (rows) => {
    await recordResult(db, quizFrom(rows), questionIn(rows, question_id), slotFor(field), result)
  })
}

/** Record dumdum's guess at a question. Null records nothing: a cell's history is never erased. */
export async function setGuess(db: Writer, open: OpenQuizT, question_id: string, guess: GuessT): Promise<void> {
  if (guess) { await recordInCell(db, open, question_id, 'guess', guess) }
}

/** Record numnum's extraction from one of a question's texts. Null records nothing. */
export async function setIshes(db: Writer, open: OpenQuizT, question_id: string, textkind: Textkind, ishes: IshesT): Promise<void> {
  if (ishes) { await recordInCell(db, open, question_id, textkind === 'clueing' ? 'clueing_ishes' : 'hint_ishes', ishes) }
}

/**
 * Record a failed ask for dumdum's guess. A failure never replaces a value: it rides along on
 * the newest reply as its `last_err`, and is the cell's only content when there never was one.
 */
export async function failGuess(db: Writer, open: OpenQuizT, question_id: string, err: LastErrT): Promise<void> {
  await recordInCell(db, open, question_id, 'guess', askError(err))
}

/** Record a failed ask for numnum's extraction, as `failGuess` does for a guess */
export async function failIshes(db: Writer, open: OpenQuizT, question_id: string, textkind: Textkind, err: LastErrT): Promise<void> {
  await recordInCell(db, open, question_id, textkind === 'clueing' ? 'clueing_ishes' : 'hint_ishes', askError(err))
}

/**
 * Record what one combined run found, text by text: an extraction where it gave one, a failure
 * riding on whatever the cell held where it left a text out. The quiz keeps what the run cost.
 * A landing for a question deleted while the run was out is passed over.
 */
export async function applyBulkIshes(db: Writer, open: OpenQuizT, landings: readonly BulkLandingT[], run: BulkIshesRunT): Promise<void> {
  await reviseOpenQuiz(db, open, async (rows) => {
    const quiz = quizFrom(rows)
    for (const landing of landings) {
      const held = rows.questions.find((row) => row._id === landing.question_id)
      const result = landing.ishes ?? (landing.err ? askError(landing.err) : null)
      if (held && result) { await recordResult(db, quiz, held, slotFor(landing.textkind === 'clueing' ? 'clueing_ishes' : 'hint_ishes'), result) }
    }
    await updateQuiz(db, rows.quiz, { bulk_ishes_last: run })
  })
}

/** Replace the open quiz with `quiz`, whole, as an import merged it: see `writeQuiz` */
export async function replaceOpenQuiz(db: Writer, open: OpenQuizT, quiz: QuizT): Promise<void> {
  await reviseOpenQuiz(db, open, async (rows) => { await writeQuiz(db, rows.quiz.realm_id, quiz, rows) })
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
 * do. A realm holding as many quizzes as a realm may refuses another.
 *
 * @returns The new quiz's row id.
 * @throws A refusal (`realmGone`, `labelTaken`, `quizzesFull`); nothing is written.
 */
export async function newQuiz(db: Writer, open: OpenQuizT, label?: string): Promise<Id<'quizzes'>> {
  const [realm, siblings, expressions] = await Promise.all([db.get('realms', open.realm_id), quizzesOf(db, open.realm_id), expressionsOf(db, open.hunt_id)])
  const fresh = { ...Quiz.blank('', label), ...defaultLayoutFor(expressions.map((row) => expressionFrom(row))) }
  const taken = siblings.some((quiz) => Labelmaker.effectiveLabelOf(quiz) === Labelmaker.effectiveLabelOf(fresh))
  if (realm?.hunt_id !== open.hunt_id) { refuse('realmGone') }
  if (taken) { refuse('labelTaken') }
  if (siblings.length >= PA.QuizzesPerRealm.max) { refuse('quizzesFull') }
  return await writeQuiz(db, open.realm_id, fresh, null)
}

/**
 * Delete a quiz of the open quiz's realm and all it holds. The realm's last quiz cannot go: an
 * empty realm would leave its address leading nowhere, and the author with no way back. A quiz
 * already gone is gone; one of another realm is refused.
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
