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
  /** Stays where it is: other rows are dropped against it, but it has no grip of its own */
  fixed?:   boolean
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
 * is what `moveQuestion` and the layout actions' `movedTo` both expect.
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
export function useReorderable({ listkey, itemkey, idx, count, disabled, fixed = false, onMove }: Readonly<ReorderableProps>): Reorderable {
  const [rowElem, setRowElem]       = useState<HTMLElement | null>(null)
  const [handleElem, setHandleElem] = useState<HTMLElement | null>(null)
  const [dragging, setDragging]     = useState(false)
  const [landing, setLanding]       = useState<Edge | null>(null)
  const move = useRef(onMove)

  useEffect(() => { move.current = onMove }, [onMove])

  useEffect(() => {
    if (disabled || rowElem === null || (handleElem === null && ! fixed)) { return }
    const mine = { listkey, itemkey, idx }
    const target = dropTargetForElements({
      element:     rowElem,
      canDrop:     ({ source }) => carriedIdx(source.data, listkey) !== -1,
      getData:     ({ input, element }) => attachClosestEdge(mine, { input, element, allowedEdges: ['top', 'bottom'] }),
      // A row dragged over itself would land where it already is, so it is left unmarked.
      onDrag:      ({ self, source }) => { setLanding(source.element === handleElem ? null : extractClosestEdge(self.data)) },
      onDragLeave: () => { setLanding(null) },
      onDrop:      () => { setLanding(null) },
    })
    if (fixed || handleElem === null) { return target }
    return combine(
      draggable({
        element:        handleElem,
        getInitialData: () => mine,
        onDragStart:    () => { setDragging(true) },
        onDrop:         ({ location }) => {
          setDragging(false)
          const onto = location.current.dropTargets[0]
          if (! onto) { return }
          const overIdx = carriedIdx(onto.data, listkey)
          if (overIdx === -1) { return }
          move.current(itemkey, getReorderDestinationIndex({
            startIndex:          idx,
            indexOfTarget:       overIdx,
            closestEdgeOfTarget: extractClosestEdge(onto.data),
            axis:                'vertical',
          }))
        },
      }),
      target,
    )
  }, [rowElem, handleElem, listkey, itemkey, idx, disabled, fixed])

  // Where the last arrow press sent this row, until the list shows it there. A move lands a
  // moment after it is asked for, so a second press in that moment steps on from where the first
  // one sent it rather than from where the row still appears.
  const sentTo = useRef<number | null>(null)
  useEffect(() => {
    if (idx === sentTo.current) { sentTo.current = null }
  }, [idx])

  const onHandleKeyDown = (event: React.KeyboardEvent) => {
    const step = ArrowSteps[event.key]
    if (disabled || fixed || step === undefined) { return }
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

export type PlaceProps = {
  /** Names the board, so a place refuses a piece dragged from a different board on the same page */
  boardkey: string
  /** What the caller calls this place; handed back when a piece is dropped on it */
  placekey: string
  disabled: boolean
}

export type Place = {
  /** The place: what a dragged piece is dropped on */
  placeRef: (elem: HTMLElement | null) => void
  /** A piece of this board is being dragged over this place */
  over:     boolean
}

/** How a piece came to move: dropped there, or sent by a key */
export type Placing = 'drop' | 'key'

export type PieceProps = PlaceProps & {
  /** What the caller calls this piece; handed back when it moves */
  piecekey:    string
  /** Told which piece moved, the place it was dropped on or sent to, and which of the two */
  onPlace:     (piecekey: string, placekey: string, placing: Placing) => void
  /** The place a key sends this piece to, once it has focus; null for a key that sends it nowhere */
  placeForKey: (key: string) => string | null
}

export type Piece = {
  /** The piece: what a drag begins from, what a drop on it lands in the place it sits in, and where the keys are heard */
  pieceRef:  (elem: HTMLElement | null) => void
  /** This is the piece being dragged, so it goes translucent */
  dragging:  boolean
  /** Another piece of this board is being dragged over this one */
  over:      boolean
  onPieceKeyDown: (event: React.KeyboardEvent) => void
}

/**
 * One place on a board of places that pieces are dragged between -- a slot of a wheel, a pool
 * beside it -- for the places no piece sits in. A piece is a place too (`usePiece`), so a drop on
 * a piece lands in the place it sits in.
 *
 * @param boardkey - Names the board.
 * @param placekey - Names this place on it.
 * @returns A ref for the place, and whether a piece is being dragged over it.
 *
 * @example const { placeRef, over } = usePlace({ boardkey: 'wheel', placekey: 'pool', disabled })
 */
export function usePlace({ boardkey, placekey, disabled }: Readonly<PlaceProps>): Place {
  const [placeElem, setPlaceElem] = useState<HTMLElement | null>(null)
  const [over, setOver] = useState(false)

  useEffect(() => {
    if (disabled || placeElem === null) { return }
    return placeTarget(placeElem, boardkey, placekey, setOver)
  }, [placeElem, boardkey, placekey, disabled])

  return { placeRef: setPlaceElem, over }
}

/**
 * One piece on a board of places, dragged from place to place, or sent by a key once it has
 * focus. The piece is a place as well, the one it sits in, so a piece dropped on another lands
 * where that one sits.
 *
 * Nothing moves until the drop, and the board is never rearranged here: the caller is told which
 * piece went to which place, and hands back the new arrangement, so what is on screen is always
 * what is held. What a drop means -- a swap, a send to the pool -- is the caller's to say.
 *
 * @param boardkey - Names the board.
 * @param piecekey - Names this piece.
 * @param placekey - Names the place this piece sits in.
 * @param onPlace - Told which piece was dropped, or sent by a key, where, and which it was.
 * @param placeForKey - Where each key sends this piece.
 * @returns A ref for the piece, what to draw while a drag is on, and its key handler.
 *
 * @example const { pieceRef, dragging, over, onPieceKeyDown } = usePiece({ boardkey: 'wheel', piecekey: 'tv', placekey: '15', disabled, onPlace, placeForKey })
 */
export function usePiece({ boardkey, piecekey, placekey, disabled, onPlace, placeForKey }: Readonly<PieceProps>): Piece {
  const [pieceElem, setPieceElem] = useState<HTMLElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [over, setOver] = useState(false)
  const place = useRef(onPlace)

  useEffect(() => { place.current = onPlace }, [onPlace])

  useEffect(() => {
    if (disabled || pieceElem === null) { return }
    return combine(
      draggable({
        element:        pieceElem,
        getInitialData: () => ({ boardkey, piecekey }),
        onDragStart:    () => { setDragging(true) },
        onDrop:         ({ location }) => {
          setDragging(false)
          const onto = location.current.dropTargets[0]
          const ontoKey = onto ? carriedPlacekey(onto.data, boardkey) : null
          if (ontoKey !== null) { place.current(piecekey, ontoKey, 'drop') }
        },
      }),
      placeTarget(pieceElem, boardkey, placekey, setOver),
    )
  }, [pieceElem, boardkey, piecekey, placekey, disabled])

  const onPieceKeyDown = (event: React.KeyboardEvent) => {
    const ontoKey = disabled ? null : placeForKey(event.key)
    if (ontoKey === null) { return }
    event.preventDefault()
    onPlace(piecekey, ontoKey, 'key')
  }

  return { pieceRef: setPieceElem, dragging, over, onPieceKeyDown }
}

/** `elem` made a place a piece of `boardkey` may be dropped on, saying so through `setOver` while one is over it; hands back how to undo it */
function placeTarget(elem: HTMLElement, boardkey: string, placekey: string, setOver: (over: boolean) => void): () => void {
  return dropTargetForElements({
    element:     elem,
    canDrop:     ({ source }) => source.data.boardkey === boardkey,
    getData:     () => ({ boardkey, placekey }),
    // A piece dragged over itself would stay where it is, so it is left unmarked.
    onDragEnter: ({ source }) => { setOver(source.element !== elem) },
    onDragLeave: () => { setOver(false) },
    onDrop:      () => { setOver(false) },
  })
}

/** The place a drop target names, when it is a place of the board `boardkey`; null when it is not */
function carriedPlacekey(bag: Record<string | symbol, unknown>, boardkey: string): string | null {
  return bag.boardkey === boardkey && typeof bag.placekey === 'string' ? bag.placekey : null
}
