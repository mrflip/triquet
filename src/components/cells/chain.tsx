'use client'

import { createContext, useContext, useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import clsx from 'clsx'
import { MarkdownText } from './markdown'
import * as Chain from '../../lib/chain'
import { CellNotices } from '../../lib/notices'
import { Question, type QuestionT } from '../../models/question'
import styles from '../workbench.module.css'

export type ChainPickerProps = {
  question:  Pick<QuestionT, '_id' | 'chains_to'>
  locked:    boolean
  onChain:   (chains_to: string | null) => void
}

/**
 * Which question follows this one. Every other question in the quiz but the archived, by its title
 * as shown (an alternate's marked as one); an archived one only when it is already the one chained
 * to, marked as archived. What it offers is the quiz's, from the grid around it (`ChainChoices`),
 * so a question retitled draws every picker again, and not the rows they sit in.
 */
export function ChainPicker({ question, locked, onChain }: Readonly<ChainPickerProps>) {
  const options = useContext(ChainOptionsContext)
  const offered = options.filter(({ _id, archived }) => _id !== question._id && (! archived || _id === question.chains_to))
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

/** One question as the pickers name it: its id, its title as shown, and whether it is archived */
type ChainChoiceT = { _id: string, title: string, archived: boolean }

/** What every chain picker of a grid offers: none outside one */
const ChainOptionsContext = createContext<readonly ChainOptionT[]>([])

export type ChainChoicesProps = {
  /** Every question of the quiz, archived among them, in its order */
  questions: readonly QuestionT[]
  children:  React.ReactNode
}

/**
 * What every chain picker within offers: each question of `questions`, made once for them all
 * rather than once for each, and made again only when a question's title or whether it is
 * archived changes, or one comes or goes.
 */
export function ChainChoices({ questions, children }: Readonly<ChainChoicesProps>) {
  const choicesKey = JSON.stringify(questions.map((question): ChainChoiceT => ({
    _id: question._id, title: Question.titleShown(question, CellNotices.chainTargetUnnamed), archived: Question.isArchived(question),
  })))
  const options = useMemo(() => (JSON.parse(choicesKey) as ChainChoiceT[]).map(({ _id, title, archived }) => ({
    _id,
    archived,
    option: <option key={_id} value={_id}>{title}{archived ? ` ${CellNotices.chainTargetArchived}` : ''}</option>,
  })), [choicesKey])
  return <ChainOptionsContext value={options}>{children}</ChainOptionsContext>
}

export type ButnotPreviewProps = {
  /** The question this one chains to, as far as its hint, or null when unchained or pointing nowhere */
  target:   Pick<QuestionT, 'hint'> | null
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
function butnotNoticeFor(target: Pick<QuestionT, 'hint'> | null, chained: boolean): string | null {
  if (! chained) { return CellNotices.butnotNoChain }
  if (target === null) { return CellNotices.butnotNoTarget }
  return target.hint.trim() === '' ? CellNotices.butnotNoHint : null
}
