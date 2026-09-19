import * as Z from 'zod'
import { Validator } from '../lib/validator'
import { QuizValidators } from './quiz'
import type { WorkspaceT } from './workspace'

export const WorkspaceChangeValidators = Validator(({ obj, arr, ulid }) => {
  const workspaceChange = obj({
    active_quiz_id:   ulid
      .describe('Which quiz is on screen once the change has landed.'),
    quizzes:          arr(QuizValidators.quiz).default([])
      .describe('Every quiz that is new or revised, whole. A quiz is saved as it stands, questions and all: anything it no longer holds is gone.'),
    deleted_quiz_ids: arr(ulid).default([])
      .describe('Quizzes the author deleted.'),
  })
    .describe('What one save sends to the database: only the quizzes that changed, but each of those in full.')

  return { workspaceChange }
})

export type WorkspaceChangeDNA = Z.input<typeof WorkspaceChangeValidators.workspaceChange>
export type WorkspaceChangeT   = Z.output<typeof WorkspaceChangeValidators.workspaceChange>

/**
 * What must be saved to turn `before` into `after`.
 *
 * A quiz counts as changed when it is not the very same object it was, which is what the
 * reducer guarantees for any quiz an action did not touch.
 *
 * @param before - The workspace as last saved.
 * @param after - The workspace as it now stands.
 * @returns The quizzes to save and the quizzes to delete.
 *
 * @example changeBetween(workspace, workspace).quizzes  // => []
 */
export function changeBetween(before: WorkspaceT, after: WorkspaceT): WorkspaceChangeT {
  const beforeById = new Map(before.quizzes.map((quiz) => [quiz.id, quiz]))
  const afterIds   = new Set(after.quizzes.map((quiz) => quiz.id))
  return {
    active_quiz_id:   after.active_quiz_id,
    quizzes:          after.quizzes.filter((quiz) => beforeById.get(quiz.id) !== quiz),
    deleted_quiz_ids: before.quizzes.filter((quiz) => ! afterIds.has(quiz.id)).map((quiz) => quiz.id),
  }
}
