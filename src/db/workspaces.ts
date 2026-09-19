import _ from 'es-toolkit/compat'
import { and, asc, eq, inArray, max, ne, notInArray } from 'drizzle-orm'
import { mintId } from '../lib/ids'
import { answerings, questions, quizzes, workspaces } from './schema'
import { latestBySlot, resultsFor, slotkeyOf, unrecordedAnswerings } from '../models/answering'
import { Workspace, type WorkspaceT } from '../models/workspace'
import type { AnsweringRow, QuestionRow, QuizRow } from './schema'
import type { Db } from './client'
import type { QuestionDNA, QuestionT } from '../models/question'
import type { QuizDNA, QuizT } from '../models/quiz'
import type { WorkspaceChangeT } from '../models/workspace-change'

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * A new workspace holding one blank quiz, saved.
 *
 * @param db - Where to keep it.
 * @param created_at - When it was made.
 * @returns Its id, and the workspace itself.
 *
 * @example const { workspace_id, workspace } = await createWorkspace(db)
 */
export async function createWorkspace(db: Db, created_at: number = Date.now()): Promise<{ workspace_id: string, workspace: WorkspaceT }> {
  const workspace_id = mintId()
  const workspace = Workspace.blank()
  await db.insert(workspaces).values({ id: workspace_id, active_quiz_id: workspace.active_quiz_id, created_at })
  await saveChange(db, workspace_id, { active_quiz_id: workspace.active_quiz_id, quizzes: workspace.quizzes, deleted_quiz_ids: [] })
  return { workspace_id, workspace }
}

/**
 * The workspace as saved, each question showing the newest answer from each of its players.
 *
 * @param db - Where it is kept.
 * @param workspace_id - Which workspace.
 * @returns The workspace, or null when there is no such workspace or it holds no quizzes.
 */
export async function loadWorkspace(db: Db, workspace_id: string): Promise<WorkspaceT | null> {
  const found = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspace_id),
    with:  {
      quizzes: {
        orderBy: asc(quizzes.id),
        with:    { questions: { orderBy: asc(questions.position), with: { answerings: true } } },
      },
    },
  })
  if (! found || found.quizzes.length === 0) { return null }
  const latest = latestBySlot(found.quizzes.flatMap((quiz) => quiz.questions.flatMap((question) => question.answerings)))
  return Workspace.revive({
    active_quiz_id: found.active_quiz_id ?? '',
    quizzes:        found.quizzes.map((quiz) => quizDnaFrom(quiz, latest)),
  })
}

/**
 * Save `change` into a workspace, all or nothing.
 *
 * Each quiz is saved whole: its questions in the order given, anything it no longer holds
 * removed, and any answer newer than what was recorded added to the question's history.
 *
 * @param db - Where the workspace is kept.
 * @param workspace_id - Which workspace.
 * @param change - What changed, validated.
 * @throws When the change touches a quiz or question another workspace holds; nothing is saved.
 */
export async function saveChange(db: Db, workspace_id: string, change: WorkspaceChangeT): Promise<void> {
  await db.transaction(async (tx) => {
    await refuseForeign(tx, workspace_id, change.quizzes)
    if (change.deleted_quiz_ids.length > 0) {
      await tx.delete(quizzes).where(and(eq(quizzes.workspace_id, workspace_id), inArray(quizzes.id, change.deleted_quiz_ids)))
    }
    for (const quiz of change.quizzes) { await saveQuiz(tx, workspace_id, quiz) }
    await tx.update(workspaces).set({ active_quiz_id: change.active_quiz_id }).where(eq(workspaces.id, workspace_id))
  })
}

/** Throws when any quiz or question being saved already belongs to some other workspace */
async function refuseForeign(tx: Tx, workspace_id: string, incoming: readonly QuizT[]): Promise<void> {
  const quizIds     = incoming.map((quiz) => quiz.id)
  const questionIds = incoming.flatMap((quiz) => quiz.questions.map((question) => question.id))
  const foreignQuiz = await tx.select({ id: quizzes.id }).from(quizzes)
    .where(and(inArray(quizzes.id, quizIds), ne(quizzes.workspace_id, workspace_id))).limit(1)
  const foreignQuestion = await tx.select({ id: questions.id }).from(questions)
    .innerJoin(quizzes, eq(questions.quiz_id, quizzes.id))
    .where(and(inArray(questions.id, questionIds), ne(quizzes.workspace_id, workspace_id))).limit(1)
  if (foreignQuiz.length > 0 || foreignQuestion.length > 0) {
    throw new Error('This change names a quiz or question held by another workspace')
  }
}

/** One quiz, whole: its own fields, its questions in order, and any new answers */
async function saveQuiz(tx: Tx, workspace_id: string, quiz: QuizT): Promise<void> {
  const { questions: held, ...quizFields } = quiz
  const heldIds = held.map((question) => question.id)
  await tx.insert(quizzes).values({ ...quizFields, workspace_id })
    .onConflictDoUpdate({ target: quizzes.id, set: quizFields })
  await tx.delete(questions).where(and(eq(questions.quiz_id, quiz.id), notInArray(questions.id, heldIds)))
  for (const [ii, question] of held.entries()) {
    const fields = { ...questionFieldsOf(question), quiz_id: quiz.id, position: ii }
    await tx.insert(questions).values(fields).onConflictDoUpdate({ target: questions.id, set: fields })
  }
  await recordAnswerings(tx, held)
}

/** Every answer `held` shows that is newer than the newest one recorded for its cell */
async function recordAnswerings(tx: Tx, held: readonly QuestionT[]): Promise<void> {
  if (held.length === 0) { return }
  const heldIds = held.map((question) => question.id)
  const recorded = await tx
    .select({
      question_id:  answerings.question_id,
      player_label: answerings.player_label,
      textkind:     answerings.textkind,
      created_at:   max(answerings.created_at),
    })
    .from(answerings)
    .where(inArray(answerings.question_id, heldIds))
    .groupBy(answerings.question_id, answerings.player_label, answerings.textkind)
  const recordedAt = new Map(recorded.map((row) => [slotkeyOf(row), row.created_at ?? 0]))
  const fresh = held.flatMap((question) => unrecordedAnswerings(question, recordedAt))
  if (fresh.length > 0) { await tx.insert(answerings).values(fresh) }
}

/** A question's own fields, without the answers it shows */
function questionFieldsOf(question: QuestionT) {
  return _.omit(question, ['guess', 'clueing_ishes', 'hint_ishes'])
}

type QuizTree = QuizRow & { questions: (QuestionRow & { answerings: AnsweringRow[] })[] }

/** A quiz as loaded, back in the shape the app works with */
function quizDnaFrom(quiz: QuizTree, latest: ReturnType<typeof latestBySlot>): QuizDNA {
  return { ..._.omit(quiz, ['workspace_id', 'questions']), questions: quiz.questions.map((row) => questionDnaFrom(row, latest)) }
}

/** A question as loaded, showing the newest answer in each of its cells */
function questionDnaFrom(row: QuestionRow & { answerings: AnsweringRow[] }, latest: ReturnType<typeof latestBySlot>): QuestionDNA {
  return { ..._.omit(row, ['quiz_id', 'position', 'answerings']), ...resultsFor(row, latest) }
}
