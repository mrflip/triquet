'use client'

import { useEffect, useMemo } from 'react'
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { useDraft } from './use-draft'
import { AnswerLock } from './cells/answer-lock'
import { ButnotPreview } from './cells/chain'
import { AppNotices } from '../lib/notices'
import * as Rank from '../lib/rank'
import type { ReviewRow } from '../db/schema'
import type { IdentT } from '../models/ident'
import type { QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'
import { reviewRowFor } from '../state/quiz-rows'
import type { HuntAction } from '../state/actions'
import styles from './workbench.module.css'

export type ReviewScreenProps = {
  quiz:       QuizT
  ident:      IdentT
  /** Every ident's review of this quiz */
  reviews:    readonly ReviewRow[]
  dispatch:   (action: HuntAction) => void
  unsaved:    boolean
  saveNotice: string | null
}

/** Tall enough to preview a BUT NOT without the review screen's roomier rows scrolling it */
const ButnotHeightPx = 240

/**
 * What a reviewer sees: the quiz's questions, read-only, each with its chained BUT NOT and its
 * answer behind a lock; then an overall note, and a button to share it with the smiths.
 *
 * A review of this quiz for this ident is opened the moment this screen is, so a reviewer who
 * never writes anything still has a row waiting once they type into the overall note.
 */
export function ReviewScreen({ quiz, ident, reviews, dispatch, unsaved, saveNotice }: Readonly<ReviewScreenProps>) {
  useEffect(() => {
    dispatch({ kind: 'open_review', quiz_id: quiz.id })
  }, [dispatch, quiz.id, ident.id])

  const own = reviewRowFor(reviews, ident.id) ?? null
  const questions = useMemo(() => Rank.inRankOrder(quiz.questions), [quiz.questions])
  const { draft, onChange, onBlur } = useDraft(own?.overall ?? '', (overall) => {
    dispatch({ kind: 'set_overall', quiz_id: quiz.id, overall })
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
              key={question.id}
              question={question}
              chainTarget={questions.find((other) => other.id === question.chains_to) ?? null}
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
            onClick={() => { dispatch({ kind: 'set_review_phase', quiz_id: quiz.id, phase: 'shared' }) }}
          >
            Share with the smiths
          </Button>
          <Button
            disabled={phase !== 'shared'}
            onClick={() => { dispatch({ kind: 'set_review_phase', quiz_id: quiz.id, phase: 'draft' }) }}
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
  question:    QuestionT
  /** The question this one chains to, whose hint is the BUT NOT shown alongside it */
  chainTarget: QuestionT | null
}

/** One question, read-only: its Q#, its clueing, the BUT NOT it chains to, and its locked answer */
function ReviewQuestionRow({ question, chainTarget }: Readonly<ReviewQuestionRowProps>) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">Q{question.qnum || '–'}</Typography>
        <Typography variant="subtitle1">{question.title || AppNotices.untitledQuestion}</Typography>
      </Stack>
      <Typography sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>{question.clueing}</Typography>
      <Box sx={{ mb: 1 }}>
        <ButnotPreview target={chainTarget} chained={question.chains_to !== null} heightPx={ButnotHeightPx} />
      </Box>
      <AnswerLock answer={question.full_answer} />
    </Paper>
  )
}
