import type { QuizT } from '../models/quiz'
import type { WorkspaceT } from '../models/workspace'

/**
 * `workspace` with its open quiz put through `revise`, unless that quiz is locked.
 *
 * @param workspace - The workspace as it stands.
 * @param revise - How to rewrite the open quiz.
 * @returns The workspace afterwards; the same object when the quiz is locked or absent.
 */
export function reviseOpenQuiz(workspace: WorkspaceT, revise: (quiz: QuizT) => QuizT): WorkspaceT {
  const openQuiz = workspace.quizzes.find((quiz) => quiz.id === workspace.active_quiz_id)
  if (! openQuiz || openQuiz.locked) { return workspace }
  const revised = revise(openQuiz)
  if (revised === openQuiz) { return workspace }
  return {
    ...workspace,
    quizzes: workspace.quizzes.map((quiz) => (quiz.id === openQuiz.id ? revised : quiz)),
  }
}

/** The open quiz, or null when the workspace names one it does not hold */
export function openQuizOf(workspace: WorkspaceT): QuizT | null {
  return workspace.quizzes.find((quiz) => quiz.id === workspace.active_quiz_id) ?? null
}
