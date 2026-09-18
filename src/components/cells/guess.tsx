'use client'

import { AskableCell } from './readouts'
import { AskFailureNotices, CellNotices } from '../../lib/notices'
import type { GuessT } from '../../models/guess'
import styles from '../workbench.module.css'

export type GuessCellProps = {
  guess:    GuessT
  /** Whether an ask for this cell is in flight; the model never stores a "thinking" state */
  asking:   boolean
  /** A question with no text is not asked about at all */
  askable:  boolean
  locked:   boolean
  heightPx: number
  onAsk:    () => void
}

/**
 * What a fast, not-especially-careful reader answered.
 *
 * A guess that differs from the intended short answer means the question has a second reading
 * the author could not see from the inside. The tool never scores that comparison for them.
 */
export function GuessCell({ guess, asking, askable, locked, heightPx, onAsk }: Readonly<GuessCellProps>) {
  return (
    <AskableCell label="Quick-model guess" locked={locked || ! askable} heightPx={heightPx} onAsk={onAsk}>
      {asking ? <span className={styles.muted}>{CellNotices.thinking}</span> : <GuessBody guess={guess} />}
    </AskableCell>
  )
}

/** The answer, the failure, or the invitation -- whichever this cell is holding */
function GuessBody({ guess }: Readonly<{ guess: GuessT }>) {
  if (guess === null) { return <span className={styles.muted}>{CellNotices.askable}</span> }
  if (guess.status === 'error') {
    return (
      <>
        <div>{guess.message}</div>
        <div className={styles.metaline}>{CellNotices.retry}</div>
      </>
    )
  }
  return (
    <>
      <div>{guess.text}</div>
      <div className={styles.metaline}>
        {guess.model_tier_applied ?? 'quick'}
        {guess.truncated ? ` ${CellNotices.truncated}` : ''}
        {guess.approx_tokens === undefined ? '' : ` · ~${String(guess.approx_tokens)} tok`}
        {' · Refresh'}
      </div>
    </>
  )
}

/** The plain-language reason an ask failed, ready to store on the question */
export function askFailureMessage(failurekind: keyof typeof AskFailureNotices): string {
  return AskFailureNotices[failurekind]
}
