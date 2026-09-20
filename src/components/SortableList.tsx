'use client'

import clsx from 'clsx'
import { useReorderable } from './use-reorder'
import styles from './workbench.module.css'

export type SortableListProps<TT> = {
  items:    readonly TT[]
  keyOf:    (item: TT) => string
  /** Called with the moved item's key and the index it was dropped at, counted in the list as it stands after the lift */
  onMove:   (key: string, onto_idx: number) => void
  disabled?: boolean
  /** One row; the handle to drag it by is given to be put wherever the row wants it */
  renderRow: (item: TT, handle: React.ReactNode) => React.ReactNode
  /** Names the list for a screen reader, and keeps its rows from being dropped into another one */
  label:    string
}

/**
 * A list whose rows are dragged into a new order by their handles, or stepped into one with the
 * up and down arrows once a handle has focus.
 *
 * Nothing moves until the drop, and the list itself is never reordered here: the caller is told
 * what moved where and hands back the new order, so what is on screen is always what is held.
 *
 * @param items - The rows, in order.
 * @param onMove - Told what was dropped where.
 * @param renderRow - Draws one row, given its handle.
 */
export function SortableList<TT>({ items, keyOf, onMove, disabled = false, renderRow, label }: Readonly<SortableListProps<TT>>) {
  return (
    <div role="list" aria-label={label}>
      {items.map((item, idx) => (
        <SortableRow
          key={keyOf(item)}
          listkey={label}
          itemkey={keyOf(item)}
          idx={idx}
          count={items.length}
          disabled={disabled}
          onMove={onMove}
        >
          {(handle) => renderRow(item, handle)}
        </SortableRow>
      ))}
    </div>
  )
}

type SortableRowProps = {
  listkey:  string
  itemkey:  string
  idx:      number
  count:    number
  disabled: boolean
  onMove:   (key: string, onto_idx: number) => void
  /** Draws the row, given the handle to place within it */
  children: (handle: React.ReactNode) => React.ReactNode
}

/** One row of the list, with its own grip and its own sense of where a drop would land */
function SortableRow({ listkey, itemkey, idx, count, disabled, onMove, children }: Readonly<SortableRowProps>) {
  const { rowRef, handleRef, dragging, landing, onHandleKeyDown } = useReorderable({ listkey, itemkey, idx, count, disabled, onMove })

  const handle = (
    <span
      ref={handleRef}
      className={clsx(styles.grip, disabled && styles.gripLocked)}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Reorder ${itemkey}`}
      onKeyDown={onHandleKeyDown}
    >
      ⠿
    </span>
  )

  return (
    <div
      ref={rowRef}
      role="listitem"
      className={clsx(dragging && styles.rowDragging, landing === 'top' && styles.rowDropAbove, landing === 'bottom' && styles.rowDropBelow)}
      style={{ padding: '4px 0' }}
    >
      {children(handle)}
    </div>
  )
}
