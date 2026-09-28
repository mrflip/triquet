'use client'

import type { Id } from '../../convex/_generated/dataModel'
import type { QuizT } from '../models/quiz'
import { useQuiz } from './use-quiz'

/**
 * A quiz of the hunt other than the open one, whole and live, for a view that shows another
 * quiz's questions (the expression preview). The open quiz is already on screen: pass null for it,
 * and nothing more is read.
 *
 * @param quiz_id - The quiz; null for none.
 * @returns The quiz; null while it is on its way, when there is no such quiz, or for none.
 */
export function useOtherQuiz(quiz_id: Id<'quizzes'> | null): QuizT | null {
  return useQuiz(quiz_id) ?? null
}
