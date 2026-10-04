'use client'

import type { Id } from '../../convex/_generated/dataModel'
import type { ShallowHuntT } from '../lib/rows'
import type { QuizT } from '../models/quiz'
import { useAffirms } from './use-affirms'
import { useQuiz } from './use-quiz'

/**
 * A quiz of `hunt` other than the open one, whole and live, for a view that shows another quiz's
 * questions (the expression preview). The open quiz is already on screen: pass null for it, and
 * nothing more is read.
 *
 * @param hunt - The hunt the quiz is of, as its screen holds it.
 * @param quiz_id - The quiz; null for none.
 * @returns The quiz; null while it is on its way, when there is no such quiz, or for none.
 */
export function useOtherQuiz(hunt: Pick<ShallowHuntT, '_id' | 'role'>, quiz_id: Id<'quizzes'> | null): QuizT | null {
  const { huntAffirms } = useAffirms(hunt, null)
  return useQuiz(huntAffirms, quiz_id) ?? null
}
