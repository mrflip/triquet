'use client'

import { OpenQuizRedirect } from '../../../components/OpenQuizRedirect'

/** `/my/quiz` names no quiz, so it sends the author on to the one they were last using */
export default function QuizIndexPage() {
  return <OpenQuizRedirect />
}
