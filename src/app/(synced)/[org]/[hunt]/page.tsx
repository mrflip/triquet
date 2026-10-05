'use client'

import { HuntRoute } from '../../../../components/HuntRoute'
import { useAddressed } from '../../../../components/use-address'

/** A hunt, its quizzes, its categories and who is on it: `/~<org>/<hunt>` */
export default function HuntPage() {
  const { address } = useAddressed('hunt')
  return <HuntRoute org={address.org} huntLabel={address.hunt} screen="hunt" />
}
