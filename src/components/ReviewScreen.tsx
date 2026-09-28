'use client'

import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Paper, Stack, TextField, ToggleButton, Typography } from '@mui/material'
import type { Doc } from '../../convex/_generated/dataModel'
import { useDraft } from './use-draft'
import { useSettledResize } from './use-settled-resize'
import { RowCapPx, RowFloorPx } from './QuestionRow'
import { AnswerLock } from './cells/answer-lock'
import { ButnotPreview } from './cells/chain'
import { GrowingField, NumberField, StretchField } from './cells/fields'
import { AppNotices } from '../lib/notices'
import * as Rank from '../lib/rank'
import { reviewBy, type ReviewedT } from '../lib/rows'
import type { IdentT } from '../models/ident'
import type { QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'
import { ReviewingFlags, type ReviewingPatch } from '../models/reviewing'
import type { HuntActionDNA } from '../models/actions'
import styles from './workbench.module.css'

export type ReviewScreenProps = {
  quiz:       QuizT
  ident:      IdentT
  /** Every ident's review of this quiz */
  reviews:    readonly ReviewedT[]
  dispatch:   (action: HuntActionDNA) => void
  unsaved:    boolean
  saveNotice: string | null
}

/** Tall enough to preview a BUT NOT without the review screen's roomier rows scrolling it */
const ButnotHeightPx = 240

/**
 * What a reviewer sees: the quiz's questions, read-only, each with its chained BUT NOT, its
 * answer behind a lock, and the reviewer's verdict on it; then an overall note, and a button to
 * share it all with the smiths.
 *
 * A review of this quiz for this ident is opened the moment this screen is, so a reviewer who
 * never writes anything still has a row waiting once they type into the overall note.
 */
export function ReviewScreen({ quiz, ident, reviews, dispatch, unsaved, saveNotice }: Readonly<ReviewScreenProps>) {
  useEffect(() => {
    dispatch({ kind: 'open_review', quiz_id: quiz._id })
  }, [dispatch, quiz._id, ident._id])

  const own = reviewBy(reviews, ident._id)
  const questions = useMemo(() => Rank.inRankOrder(quiz.questions), [quiz.questions])
  const reviewingFor = useMemo(() => new Map((own?.reviewings ?? []).map((reviewing) => [reviewing.question_id as string, reviewing])), [own])
  const resizeToken = useSettledResize()
  const { draft, onChange, onBlur } = useDraft(own?.overall ?? '', (overall) => {
    dispatch({ kind: 'set_overall', quiz_id: quiz._id, overall })
  })
  const phase = own?.phase ?? 'empty'

  return (
    <main className={styles.page} data-unsaved={unsaved}>
      <Box sx={{ maxWidth: 760, mx: 'auto' }}>
        <Typography variant="h4" component="h1" gutterBottom>{quiz.title || AppNotices.untitledQuiz}</Typography>
        {saveNotice && <p className={styles.microcopy} role="status">{saveNotice}</p>}
        <Stack spacing={2} sx={{ my: 3 }}>
          {questions.map((question) => (
            <ReviewQuestionRow
              key={question._id}
              quiz_id={quiz._id}
              question={question}
              chainTarget={questions.find((other) => other._id === question.chains_to) ?? null}
              reviewing={reviewingFor.get(question._id) ?? null}
              dispatch={dispatch}
              resizeToken={resizeToken}
            />
          ))}
        </Stack>
        <TextField
          label="Overall"
          multiline
          minRows={4}
          fullWidth
          value={draft}
          onChange={(event) => { onChange(event.target.value) }}
          onBlur={onBlur}
          sx={{ mb: 2 }}
        />
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Button
            variant="contained"
            disabled={phase === 'shared'}
            onClick={() => { dispatch({ kind: 'set_review_phase', quiz_id: quiz._id, phase: 'shared' }) }}
          >
            Share with the smiths
          </Button>
          <Button
            disabled={phase !== 'shared'}
            onClick={() => { dispatch({ kind: 'set_review_phase', quiz_id: quiz._id, phase: 'draft' }) }}
          >
            Withdraw
          </Button>
          <span className={styles.microcopy}>{phase === 'shared' ? AppNotices.reviewShared : AppNotices.reviewNotShared}</span>
        </Stack>
      </Box>
    </main>
  )
}

type ReviewQuestionRowProps = {
  quiz_id:     string
  question:    QuestionT
  /** The question this one chains to, whose hint is the BUT NOT shown alongside it */
  chainTarget: QuestionT | null
  /** The reviewer's verdict on this question so far; null until they first write to it */
  reviewing:   Doc<'reviewings'> | null
  dispatch:    (action: HuntActionDNA) => void
  /** Re-measure when this changes: the window finished resizing */
  resizeToken: number
}

/**
 * One question: its Q#, its clueing, the BUT NOT it chains to and its locked answer, read-only;
 * then the reviewer's verdict on it, each field saved as it is committed.
 *
 * The Comments box grows with its content and sets the height of the verdict's boxes, floored
 * and capped as the grid's rows are; Guesses is stretched to that height but has no say in it.
 */
function ReviewQuestionRow({ quiz_id, question, chainTarget, reviewing, dispatch, resizeToken }: Readonly<ReviewQuestionRowProps>) {
  const [commentsNaturalPx, setCommentsNaturalPx] = useState(RowFloorPx)
  const heightPx = Math.min(Math.max(commentsNaturalPx, RowFloorPx), RowCapPx)
  const commit = (patch: ReviewingPatch) => { dispatch({ kind: 'set_reviewing', quiz_id, question_id: question._id, patch }) }
  const peek = () => { dispatch({ kind: 'peek_answer', quiz_id, question_id: question._id }) }

  return (
    <Paper variant="outlined" component="section" aria-label={question.title || AppNotices.untitledQuestion} sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">Q{question.qnum || '–'}</Typography>
        <Typography variant="subtitle1">{question.title || AppNotices.untitledQuestion}</Typography>
      </Stack>
      <Typography sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>{question.clueing}</Typography>
      <Box sx={{ mb: 1 }}>
        <ButnotPreview target={chainTarget} chained={question.chains_to !== null} heightPx={ButnotHeightPx} />
      </Box>
      <AnswerLock answer={question.full_answer} onReveal={reviewing?.peeked ? undefined : peek} />
      <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'flex-start', mt: 1 }}>
        <VerdictBox caption="Get rate %" basis="0 0 5em">
          <NumberField label="Get rate" committed={reviewing?.get_rate ?? null} fractional={false} max={100} locked={false} onCommit={(get_rate) => { commit({ get_rate }) }} />
        </VerdictBox>
        <VerdictBox caption="Guesses" basis="1 1 10em">
          <StretchField label="Guesses" committed={reviewing?.guesses ?? ''} locked={false} onCommit={(guesses) => { commit({ guesses }) }} heightPx={heightPx} />
        </VerdictBox>
        <VerdictBox caption="Comments" basis="2 1 14em">
          <GrowingField label="Comments" committed={reviewing?.comments ?? ''} locked={false} onCommit={(comments) => { commit({ comments }) }} heightPx={heightPx} onNatural={setCommentsNaturalPx} resizeToken={resizeToken} />
        </VerdictBox>
        <VerdictBox caption="Minutes" basis="0 0 5em">
          <NumberField label="Minutes" committed={reviewing?.minutes ?? null} fractional locked={false} onCommit={(minutes) => { commit({ minutes }) }} />
        </VerdictBox>
        <Stack direction="row" spacing={0.5} sx={{ alignSelf: 'flex-end' }}>
          {ReviewingFlags.map(({ flag, emoji, title }) => {
            const raised = reviewing?.[flag] ?? false
            return (
              <ToggleButton key={flag} value={flag} size="small" selected={raised} aria-label={title} title={title} onChange={() => { commit({ [flag]: ! raised }) }}>
                {emoji}
              </ToggleButton>
            )
          })}
        </Stack>
      </Stack>
    </Paper>
  )
}

/** One field of a verdict, captioned, framed so it reads as a box to type in */
function VerdictBox({ caption, basis, children }: Readonly<{ caption: string, basis: string, children: React.ReactNode }>) {
  return (
    <Box sx={{ flex: basis }}>
      <Typography variant="caption" color="text.secondary" component="div">{caption}</Typography>
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>{children}</Box>
    </Box>
  )
}
