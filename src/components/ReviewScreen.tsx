'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { Box, Button, Paper, Stack, TextField, ToggleButton, Typography, useMediaQuery } from '@mui/material'
import type { Doc } from '../../convex/_generated/dataModel'
import { useDraft } from './use-draft'
import { FoldButton } from './FoldButton'
import { AnswerLock } from './cells/answer-lock'
import { ButnotFull } from './cells/chain'
import { NumberField } from './cells/fields'
import { MarkdownFace, MarkdownText, veiledIf } from './cells/markdown'
import { ReviewsPanel } from './panels/ReviewsPanel'
import { AppNotices } from '../lib/notices'
import * as Rank from '../lib/rank'
import { reviewBy, type ReviewedT } from '../lib/rows'
import type { IdentT } from '../models/ident'
import { Question, type QuestionT } from '../models/question'
import type { QuizT } from '../models/quiz'
import * as PA from '../lib/vv/patterns'
import { Reviewing, ReviewingFlags, type PickFlag, type ReviewingPatch } from '../models/reviewing'
import type { HuntActionDNA } from '../models/actions'
import styles from './workbench.module.css'

export type ReviewScreenProps = {
  quiz:       QuizT
  ident:      IdentT
  /** The reviews of this quiz this ident may read: its own, and the others' shared ones once its own is shared */
  reviews:    readonly ReviewedT[]
  dispatch:   (action: HuntActionDNA) => void
  unsaved:    boolean
}

/**
 * What a reviewer sees: the smith's note, folded to its first line, when there is one; the quiz's questions
 * but the archived, read-only, an alternate marked as one, each with its chained BUT NOT, the reviewer's verdict on it, and its answer behind a
 * lock; then an overall note, and a button to share it all with the smiths. Once theirs is shared, what the other reviewers have shared
 * appears below it; until then, a line says so.
 *
 * A review of this quiz for this ident is opened the moment this screen is, so a reviewer who
 * never writes anything still has a row waiting once they type into the overall note.
 *
 * Each question is what a reviewer is sent of it (`Question.sentTo`), the answer included: the
 * lock (`AnswerLock`) is a spoiler shield, not a security boundary.
 */
export function ReviewScreen({ quiz, ident, reviews, dispatch, unsaved }: Readonly<ReviewScreenProps>) {
  useEffect(() => {
    dispatch({ kind: 'open_review', quiz_id: quiz._id })
  }, [dispatch, quiz._id, ident._id])

  const own = reviewBy(reviews, ident._id)
  const questions = useMemo(() => Rank.inRankOrder(Question.unarchived(quiz.questions)), [quiz.questions])
  const reviewingFor = useMemo(() => new Map((own?.reviewings ?? []).map((reviewing) => [reviewing.question_id as string, reviewing])), [own])
  const { draft, onChange, onBlur } = useDraft(own?.overall ?? '', (overall) => {
    dispatch({ kind: 'set_overall', quiz_id: quiz._id, overall })
  })
  const phase = own?.phase ?? 'empty'
  const others = useMemo(() => reviews.filter((review) => review.ident_id !== ident._id), [reviews, ident._id])

  return (
    <main className={styles.page} data-unsaved={unsaved}>
      <Box sx={{ maxWidth: { xs: 760, lg: 1440 }, mx: 'auto' }}>
        <Typography variant="h4" component="h1" gutterBottom>{quiz.title || AppNotices.untitledQuiz} — PLAYTESTING</Typography>
        {quiz.smiths_note === '' ? null : <SmithsNoteReading key={quiz._id} note={quiz.smiths_note} />}
        <Stack spacing={2} sx={{ my: 3 }}>
          {questions.map((question) => (
            <ReviewQuestionRow
              key={question._id}
              quiz_id={quiz._id}
              question={question}
              chainTarget={quiz.questions.find((other) => other._id === question.chains_to) ?? null}
              reviewing={reviewingFor.get(question._id) ?? null}
              reviewings={own?.reviewings ?? []}
              dispatch={dispatch}
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
          slotProps={{ input: { endAdornment: <MarkdownFace inInput text={draft} /> }, htmlInput: { className: veiledIf(draft) } }}
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
        <Box sx={{ mt: 4 }}>
          {phase === 'shared'
            ? <ReviewsPanel questions={quiz.questions} reviews={others} title="Other reviews" blurb={AppNotices.othersReviewsBlurb} />
            : <p className={styles.microcopy}>{AppNotices.othersReviewsHidden}</p>}
        </Box>
      </Box>
    </main>
  )
}

/**
 * The smith's note as a reviewer reads it, under a heading with its fold triangle. It starts
 * folded to one line, its paragraphs run together and cut off with an ellipsis; unfolded, it is
 * the whole note, paragraphs and all. Only the triangle folds or unfolds it.
 */
function SmithsNoteReading({ note }: Readonly<{ note: string }>) {
  const noteId = useId()
  const [open, setOpen] = useState(false)
  return (
    <Paper variant="outlined" component="section" aria-label="Smith's note" sx={{ p: 2, mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', ml: -1.5 }}>
        <FoldButton size="medium" open={open} onOpenChange={setOpen} label="Show the smith's note in full" controls={noteId} />
        <Typography variant="overline" component="h2">Smith&apos;s note</Typography>
      </Box>
      <Typography id={noteId} noWrap={! open} sx={open ? { whiteSpace: 'pre-wrap' } : undefined}>{note}</Typography>
    </Paper>
  )
}

type ReviewQuestionRowProps = {
  quiz_id:     string
  question:    QuestionT
  /** The question this one chains to, whose hint is the BUT NOT shown alongside it */
  chainTarget: QuestionT | null
  /** The reviewer's verdict on this question so far; null until they first write to it */
  reviewing:   Doc<'reviewings'> | null
  /** The reviewer's verdicts on every question, which say whether a pick is still to be had */
  reviewings:  readonly Doc<'reviewings'>[]
  dispatch:    (action: HuntActionDNA) => void
}

/**
 * Where each part of a question sits. Stacked, one above the next, with the numbers and flags
 * sharing a line; given the room, the question beside the verdict as the smiths' grid has it,
 * the numbers and flags in a column of their own. The answer comes last either way.
 */
const RowAreasSx = {
  display:             'grid',
  gap:                 2,
  alignItems:          'start',
  gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 6fr) minmax(0, 3fr) minmax(0, 7fr) auto' },
  gridTemplateAreas:   {
    xs: '"question" "guesses" "comments" "marks" "answer"',
    lg: '"question guesses comments marks" "answer answer answer answer"',
  },
} as const

/**
 * Given the room, Guesses and Comments fill the height their row already has and scroll past it,
 * rather than making the row taller: each is lifted out of the flow, so the question and the marks
 * alone set the row's height. `VerdictField` is a plain textarea there, so it takes the height it
 * is given. Stacked, each grows with what is typed.
 */
const FillRowSx = {
  alignSelf:              'stretch',
  position:               'relative',
  '& .MuiTextField-root': { position: { lg: 'absolute' }, inset: { lg: 0 } },
  '& .MuiInputBase-root': { height: { lg: '100%' }, alignItems: { lg: 'stretch' } },
  '& textarea':           { height: { lg: '100%' }, overflow: { lg: 'auto' } },
} as const

/** A flag raised is in full colour on the accent; lowered, its face is grey and faded, so the two can't be mistaken */
const FlagSx = {
  gap:                           0.75,
  textTransform:                 'none',
  whiteSpace:                    'nowrap',
  '&.Mui-selected':              { bgcolor: 'primary.main', color: 'primary.contrastText', borderColor: 'primary.main' },
  '&.Mui-selected:hover':        { bgcolor: 'primary.dark' },
  '&:not(.Mui-selected) .face':  { filter: 'grayscale(1)', opacity: 0.5 },
} as const

/** The flags, in the order the row shows them: the two picks side by side, top first, then the fact check */
const [TopFlag, FactFlag, MehFlag] = ReviewingFlags

/**
 * One question: its number and clueing, rendered from markdown, the BUT NOT it chains to in full, read-only; then the
 * reviewer's verdict on it, each field saved as it is committed; then its answer, behind a lock.
 */
function ReviewQuestionRow({ quiz_id, question, chainTarget, reviewing, reviewings, dispatch }: Readonly<ReviewQuestionRowProps>) {
  const commit = (patch: ReviewingPatch) => { dispatch({ kind: 'set_reviewing', quiz_id, question_id: question._id, patch }) }
  const peek = () => { dispatch({ kind: 'peek_answer', quiz_id, question_id: question._id }) }
  const toggle = (flag: FlagToggleProps['flag'], raised: boolean) => { commit({ [flag]: raised }) }
  const pickFull = (flag: PickFlag) => Reviewing.pickedElsewhere(reviewings, flag, question._id) >= PA.PicksPerReview.max

  return (
    <Paper variant="outlined" component="section" aria-label={Question.titleShown(question, AppNotices.untitledQuestion)} sx={{ p: 2, ...RowAreasSx }}>
      <Stack spacing={1} sx={{ gridArea: 'question' }}>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {question.qnum === '' ? null : <Typography>{question.qnum}.</Typography>}
          {/* The review shows no titles, so an alternate is marked beside its number, as its title is elsewhere. */}
          {Question.isSecondary(question) && <Typography sx={{ fontStyle: 'italic', flex: 'none' }}>{Question.AltMark}</Typography>}
          <Typography component="div" className={styles.prose} sx={{ minWidth: 0 }}><MarkdownText text={question.clueing} /></Typography>
        </Box>
        <ButnotFull target={chainTarget} chained={question.chains_to !== null} />
      </Stack>
      <Box sx={{ gridArea: 'guesses', ...FillRowSx }}>
        <VerdictField label="Guesses" committed={reviewing?.guesses ?? ''} onCommit={(guesses) => { commit({ guesses }) }} />
      </Box>
      <Box sx={{ gridArea: 'comments', ...FillRowSx }}>
        <VerdictField label="Comments" committed={reviewing?.comments ?? ''} onCommit={(comments) => { commit({ comments }) }} />
      </Box>
      <Stack direction={{ xs: 'row', lg: 'column' }} useFlexGap spacing={1} sx={{ gridArea: 'marks', flexWrap: 'wrap', alignItems: { xs: 'center', lg: 'stretch' } }}>
        <Box sx={{ width: { xs: '6.5em', lg: 'auto' } }}>
          <NumberField label="Get rate %" committed={reviewing?.get_rate ?? null} fractional={false} max={100} locked={false} onCommit={(get_rate) => { commit({ get_rate }) }} />
        </Box>
        <Box sx={{ width: { xs: '6.5em', lg: 'auto' } }}>
          <NumberField label="Minutes" committed={reviewing?.minutes ?? null} fractional locked={false} onCommit={(minutes) => { commit({ minutes }) }} />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
          <FlagToggle {...TopFlag} raised={reviewing?.keep_it ?? false} full={pickFull('keep_it')} onToggle={toggle} />
          <FlagToggle {...MehFlag} raised={reviewing?.elimination_candidate ?? false} full={pickFull('elimination_candidate')} faceAfter onToggle={toggle} />
        </Box>
        <FlagToggle {...FactFlag} raised={reviewing?.needs_fact_check ?? false} onToggle={toggle} />
      </Stack>
      <Box sx={{ gridArea: 'answer' }}>
        <AnswerLock answer={question.full_answer} seen={reviewing?.peeked ?? false} onReveal={reviewing?.peeked ? undefined : peek} />
      </Box>
    </Paper>
  )
}

type FlagToggleProps = {
  flag:       (typeof ReviewingFlags)[number]['flag']
  emoji:      string
  word:       string
  title:      string
  raised:     boolean
  /** The review has all the picks of this kind it may: a lowered one can't be raised */
  full?:      boolean
  /** The face goes after the word rather than before it */
  faceAfter?: boolean
  onToggle:   (flag: FlagToggleProps['flag'], raised: boolean) => void
}

/** One flag as a toggle: its face and word, raised or lowered with a click */
function FlagToggle({ flag, emoji, word, title, raised, full = false, faceAfter = false, onToggle }: Readonly<FlagToggleProps>) {
  const face = <Box component="span" className="face" aria-hidden sx={{ fontSize: '1.125rem', lineHeight: 1 }}>{emoji}</Box>
  return (
    <ToggleButton
      value={flag}
      size="small"
      selected={raised}
      disabled={full && ! raised}
      title={title}
      sx={FlagSx}
      onChange={() => { onToggle(flag, ! raised) }}
    >
      {faceAfter ? <>{word}{face}</> : <>{face}{word}</>}
    </ToggleButton>
  )
}

/**
 * Guesses or Comments: an outlined box, saved when it loses focus, showing its markdown rendered
 * until it is typed into. Stacked, it is at least two
 * lines tall and grows with its text. Side by side, it is a plain textarea, which `FillRowSx`
 * stretches to the row's height: MUI's growing one sets its own height, which the row can't override.
 */
function VerdictField({ label, committed, onCommit }: Readonly<{ label: string, committed: string, onCommit: (draft: string) => void }>) {
  const { draft, onChange, onBlur } = useDraft(committed, onCommit)
  const sideBySide = useMediaQuery((theme) => theme.breakpoints.up('lg'))
  return (
    <TextField
      label={label}
      multiline
      minRows={2}
      fullWidth
      size="small"
      value={draft}
      onChange={(event) => { onChange(event.target.value) }}
      onBlur={onBlur}
      slotProps={{
        inputLabel: { shrink: true },
        input:      { ...(sideBySide && { inputComponent: 'textarea' }), endAdornment: <MarkdownFace inInput text={draft} /> },
        htmlInput:  { className: veiledIf(draft) },
      }}
    />
  )
}
