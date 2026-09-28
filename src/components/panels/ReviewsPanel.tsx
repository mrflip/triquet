'use client'

import { Divider, Stack, Typography } from '@mui/material'
import { Panel } from './Panel'
import { AppNotices } from '../../lib/notices'
import { sharedReviewsOf } from '../../models/review'
import type { ReviewedT } from '../../lib/rows'
import styles from '../workbench.module.css'

export type ReviewsPanelProps = {
  /** Every ident's review of the open quiz; only the shared ones are shown */
  reviews: readonly ReviewedT[]
}

/** What reviewers have shared about the open quiz: one block per reviewer, read-only */
export function ReviewsPanel({ reviews }: Readonly<ReviewsPanelProps>) {
  const shared = sharedReviewsOf(reviews)

  return (
    <Panel title="Reviews" blurb="What reviewers have made of this quiz. Nothing appears here until a reviewer chooses to share it.">
      {shared.length === 0 ? (
        <p className={styles.microcopy}>{AppNotices.noReviewsShared}</p>
      ) : (
        <Stack spacing={2} divider={<Divider />}>
          {shared.map((review) => (
            <div key={review._id}>
              <Typography variant="subtitle2">{review.reviewer?.title ?? 'A reviewer'}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{review.overall}</Typography>
            </div>
          ))}
        </Stack>
      )}
    </Panel>
  )
}
