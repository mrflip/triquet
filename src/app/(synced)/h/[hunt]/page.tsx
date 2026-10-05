'use client'

import { useParams } from 'next/navigation'
import { HuntRoute } from '../../../../components/HuntRoute'

/** A hunt: its quizzes, its categories and who is on it */
export default function HuntPage() {
  const params = useParams<{ hunt: string }>()
  return <HuntRoute huntLabel={params.hunt} />
}
