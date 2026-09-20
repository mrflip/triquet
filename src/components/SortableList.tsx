'use client'

import { useState } from 'react'
import clsx from 'clsx'
import styles from './workbench.module.css'

export type SortableListProps<TT> = {
  items:    readonly TT[]
  keyOf:    (item: TT) => string
  /** Called with the moved item's key and the index it was dropped at, counted in the list as it stands after the lift */
  onMove:   (key: string, onto_idx: number) => void
  disabled?: boolean
  /** One row; the handle to drag it by is given to be put wherever the row wants it */
  renderRow: (item: TT, handle: React.ReactNode) => React.ReactNode
  /** Names the list for a screen reader */
  label:    string
}

/**
 * A list whose rows are dragged into a new order by their handles.
 *
 * Nothing moves until the drop, and the list itself is never reordered here: the caller is told
 * what moved where and hands back the new order, so what is on screen is always what is held.
 *
 * @param items - The rows, in order.
 * @param onMove - Told what was dropped where.
 * @param renderRow - Draws one row, given its handle.
 */
export function SortableList<TT>({ items, keyOf, onMove, disabled = false, renderRow, label }: Readonly<SortableListProps<TT>>) {
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const settle = (onto_idx: number) => {
    if (draggingKey !== null) { onMove(draggingKey, onto_idx) }
    setDraggingKey(null)
    setOverIdx(null)
  }

  return (
    <div role="list" aria-label={label}>
      {items.map((item, idx) => {
        const key = keyOf(item)
        const handle = (
          <span
            className={clsx(styles.grip, disabled && styles.gripLocked)}
            draggable={! disabled}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={`Reorder ${key}`}
            onDragStart={() => { setDraggingKey(key) }}
            onDragEnd={() => { setDraggingKey(null); setOverIdx(null) }}
          >
            ⠿
          </span>
        )
        return (
          <div
            key={key}
            role="listitem"
            className={clsx(draggingKey === key && styles.rowDragging, overIdx === idx && draggingKey !== null && draggingKey !== key && styles.rowDropTarget)}
            style={{ padding: '4px 0' }}
            onDragOver={(event) => {
              if (disabled || draggingKey === null) { return }
              event.preventDefault()
              setOverIdx(idx)
            }}
            onDrop={(event) => {
              if (disabled || draggingKey === null) { return }
              event.preventDefault()
              settle(idx)
            }}
          >
            {renderRow(item, handle)}
          </div>
        )
      })}
    </div>
  )
}
