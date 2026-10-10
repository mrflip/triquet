'use client'

import { useMemo, useState } from 'react'
import { useQueries, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { assembledQuiz, type SeenQuestionT } from '../lib/rows'
import type { HuntAffirmsDNA } from '../models/actions'
import type { QuizT } from '../models/quiz'
import { useSession } from './use-session'

/** A question's reading as `useQueries` hands it over: the reading, undefined on its way, null when gone, or what the query threw */
type QuestionReading = SeenQuestionT | null | undefined | Error

/** A reading, or the error its query threw, thrown here as `useQuery` would */
function readingOf(reading: QuestionReading): SeenQuestionT | null | undefined {
  if (reading instanceof Error) { throw reading }
  return reading
}

/**
 * The quiz `quiz_id`, live, as this browser's ident may read it: its frame (`quizzes.open`) and
 * each of its questions (`questions.open`) are queries of their own, so an edit to one question
 * reruns that question's query alone, and only it is sent again. Each is sent what the browser
 * affirms of itself on the quiz's hunt. A smith is sent each question whole; a reviewer what a
 * review needs, and a field they are not sent reads as blank (`quizFromSeen`).
 *
 * A question the frame orders but whose reading is still on its way (one added a moment ago)
 * does not blank the screen: the quiz as last read whole stays until it arrives, so the grid never
 * shows a quiz half read. What has not changed since the quiz was last read whole is handed back
 * the very same (`quizFromSeen`): a change to one question makes that question new, and the quiz
 * around it, and nothing else.
 *
 * @param affirms - What this browser affirms of itself on the quiz's hunt (`useAffirms`); null until known.
 * @param quiz_id - The quiz; null for none.
 * @returns The quiz; undefined until it is first read whole, null when there is no such quiz or it is not this ident's to read.
 */
export function useQuiz(affirms: HuntAffirmsDNA | null, quiz_id: Id<'quizzes'> | null): QuizT | null | undefined {
  const { ready } = useSession()
  const frame = useQuery(api.quizzes.open, quiz_id === null || affirms === null || ! ready ? 'skip' : { affirms: { ...affirms, quiz_id } })
  // Keyed by the order's contents: a frame redelivered for a change to its widgetings keeps its subscriptions.
  const orderKey = frame?.row_ordering.join(' ') ?? ''
  const queries = useMemo(() => (ready && affirms !== null ? Object.fromEntries(orderKey.split(' ').filter(Boolean).map((question_id) => (
    [question_id, { query: api.questions.open, args: { question_id, affirms } }]
  ))) : {}), [orderKey, ready, affirms])
  const readings = useQueries(queries) as Record<string, QuestionReading>

  // The quiz last read whole, kept as React keeps state derived from a render: what a question
  // still on its way leaves on screen, and what the next assembly hands back unchanged parts of.
  const [held, setHeld] = useState<{ quiz_id: Id<'quizzes'>, quiz: QuizT } | null>(null)
  const was = held !== null && held.quiz_id === quiz_id ? held.quiz : null
  const assembled = useMemo(() => frame && assembledQuiz(frame, (question_id) => readingOf(readings[question_id]), was), [frame, readings, was])
  if (quiz_id !== null && assembled && was !== assembled) { setHeld({ quiz_id, quiz: assembled }) }

  if (! frame) { return frame }
  return assembled ?? was ?? undefined
}
