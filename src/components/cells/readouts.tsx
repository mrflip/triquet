'use client'

import clsx from 'clsx'
import { ErrBadge } from './ErrBadge'
import { CellNotices } from '../../lib/notices'
import { Widgeted, type JsonT, type WidgetedT } from '../../models/widgeted'
import styles from '../workbench.module.css'

export type WidgetedReadoutProps = {
  /** What the widgeting came to for this question */
  widgeted: WidgetedT
  /** Whether the column has room to say why a formula failed */
  wide:     boolean
  /** The tallest the cell may be, which is the height of the row */
  heightPx: number
}

/**
 * One worked-out cell: a number, some text, a muted dash for nothing, or a warning when the formula failed.
 *
 * A number wraps only between thousands groups -- `3,000,000` may break after either comma and
 * never inside a group, and takes no extra width when it does not need to break at all. Any other
 * value shows as its JSON. The cell scrolls inside the row: a worked-out column never makes its
 * row taller.
 */
export function WidgetedReadout({ widgeted, wide, heightPx }: Readonly<WidgetedReadoutProps>) {
  return (
    <ReadonlyCell heightPx={heightPx}>
      <div className={widgeted.status === 'ok' && typeof widgeted.value === 'number' ? styles.sum : styles.expressedText}>
        <WidgetedBody widgeted={widgeted} wide={wide} />
      </div>
    </ReadonlyCell>
  )
}

export type WidgetedAskCellProps = {
  /** What the widgeting came to for this question */
  widgeted: WidgetedT
  /** How its value was come by (`result_meta` of the row it came from); null when there is no value */
  meta:     Readonly<Record<string, JsonT>> | null
  /** What the cell is called, for "Ask ..." */
  label:    string
  /** Whether an ask for this cell is in flight; nothing stores a "thinking" state */
  asking:   boolean
  /** A question whose input comes to nothing is not asked about at all */
  askable:  boolean
  locked:   boolean
  /** Why the widgeting cannot be asked, when it cannot; the cell says so instead of inviting an ask */
  notice:   string | null
  heightPx: number
  onAsk:    () => void
}

/**
 * A cell asked from: what a prompt came to and how (its tier, whether it was cut short, about how
 * many tokens), or the invitation to ask, with a warning mark for a failure. Double-click, or
 * Enter, to ask again.
 */
export function WidgetedAskCell({ widgeted, meta, label, asking, askable, locked, notice, heightPx, onAsk }: Readonly<WidgetedAskCellProps>) {
  return (
    <div className={styles.askWrap}>
      <AskableCell label={label} locked={locked || ! askable || notice !== null} heightPx={heightPx} onAsk={onAsk}>
        {asking ? <span className={styles.muted}>{CellNotices.thinking}</span> : <AskedBody widgeted={widgeted} meta={meta} notice={notice} />}
      </AskableCell>
      {widgeted.err ? <ErrBadge err={widgeted.err} /> : null}
    </div>
  )
}

/** The value, the failure, or the invitation -- whichever an asked cell is holding */
function AskedBody({ widgeted, meta, notice }: Readonly<Pick<WidgetedAskCellProps, 'widgeted' | 'meta' | 'notice'>>) {
  if (widgeted.status === 'missing') { return <span className={styles.muted}>{notice ?? CellNotices.askable}</span> }
  if (widgeted.status === 'errored') {
    return (
      <>
        <div>{widgeted.err.message}</div>
        <div className={styles.metaline}>{CellNotices.retry}</div>
      </>
    )
  }
  return (
    <>
      <div className={styles.expressedText}>{Widgeted.textOf(widgeted)}</div>
      <div className={styles.metaline}>{metalineOf(meta ?? {})}</div>
    </>
  )
}

/** How a value was come by, in a few words: its tier, whether it was cut short, about how many tokens */
function metalineOf(meta: Readonly<Record<string, JsonT>>): string {
  const tier = typeof meta.model_tier_applied === 'string' ? meta.model_tier_applied : ''
  const truncated = meta.truncated === true ? ` ${CellNotices.truncated}` : ''
  const tokens = typeof meta.approx_tokens === 'number' ? ` · ~${String(meta.approx_tokens)} tok` : ''
  return `${tier}${truncated}${tokens}`
}

/** The inside of a worked-out cell */
function WidgetedBody({ widgeted, wide }: Readonly<Omit<WidgetedReadoutProps, 'heightPx'>>) {
  if (widgeted.status === 'missing') { return <span className={styles.muted}>{CellNotices.nothingExpressed}</span> }
  if (widgeted.status === 'errored') {
    const { message } = widgeted.err
    return (
      <span className={styles.muted} title={message} role="img" aria-label={`The formula failed: ${message}`}>
        {CellNotices.expressedError}{wide ? ` ${message}` : ''}
      </span>
    )
  }
  if (typeof widgeted.value !== 'number') { return <span>{Widgeted.textOf(widgeted)}</span> }
  const groups = widgeted.value.toLocaleString('en-US').split(',')
  return (
    <span>
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
