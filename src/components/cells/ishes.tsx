'use client'

import clsx from 'clsx'
import { AskableCell, ReadonlyCell } from './readouts'
import { CellNotices } from '../../lib/notices'
import type { IshesT } from '../../models/ish'
import styles from '../workbench.module.css'

export type IshesCellProps = {
  ishes:    IshesT
  label:    string
  /** Whether an ask for this cell is in flight; the model never stores a "thinking" state */
  asking:   boolean
  /** A text with nothing in it is not asked about at all */
  askable:  boolean
  locked:   boolean
  /** Why the player cannot play, when it cannot; the cell says so instead of inviting an ask */
  notice:   string | null
  heightPx: number
  onAsk:    () => void
}

/** Every span in one text a reasonable player might read as a number. Askable. */
export function IshesCell({ ishes, label, asking, askable, locked, notice, heightPx, onAsk }: Readonly<IshesCellProps>) {
  return (
    <AskableCell label={label} locked={locked || ! askable || notice !== null} heightPx={heightPx} onAsk={onAsk}>
      {asking ? <span className={styles.muted}>{CellNotices.thinking}</span> : <IshesBody ishes={ishes} notice={notice} />}
    </AskableCell>
  )
}

export type ButnotIshesCellProps = {
  /** The chained-to question's own hint extraction, borrowed and never recomputed */
  ishes:    IshesT
  chained:  boolean
  heightPx: number
}

/**
 * A mirror of the chained-to question's Hint Ishes, never its own computation.
 *
 * Extract a hint once, on the question whose answer it disguises, and every column that borrows
 * it updates -- so this cell points the author at the right place to double-click rather than
 * offering to do the work again.
 */
export function ButnotIshesCell({ ishes, chained, heightPx }: Readonly<ButnotIshesCellProps>) {
  if (! chained) {
    return <ReadonlyCell heightPx={heightPx}><span className={styles.muted}>{CellNotices.butnotNoChain}</span></ReadonlyCell>
  }
  if (ishes === null) {
    return <ReadonlyCell heightPx={heightPx}><span className={styles.muted}>{CellNotices.butnotIshesUnasked}</span></ReadonlyCell>
  }
  return <ReadonlyCell heightPx={heightPx}><IshesBody ishes={ishes} /></ReadonlyCell>
}

/** The spans, the failure, or the invitation -- whichever this cell is holding */
function IshesBody({ ishes, notice = null }: Readonly<{ ishes: IshesT, notice?: string | null }>) {
  if (ishes === null) { return <span className={styles.muted}>{notice ?? CellNotices.askable}</span> }
  if (ishes.status === 'error') {
    return (
      <>
        <div>{ishes.message}</div>
        <div className={styles.metaline}>{CellNotices.retry}</div>
      </>
    )
  }
  return (
    <div className={clsx(ishes.stale && styles.stale)}>
      {ishes.items.length === 0
        ? <span className={styles.muted}>{CellNotices.ishesNoneFound}</span>
        : ishes.items.map((item, idx) => (
          <div key={`${item.text}-${String(idx)}`}>
            {item.text} <span className={styles.muted}>= {item.value.toLocaleString('en-US')}</span>
            {item.kind === 'wordish' ? <span className={styles.muted}> w</span> : null}
          </div>
        ))}
      <div className={styles.metaline}>
        {ishes.model_tier_applied ?? 'quick'}
        {ishes.stale ? ` ${CellNotices.stale}` : ''}
        {ishes.truncated ? ` ${CellNotices.truncated}` : ''}
        {ishes.approx_tokens === undefined ? '' : ` · ~${String(ishes.approx_tokens)} tok`}
      </div>
    </div>
  )
}
