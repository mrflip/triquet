'use client'

import { useMemo } from 'react'
import { QuizRoute } from '../../../../../../../components/QuizRoute'
import { useAddressed } from '../../../../../../../components/use-address'

/**
 * One quiz, named by its org, hunt, realm and label: `/~<org>/<hunt>/quizzes/<realm>/<quiz>`,
 * opened in the mode a last `!edit` or `!playtest` asks for (the page beneath, which is this one).
 */
export default function QuizPage() {
  const { address, mode } = useAddressed('quiz')
  const { org, hunt, realm, quiz } = address
  const labels = useMemo(() => ({ hunt, realm, quiz }), [hunt, realm, quiz])
  return <QuizRoute org={org} labels={labels} mode={mode} />
}
