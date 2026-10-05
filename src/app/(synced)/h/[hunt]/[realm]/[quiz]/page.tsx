'use client'

import { Suspense, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { QuizRoute } from '../../../../../../components/QuizRoute'
import * as Routes from '../../../../../../lib/routes'

/**
 * An old address of a quiz, `/h/<hunt>/<realm>/<quiz>?act=smith`, kept for the links and bookmarks
 * that hold it: it moves to the quiz's own once the hunt says its org, opened in the mode its
 * `act` now is (`Routes.modeFromAct`).
 */
export default function OldQuizPage() {
  return <Suspense><OldQuizAddress /></Suspense>
}

/** The old address, read: which quiz, and the mode its act asked for */
function OldQuizAddress() {
  const params = useParams<{ hunt: string, realm: string, quiz: string }>()
  const mode = Routes.modeFromAct(useSearchParams().get('act'))
  const labels = useMemo(() => ({ hunt: params.hunt, realm: params.realm, quiz: params.quiz }), [params.hunt, params.realm, params.quiz])
  return <QuizRoute org={null} labels={labels} mode={mode} />
}
