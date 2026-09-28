'use client'

import { Divider, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import type { Doc } from '../../../convex/_generated/dataModel'
import { Panel } from './Panel'
import { AppNotices } from '../../lib/notices'
import * as Rank from '../../lib/rank'
import type { ReviewedT } from '../../lib/rows'
import type { QuestionT } from '../../models/question'
import { sharedReviewsOf } from '../../models/review'
import { ReviewingFlags } from '../../models/reviewing'
import styles from '../workbench.module.css'

export type ReviewsPanelProps = {
  /** The open quiz's questions, which a review's verdicts are about */
  questions: readonly QuestionT[]
  /** Every ident's review of the open quiz; only the shared ones are shown */
  reviews:   readonly ReviewedT[]
}

/**
 * What reviewers have shared about the open quiz, read-only: one block per reviewer, with their
 * overall note and a table of their verdict on each question they wrote about, in rank order.
 */
export function ReviewsPanel({ reviews, questions }: Readonly<ReviewsPanelProps>) {
  const shared = sharedReviewsOf(reviews)
  const ranked = Rank.inRankOrder(questions)

  return (
    <Panel title="Reviews" blurb="What reviewers have made of this quiz. Nothing appears here until a reviewer chooses to share it." wide={shared.length > 0}>
      {shared.length === 0 ? (
        <p className={styles.microcopy}>{AppNotices.noReviewsShared}</p>
      ) : (
        <Stack spacing={2} divider={<Divider />}>
          {shared.map((review) => (
            <section key={review._id} aria-label={`Review by ${review.reviewer?.title ?? 'a reviewer'}`}>
              <Typography variant="subtitle2">{review.reviewer?.title ?? 'A reviewer'}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{review.overall}</Typography>
              <ReviewingsTable reviewings={review.reviewings} ranked={ranked} />
            </section>
          ))}
        </Stack>
      )}
    </Panel>
  )
}

/** One review's verdicts, a row for each question it says anything about, in the order given */
function ReviewingsTable({ reviewings, ranked }: Readonly<{ reviewings: readonly Doc<'reviewings'>[], ranked: readonly QuestionT[] }>) {
  const reviewingFor = new Map(reviewings.map((reviewing) => [reviewing.question_id as string, reviewing]))
  const rows = ranked.flatMap((question) => {
    const reviewing = reviewingFor.get(question._id)
    return reviewing ? [{ question, reviewing }] : []
  })
  if (rows.length === 0) { return null }

  return (
    <TableContainer sx={{ mt: 1 }}>
      <Table size="small" aria-label="Verdicts by question" sx={{ '& th, & td': { px: 1, verticalAlign: 'top' }, '& th': { whiteSpace: 'nowrap' } }}>
        <TableHead>
          <TableRow>
            <TableCell>Question</TableCell>
            <TableCell align="right">Get rate</TableCell>
            <TableCell align="right">Minutes</TableCell>
            <TableCell>Flags</TableCell>
            <TableCell>Guesses</TableCell>
            <TableCell>Comments</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(({ question, reviewing }) => (
            <TableRow key={reviewing._id}>
              <TableCell>{question.title || AppNotices.untitledQuestion}</TableCell>
              <TableCell align="right">{reviewing.get_rate === null ? '–' : `${String(reviewing.get_rate)}%`}</TableCell>
              <TableCell align="right">{reviewing.minutes ?? '–'}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {ReviewingFlags.filter(({ flag }) => reviewing[flag]).map(({ flag, emoji, title }) => (
                  <span key={flag} role="img" aria-label={title} title={title}>{emoji}</span>
                ))}
              </TableCell>
              <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{reviewing.guesses}</TableCell>
              <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{reviewing.comments}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
