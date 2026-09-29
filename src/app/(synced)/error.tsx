'use client'

import { PageFailed, type PageFailedProps } from '../../components/PageFailed'

/** A hunt or quiz page that failed to draw: says so, says why, and offers to try again */
export default function SyncedError(props: Readonly<PageFailedProps>) {
  return <PageFailed {...props} />
}
