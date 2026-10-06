'use client'

import { useParams } from 'next/navigation'
import { CategoriesRoute } from '../../../../../components/CategoriesRoute'

/** An old address of a hunt's categories, `/c/<hunt>/categories`, kept for the links and bookmarks that hold it: it moves to the categories' own once the hunt says its org */
export default function OldCategoriesPage() {
  const params = useParams<{ hunt: string }>()
  return <CategoriesRoute org={null} huntLabel={params.hunt} />
}
