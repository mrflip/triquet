'use client'

import { useMemo, useState } from 'react'
import { useQueries, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { assembledQuiz, type SeenQuestionT } from '../lib/rows'
import type { QuizT } from '../models/quiz'

/** A question's reading as `useQueries` hands it over: the reading, undefined on its way, null when gone, or what the query threw */
type QuestionReading = SeenQuestionT | null | undefined | Error

/** A reading, or the error its query threw, thrown here as `useQuery` would */
function readingOf(reading: QuestionReading): SeenQuestionT | null | undefined {
  if (reading instanceof Error) { throw reading }
  return reading
}

/**
 * The quiz `quiz_id`, whole and live: its frame (`quizzes.open`) and each of its questions
 * (`questions.open`) are queries of their own, so an edit to one question reruns that question's
 * query alone, and only it is sent again.
 *
 * A question the frame orders but whose reading is still on its way (one added a moment ago)
 * does not blank the screen: the quiz as last read whole stays until it arrives, so the grid never
 * shows a quiz half read.
 *
 * @param quiz_id - The quiz; null for none.
 * @returns The quiz; undefined until it is first read whole, null when there is no such quiz.
 */
export function useQuiz(quiz_id: Id<'quizzes'> | null): QuizT | null | undefined {
  const frame = useQuery(api.quizzes.open, quiz_id === null ? 'skip' : { quiz_id })
  // Keyed by the order's contents: a frame redelivered for a change to its widgets keeps its subscriptions.
  const orderKey = frame?.row_ordering.join(' ') ?? ''
  const queries = useMemo(() => Object.fromEntries(orderKey.split(' ').filter(Boolean).map((question_id) => (
    [question_id, { query: api.questions.open, args: { question_id } }]
  ))), [orderKey])
  const readings = useQueries(queries) as Record<string, QuestionReading>
  const assembled = useMemo(() => frame && assembledQuiz(frame, (question_id) => readingOf(readings[question_id])), [frame, readings])

  // The quiz last read whole, kept as React keeps state derived from a render.
  const [held, setHeld] = useState<{ quiz_id: Id<'quizzes'>, quiz: QuizT } | null>(null)
  if (quiz_id !== null && assembled && held?.quiz !== assembled) { setHeld({ quiz_id, quiz: assembled }) }

  if (! frame) { return frame }
  const heldHere = held !== null && held.quiz_id === quiz_id
  return assembled ?? (heldHere ? held.quiz : undefined)
}
