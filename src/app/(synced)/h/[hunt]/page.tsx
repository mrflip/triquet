'use client'

import { useParams } from 'next/navigation'
import { HuntRoute } from '../../../../components/HuntRoute'

/** An old address of a hunt, `/h/<hunt>`, kept for the links and bookmarks that hold it: it moves to the hunt's own once the hunt says its org */
export default function OldHuntPage() {
  const params = useParams<{ hunt: string }>()
  return <HuntRoute org={null} huntLabel={params.hunt} screen="hunt" />
}
