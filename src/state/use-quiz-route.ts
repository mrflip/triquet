'use client'

import { useEffect, useRef } from 'react'
import { effectiveLabelOf, entityForLabel } from '../lib/label-maker'
import type { WorkspaceAction } from './workspace-reducer'
import type { QuizT } from '../models/quiz'
import type { WorkspaceT } from '../models/workspace'

/**
 * Keeps the URL hash and the open quiz in step, in both directions, without ever touching
 * Next.js routing: a hash-only change must never re-render the page or add a history entry.
 *
 * On first load, a hash naming a quiz in the workspace opens it. From then on, whenever the
 * open quiz's own label changes -- by switching quizzes, or by a rename saved through the
 * manage-quiz modal -- the hash is rewritten to match, atomically with the state that drives it.
 * A hash naming no quiz here is left to be overwritten by that same correction rather than
 * treated as an error.
 *
 * @param workspace - The workspace as it stands.
 * @param quiz - The open quiz, or null before the workspace has loaded.
 * @param dispatch - How to open the quiz a starting hash names.
 */
export function useQuizHashSync(workspace: WorkspaceT, quiz: QuizT | null, dispatch: (action: WorkspaceAction) => void): void {
  const openedFromHash = useRef(false)

  useEffect(() => {
    if (quiz === null || openedFromHash.current) { return }
    const hashLabel = location.hash.slice(1)
    const target = hashLabel === '' ? undefined : entityForLabel(workspace.quizzes, hashLabel)
    if (target && target.id !== quiz.id) { dispatch({ kind: 'open_quiz', quiz_id: target.id }) }
    openedFromHash.current = true
  }, [workspace, quiz, dispatch])

  useEffect(() => {
    if (quiz === null) { return }
    const label = effectiveLabelOf(quiz)
    if (location.hash.slice(1) !== label) { history.replaceState(null, '', `#${label}`) }
  }, [quiz])
}
