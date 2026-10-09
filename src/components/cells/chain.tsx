'use client'

import { Box, Typography } from '@mui/material'
import clsx from 'clsx'
import { MarkdownText } from './markdown'
import * as Chain from '../../lib/chain'
import { CellNotices } from '../../lib/notices'
import { Question, type QuestionT } from '../../models/question'
import styles from '../workbench.module.css'

export type ChainPickerProps = {
  question:  QuestionT
  /** Every question in the quiz, so the picker can offer all the others */
  questions: QuestionT[]
  locked:    boolean
  onChain:   (chains_to: string | null) => void
}

/**
 * Which question follows this one. Every other question in the quiz but the archived, by its title
 * as shown (an alternate's marked as one); an archived one only when it is already the one chained
 * to, marked as archived.
 */
export function ChainPicker({ question, questions, locked, onChain }: Readonly<ChainPickerProps>) {
  const offered = chainOptionsOf(questions).filter(({ _id, archived }) => _id !== question._id && (! archived || _id === question.chains_to))
  return (
    <select
      className={styles.field}
      aria-label="Chains to"
      disabled={locked}
      value={question.chains_to ?? ''}
      onChange={(event) => { onChain(event.target.value === '' ? null : event.target.value) }}
    >
      <option value="">{CellNotices.chainUnset}</option>
      {offered.map(({ option }) => option)}
    </select>
  )
}

/** One question as a chain picker may offer it: its option, and what decides whether a picker offers it */
type ChainOptionT = { _id: string, archived: boolean, option: React.JSX.Element }

/** The options `chainOptionsOf` made, by the questions they were made from */
const ChainOptionsOf = new WeakMap<readonly QuestionT[], readonly ChainOptionT[]>()

/**
 * Every question of `questions` as a chain picker may offer it, made once for all of a quiz's
 * pickers rather than once for each of them: each picker passes over itself, and over the
 * archived but the one it chains to.
 */
function chainOptionsOf(questions: readonly QuestionT[]): readonly ChainOptionT[] {
  const known = ChainOptionsOf.get(questions)
  if (known !== undefined) { return known }
  const made = questions.map((other) => {
    const archived = Question.isArchived(other)
    const option = (
      <option key={other._id} value={other._id}>
        {Question.titleShown(other, CellNotices.chainTargetUnnamed)}{archived ? ` ${CellNotices.chainTargetArchived}` : ''}
      </option>
    )
    return { _id: other._id, archived, option }
  })
  ChainOptionsOf.set(questions, made)
  return made
}

export type ButnotPreviewProps = {
  /** The question this one chains to, or null when unchained or pointing nowhere */
  target:   QuestionT | null
  chained:  boolean
  heightPx: number
}

/**
 * The BUT NOT text presented alongside this question: the *chained-to* question's own hint,
 * previewed to a snippet with the whole of it on hover.
 */
export function ButnotPreview({ target, chained, heightPx }: Readonly<ButnotPreviewProps>) {
  const notice = butnotNoticeFor(target, chained)
  return (
    <div
      className={clsx(styles.readonlyCell, styles.scrolls, notice !== null && styles.muted)}
      style={{ maxHeight: `${String(heightPx)}px` }}
      title={notice === null ? target?.hint : undefined}
    >
      <div>{notice ?? Chain.chainSnippet(target?.hint ?? '')}</div>
    </div>
  )
}

/**
 * The BUT NOT in full, rendered from its markdown, under a heading that names it: the review screen's reading, where a
 * question is read top to bottom and there is room for all of the chained-to hint. Its reader
 * cannot pick a chain, so an unchained question says only that no hint is attached.
 */
export function ButnotFull({ target, chained }: Readonly<Omit<ButnotPreviewProps, 'heightPx'>>) {
  const notice = chained ? butnotNoticeFor(target, chained) : CellNotices.butnotNoChainRead
  return (
    <Box>
      <Typography variant="overline" component="div" color="text.secondary">BUT NOT</Typography>
      {notice === null
        ? <Typography component="div" className={styles.prose}><MarkdownText text={target?.hint ?? ''} /></Typography>
        : <Typography color="text.secondary">{notice}</Typography>}
    </Box>
  )
}

/** What the BUT NOT cell says when it has no hint to preview */
function butnotNoticeFor(target: QuestionT | null, chained: boolean): string | null {
  if (! chained) { return CellNotices.butnotNoChain }
  if (target === null) { return CellNotices.butnotNoTarget }
  return target.hint.trim() === '' ? CellNotices.butnotNoHint : null
}
