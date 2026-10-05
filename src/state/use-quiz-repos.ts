'use client'

import { useEffect, useState } from 'react'
import type { RepoSummary } from '../lib/quizgit'
import * as QuizMirror from './quiz-mirror'

/**
 * Every quiz history repository this browser holds, deleted quizzes' included, read once as the
 * view mounts. Not live: the mirror is a record kept beside the database, not something to watch.
 *
 * @returns The repositories, newest work first; null until they have been read.
 */
export function useQuizRepos(): readonly RepoSummary[] | null {
  const [repos, setRepos] = useState<RepoSummary[] | null>(null)

  useEffect(() => {
    let current = true
    const load = async () => {
      const found = await QuizMirror.listQuizRepos()
      if (current) { setRepos(found) }
    }
    void load()
    return () => { current = false }
  }, [])

  return repos
}
