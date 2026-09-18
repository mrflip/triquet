'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { TabWorkspaceStore, type WorkspaceSnapshot } from './workspace-store'
import { openQuizOf, type WorkspaceAction } from './workspace-reducer'
import type { QuizT } from '../models/quiz'

export type WorkspaceHandle = WorkspaceSnapshot & {
  /** The quiz on screen; null until this browser's quizzes have been read */
  quiz:     QuizT | null
  dispatch: (action: WorkspaceAction) => void
}

/**
 * The workspace, read from this browser and written back the moment anything changes.
 *
 * There is no save button and no debounce: every dispatched action is committed before it
 * reaches the screen. A save from another tab of the same browser replaces what is on screen.
 *
 * @returns The workspace, the open quiz, a dispatcher, and the save status.
 */
export function useWorkspace(): WorkspaceHandle {
  const snapshot = useSyncExternalStore(
    TabWorkspaceStore.subscribe,
    TabWorkspaceStore.snapshot,
    TabWorkspaceStore.serverSnapshot,
  )
  const quiz = snapshot.loaded ? openQuizOf(snapshot.workspace) : null

  useEffect(() => {
    document.title = quiz?.title ? `${quiz.title} — Triquet` : 'Triquet'
  }, [quiz?.title])

  return {
    ...snapshot,
    quiz,
    dispatch: useCallback((action: WorkspaceAction) => { TabWorkspaceStore.dispatch(action) }, []),
  }
}
