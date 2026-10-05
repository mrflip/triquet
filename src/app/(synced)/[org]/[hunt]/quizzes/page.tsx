'use client'

import { HuntRoute } from '../../../../../components/HuntRoute'
import { useAddressed } from '../../../../../components/use-address'

/** Every quiz of a hunt: `/~<org>/<hunt>/quizzes` */
export default function QuizzesPage() {
  const { address } = useAddressed('quizzes')
  return <HuntRoute org={address.org} huntLabel={address.hunt} screen="quizzes" />
}
