'use client'

import clsx from 'clsx'
import { CellNotices } from '../../lib/notices'
import styles from '../workbench.module.css'

/**
 * A number that wraps only between thousands groups.
 *
 * `3,000,000` may break after either comma and never inside a group, and takes no extra width
 * when it does not need to break at all.
 *
 * @param total - The sum to show, already rounded, or null when there is nothing behind it yet.
 */
export function SumReadout({ total, stale }: Readonly<{ total: number | null, stale: boolean }>) {
  if (total === null) { return <span className={styles.muted}>{CellNotices.sumUncomputable}</span> }
  const groups = total.toLocaleString('en-US').split(',')
  return (
    <span className={stale ? styles.stale : undefined}>
      {groups.map((group, ii) => (
        <span key={`${group}-${String(ii)}`}>
          {ii > 0 ? ',' : ''}
          {ii > 0 ? <wbr /> : null}
          {group}
        </span>
      ))}
    </span>
  )
}

export type AskableCellProps = {
  label:     string
  locked:    boolean
  heightPx:  number
  onAsk:     () => void
  children:  React.ReactNode
}

/**
 * A cell the author can ask the model to fill: double-click, or focus it and press Enter or
 * Space. Keyboard-reachable, with a minimum height so it never collapses to a sliver.
 */
export function AskableCell({ label, locked, heightPx, onAsk, children }: Readonly<AskableCellProps>) {
  return (
    <button
      type="button"
      className={clsx(styles.askable, styles.scrolls)}
      style={{ maxHeight: `${String(heightPx)}px` }}
      aria-label={label}
      disabled={locked}
      onDoubleClick={onAsk}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') { return }
        event.preventDefault()
        onAsk()
      }}
      // A single click must not spend the author's model usage by accident.
      onClick={(event) => { event.preventDefault() }}
    >
      {children}
    </button>
  )
}

/** A cell that only ever mirrors something computed elsewhere */
export function ReadonlyCell({ heightPx, children }: Readonly<{ heightPx: number, children: React.ReactNode }>) {
  return (
    <div className={clsx(styles.readonlyCell, styles.scrolls)} style={{ maxHeight: `${String(heightPx)}px` }}>
      {children}
    </div>
  )
}
