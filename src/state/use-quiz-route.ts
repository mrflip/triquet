'use client'

import { useEffect, useEffectEvent, useSyncExternalStore } from 'react'
import * as Labelmaker from '../lib/labelmaker'
import type { WorkspaceAction } from './workspace-reducer'
import type { QuizT } from '../models/quiz'
import type { WorkspaceT } from '../models/workspace'

/** Fired by `writeQuizHash`, since `history.replaceState` says nothing about the change it makes */
const HashWritten = 'triquet:hashwritten'

/** The hash this module last wrote, so a hash lagging behind a rename is not mistaken for a request */
const written = { label: '' }

/** What the address currently asks for: the hash, without its `#` */
function currentHashLabel(): string {
  return location.hash.slice(1)
}

/** Tell `listener` whenever the hash is rewritten by `writeQuizHash` */
function subscribeToHash(listener: () => void): () => void {
  addEventListener(HashWritten, listener)
  return () => { removeEventListener(HashWritten, listener) }
}

/**
 * Put `label` in the address as its hash, without adding a history entry or touching Next.js
 * routing, and tell everything reading the hash that it moved.
 *
 * @param label - The quiz label the address should name.
 *
 * @example writeQuizHash('quiet_otter')
 */
export function writeQuizHash(label: string): void {
  written.label = label
  if (currentHashLabel() === label) { return }
  history.replaceState(null, '', `#${label}`)
  dispatchEvent(new Event(HashWritten))
}

export type QuizRouteHandle = {
  /** The label the address asked for, when no quiz here answers to it; null otherwise */
  missingLabel: string | null
}

/**
 * Keeps the URL hash and the open quiz in step, in both directions, without ever touching
 * Next.js routing: a hash-only change must never re-render the page or add a history entry.
 *
 * Once the workspace has loaded, a hash naming a quiz in it opens that quiz. From then on,
 * whenever the open quiz's own label changes -- by switching quizzes, or by a rename saved
 * through the manage-quiz modal -- the hash is rewritten to match. A hash naming no quiz here is
 * left alone and reported as `missingLabel`, so the page can say so and offer a way forward
 * instead of quietly landing on some other quiz.
 *
 * @param workspace - The workspace as it stands.
 * @param quiz - The open quiz, or null before the workspace has loaded.
 * @param dispatch - How to open the quiz a hash names.
 * @returns The label that names no quiz, if that is what the address asked for.
 */
export function useQuizHashSync(workspace: WorkspaceT, quiz: QuizT | null, dispatch: (action: WorkspaceAction) => void): QuizRouteHandle {
  const hashLabel = useSyncExternalStore(subscribeToHash, currentHashLabel, () => '')
  const loaded = quiz !== null
  const openLabel = quiz === null ? null : Labelmaker.effectiveLabelOf(quiz)
  const hashedQuiz = hashLabel === '' ? undefined : Labelmaker.entityForLabel(workspace.quizzes, hashLabel)
  // A hash we wrote ourselves is never a request: after a rename or a delete it names a label
  // nothing answers to any more, for the one render before it is rewritten.
  const asked = hashLabel !== '' && hashLabel !== written.label
  const missingLabel = loaded && asked && ! hashedQuiz ? hashLabel : null

  // What the address asks for is acted on when the workspace arrives, not each time the open
  // quiz changes: switching quizzes moves the hash, not the other way round.
  const openHashedQuiz = useEffectEvent(() => {
    if (hashedQuiz && hashedQuiz.id !== quiz?.id) { dispatch({ kind: 'open_quiz', quiz_id: hashedQuiz.id }) }
  })
  useEffect(() => {
    if (loaded) { openHashedQuiz() }
  }, [loaded])

  useEffect(() => {
    if (openLabel !== null && missingLabel === null) { writeQuizHash(openLabel) }
  }, [openLabel, missingLabel])

  return { missingLabel }
}
