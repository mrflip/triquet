'use client'

import clsx from 'clsx'
import * as Chain from '../../lib/chain'
import { CellNotices } from '../../lib/notices'
import type { QuestionT } from '../../models/question'
import styles from '../workbench.module.css'

export type ChainPickerProps = {
  question:  QuestionT
  /** Every question in the quiz, so the picker can offer all the others */
  questions: QuestionT[]
  locked:    boolean
  onChain:   (chains_to: string | null) => void
}

/** Which question follows this one. Every other question in the quiz, by its title. */
export function ChainPicker({ question, questions, locked, onChain }: Readonly<ChainPickerProps>) {
  return (
    <select
      className={clsx(styles.field, styles.fieldData)}
      aria-label="Chains to"
      disabled={locked}
      value={question.chains_to ?? ''}
      onChange={(event) => { onChain(event.target.value === '' ? null : event.target.value) }}
    >
      <option value="">{CellNotices.chainUnset}</option>
      {questions.filter((other) => other.id !== question.id).map((other) => (
        <option key={other.id} value={other.id}>
          {other.title === '' ? CellNotices.chainTargetUnnamed : other.title}
        </option>
      ))}
    </select>
  )
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
      {notice ?? Chain.chainSnippet(target?.hint ?? '')}
    </div>
  )
}

/** What the BUT NOT cell says when it has no hint to preview */
function butnotNoticeFor(target: QuestionT | null, chained: boolean): string | null {
  if (! chained) { return CellNotices.butnotNoChain }
  if (target === null) { return CellNotices.butnotNoTarget }
  return target.hint.trim() === '' ? CellNotices.butnotNoHint : null
}
