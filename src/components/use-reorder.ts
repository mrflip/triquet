'use client'

import { useEffect, useRef, useState } from 'react'
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/utils/combine'
import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge/attach-closest-edge'
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge/extract-closest-edge'
import { getReorderDestinationIndex } from '@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index'
import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types'

/** How far an arrow key moves a row, by the key that was pressed */
const ArrowSteps: Record<string, number | undefined> = { ArrowUp: -1, ArrowDown: 1 }

export type ReorderableProps = {
  /** Names the list, so a row refuses one dragged out of a different list on the same page */
  listkey:  string
  /** What the caller calls this row; handed back when it moves */
  itemkey:  string
  /** Where the row sits now */
  idx:      number
  /** How many rows the list has, so an arrow key at either end does nothing */
  count:    number
  disabled: boolean
  /** Told which row moved, and the index it lands on counted in the list as it stands after the lift */
  onMove:   (itemkey: string, onto_idx: number) => void
}

export type Reorderable = {
  /** The row: what a drop lands against, and what the indicator is drawn on */
  rowRef:    (elem: HTMLElement | null) => void
  /** The grip: the only part of the row a drag begins from, and where the arrow keys are heard */
  handleRef: (elem: HTMLElement | null) => void
  /** This is the row being dragged, so it goes translucent */
  dragging:  boolean
  /** Which of this row's edges the dragged row would land against; null when it would not land here */
  landing:   Edge | null
  onHandleKeyDown: (event: React.KeyboardEvent) => void
  /** The grip lost focus: the arrow keys start again from where the row appears */
  onHandleBlur:    () => void
}

/**
 * One row of a list that is reordered by dragging its grip, or by the arrow keys once the grip
 * has focus.
 *
 * Nothing moves until the drop, and the list is never reordered here: the caller is told what
 * moved where and hands back the new order, so what is on screen is always what is held. The
 * index handed back counts the list as it stands once the row has been lifted out of it, which
 * is what `moveQuestion` and the layout reducer's `movedTo` both expect.
 *
 * The grip is the draggable rather than the row, so the browser's drag preview is the grip
 * itself -- a row of the question grid is two thousand pixels wide and makes a wretched one.
 *
 * @param listkey - Names the list this row belongs to.
 * @param itemkey - Names this row within it.
 * @param onMove - Told what was dropped, or stepped, where.
 * @returns Refs for the row and its grip, and what to draw while a drag is over them.
 *
 * @example const { rowRef, handleRef, dragging, landing } = useReorderable({ listkey: 'columns', itemkey: column.label, idx, count, disabled, onMove })
 */
export function useReorderable({ listkey, itemkey, idx, count, disabled, onMove }: Readonly<ReorderableProps>): Reorderable {
  const [rowElem, setRowElem]       = useState<HTMLElement | null>(null)
  const [handleElem, setHandleElem] = useState<HTMLElement | null>(null)
  const [dragging, setDragging]     = useState(false)
  const [landing, setLanding]       = useState<Edge | null>(null)
  const move = useRef(onMove)

  useEffect(() => { move.current = onMove }, [onMove])

  useEffect(() => {
    if (disabled || rowElem === null || handleElem === null) { return }
    const mine = { listkey, itemkey, idx }
    return combine(
      draggable({
        element:        handleElem,
        getInitialData: () => mine,
        onDragStart:    () => { setDragging(true) },
        onDrop:         ({ location }) => {
          setDragging(false)
          const onto = location.current.dropTargets[0]
          if (! onto) { return }
          const over_idx = carriedIdx(onto.data, listkey)
          if (over_idx === -1) { return }
          move.current(itemkey, getReorderDestinationIndex({
            startIndex:          idx,
            indexOfTarget:       over_idx,
            closestEdgeOfTarget: extractClosestEdge(onto.data),
            axis:                'vertical',
          }))
        },
      }),
      dropTargetForElements({
        element:     rowElem,
        canDrop:     ({ source }) => carriedIdx(source.data, listkey) !== -1,
        getData:     ({ input, element }) => attachClosestEdge(mine, { input, element, allowedEdges: ['top', 'bottom'] }),
        // A row dragged over itself would land where it already is, so it is left unmarked.
        onDrag:      ({ self, source }) => { setLanding(source.element === handleElem ? null : extractClosestEdge(self.data)) },
        onDragLeave: () => { setLanding(null) },
        onDrop:      () => { setLanding(null) },
      }),
    )
  }, [rowElem, handleElem, listkey, itemkey, idx, disabled])

  // Where the last arrow press sent this row, until the list shows it there. A move lands a
  // moment after it is asked for, so a second press in that moment steps on from where the first
  // one sent it rather than from where the row still appears.
  const sentTo = useRef<number | null>(null)
  useEffect(() => {
    if (idx === sentTo.current) { sentTo.current = null }
  }, [idx])

  const onHandleKeyDown = (event: React.KeyboardEvent) => {
    const step = ArrowSteps[event.key]
    if (disabled || step === undefined) { return }
    const onto_idx = (sentTo.current ?? idx) + step
    if (onto_idx < 0 || onto_idx >= count) { return }
    event.preventDefault()
    sentTo.current = onto_idx
    onMove(itemkey, onto_idx)
  }

  const onHandleBlur = () => { sentTo.current = null }

  return { rowRef: setRowElem, handleRef: setHandleElem, dragging, landing, onHandleKeyDown, onHandleBlur }
}

/** The index a drag carries, when it came from the list named `listkey`; -1 when it did not */
function carriedIdx(bag: Record<string | symbol, unknown>, listkey: string): number {
  return bag.listkey === listkey && typeof bag.idx === 'number' ? bag.idx : -1
}
