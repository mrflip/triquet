'use client'

import clsx from 'clsx'
import { CellNotices } from '../../lib/notices'
import { Widgeted, type WidgetedT } from '../../models/widgeted'
import styles from '../workbench.module.css'

export type WidgetedReadoutProps = {
  /** What the widgeting came to for this question */
  widgeted: WidgetedT
  /** Whether its formula marked the value out of date */
  stale:    boolean
  /** Whether the column has room to say why a formula failed */
  wide:     boolean
  /** The tallest the cell may be, which is the height of the row */
  heightPx: number
}

/**
 * One worked-out cell: a number, some text, a muted dash for nothing, or a warning when the formula failed.
 *
 * A number wraps only between thousands groups -- `3,000,000` may break after either comma and
 * never inside a group, and takes no extra width when it does not need to break at all. A value
 * worked out from something since edited is greyed and italic rather than dropped. Any other
 * value shows as its JSON. The cell scrolls inside the row: a worked-out column never makes its
 * row taller.
 */
export function WidgetedReadout({ widgeted, stale, wide, heightPx }: Readonly<WidgetedReadoutProps>) {
  return (
    <ReadonlyCell heightPx={heightPx}>
      <div className={widgeted.status === 'ok' && typeof widgeted.value === 'number' ? styles.sum : styles.expressedText}>
        <WidgetedBody widgeted={widgeted} stale={stale} wide={wide} />
      </div>
    </ReadonlyCell>
  )
}

/** The inside of a worked-out cell */
function WidgetedBody({ widgeted, stale, wide }: Readonly<Omit<WidgetedReadoutProps, 'heightPx'>>) {
  if (widgeted.status === 'missing') { return <span className={styles.muted}>{CellNotices.nothingExpressed}</span> }
  if (widgeted.status === 'errored') {
    const { message } = widgeted.err
    return (
      <span className={styles.muted} title={message} role="img" aria-label={`The formula failed: ${message}`}>
        {CellNotices.expressedError}{wide ? ` ${message}` : ''}
      </span>
    )
  }
  const staleClass = stale ? styles.stale : undefined
  if (typeof widgeted.value !== 'number') { return <span className={staleClass} data-stale={stale || undefined}>{Widgeted.textOf(widgeted)}</span> }
  const groups = widgeted.value.toLocaleString('en-US').split(',')
  return (
    <span className={staleClass} data-stale={stale || undefined}>
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
