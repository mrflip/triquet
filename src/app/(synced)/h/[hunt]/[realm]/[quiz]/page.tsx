'use client'

import { Suspense, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { QuizRoute } from '../../../../../../components/QuizRoute'
import * as Routes from '../../../../../../lib/routes'

/** One quiz, named by hunt, realm and quiz, presented as `?act=` asks */
export default function QuizPage() {
  return <Suspense><QuizAddress /></Suspense>
}

/** The address, read: which quiz, and how to present it */
function QuizAddress() {
  const params = useParams<{ hunt: string, realm: string, quiz: string }>()
  const act = Routes.actFrom(useSearchParams().get('act'))
  const labels = useMemo(() => ({ hunt: params.hunt, realm: params.realm, quiz: params.quiz }), [params.hunt, params.realm, params.quiz])
  return <QuizRoute labels={labels} act={act} />
}
