'use client'

import { Divider, Stack, Typography } from '@mui/material'
import { Panel } from './Panel'
import { AppNotices } from '../../lib/notices'
import { sharedReviewsOf } from '../../models/review'
import { useIdents } from '../../state/use-ident'
import type { ReviewRow } from '../../db/schema'
import styles from '../workbench.module.css'

export type ReviewsPanelProps = {
  /** Every ident's review of the open quiz; filtered to the shared ones here, client-side, until PR 6 */
  reviews: readonly ReviewRow[]
}

/** What reviewers have shared about the open quiz: one block per reviewer, read-only */
export function ReviewsPanel({ reviews }: Readonly<ReviewsPanelProps>) {
  const idents = useIdents()
  const shared = sharedReviewsOf(reviews)
  const titleFor = (ident_id: string) => idents?.find((ident) => ident.id === ident_id)?.title ?? 'A reviewer'

  return (
    <Panel title="Reviews" blurb="What reviewers have made of this quiz. Nothing appears here until a reviewer chooses to share it.">
      {shared.length === 0 ? (
        <p className={styles.microcopy}>{AppNotices.noReviewsShared}</p>
      ) : (
        <Stack spacing={2} divider={<Divider />}>
          {shared.map((review) => (
            <div key={review.id}>
              <Typography variant="subtitle2">{titleFor(review.ident_id)}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{review.overall}</Typography>
            </div>
          ))}
        </Stack>
      )}
    </Panel>
  )
}
