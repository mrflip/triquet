'use client'

import clsx from 'clsx'
import { CellNotices } from '../../lib/notices'
import type { Expressed } from '../../lib/expressed'
import styles from '../workbench.module.css'

/**
 * One computed cell: a number, some text, a muted dash for nothing, or a warning when the formula failed.
 *
 * A number wraps only between thousands groups -- `3,000,000` may break after either comma and
 * never inside a group, and takes no extra width when it does not need to break at all. A value
 * worked out from something since edited is greyed and italic rather than dropped. The cell
 * scrolls inside the row: a computed column never makes its row taller.
 *
 * @param reading - What the expressing came to for this question.
 * @param wide - Whether the column has room to say why a formula failed.
 * @param heightPx - The tallest the cell may be, which is the height of the row.
 */
export function ExpressedReadout({ reading, wide, heightPx }: Readonly<{ reading: Expressed, wide: boolean, heightPx: number }>) {
  return (
    <ReadonlyCell heightPx={heightPx}>
      <div className={reading.status === 'value' && typeof reading.val === 'number' ? styles.sum : styles.expressedText}>
        <ExpressedBody reading={reading} wide={wide} />
      </div>
    </ReadonlyCell>
  )
}

/** The inside of a computed cell */
function ExpressedBody({ reading, wide }: Readonly<{ reading: Expressed, wide: boolean }>) {
  if (reading.status === 'nothing') { return <span className={styles.muted}>{CellNotices.nothingExpressed}</span> }
  if (reading.status === 'error') {
    return (
      <span className={styles.muted} title={reading.message} role="img" aria-label={`The formula failed: ${reading.message}`}>
        {CellNotices.expressedError}{wide ? ` ${reading.message}` : ''}
      </span>
    )
  }
  const stale = reading.stale ? styles.stale : undefined
  if (typeof reading.val !== 'number') { return <span className={stale} data-stale={reading.stale || undefined}>{String(reading.val)}</span> }
  const groups = reading.val.toLocaleString('en-US').split(',')
  return (
    <span className={stale} data-stale={reading.stale || undefined}>
      {groups.map((group, idx) => (
        <span key={`${group}-${String(idx)}`}>
          {idx > 0 ? ',' : ''}
          {idx > 0 ? <wbr /> : null}
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
      // "Ask ..." rather than the bare column name: the sortable column header is a button
      // too, and two controls with one name is a trap for anyone navigating by name.
      aria-label={`Ask ${label}`}
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
