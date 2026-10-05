'use client'

import { useParams } from 'next/navigation'
import { CategoriesRoute } from '../../../../../components/CategoriesRoute'

/** A hunt's subject categories, arranged round its wheel */
export default function CategoriesPage() {
  const params = useParams<{ hunt: string }>()
  return <CategoriesRoute huntLabel={params.hunt} />
}
