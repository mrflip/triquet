'use client'

import { useParams } from 'next/navigation'
import { Workbench } from '../../../../components/Workbench'

/** One quiz, named by the address it is at */
export default function QuizPage() {
  const params = useParams<{ label: string }>()
  return <Workbench label={params.label} />
}
