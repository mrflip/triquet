'use client'

import { CategoriesRoute } from '../../../../../components/CategoriesRoute'
import { useAddressed } from '../../../../../components/use-address'

/** A hunt's subject categories, arranged round its wheel: `/~<org>/<hunt>/categories` */
export default function CategoriesPage() {
  const { address } = useAddressed('categories')
  return <CategoriesRoute org={address.org} huntLabel={address.hunt} />
}
