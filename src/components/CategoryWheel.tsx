'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Box, Paper, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import * as Wheel from '../lib/wheel'
import { Category, CategoryLabelVals, type CategoryLabel, type WheelT } from '../models/category'
import { usePiece, usePlace, type Placing } from './use-reorder'
import { poolHeightOf, poolSpotOf, spotOf, WheelGeometry, type Spot } from './wheel-geometry'
import styles from './workbench.module.css'

/** The narrowest the wheel is drawn, in pixels, so a tile's title stays legible: a narrower box scrolls it sideways */
const WheelWidthMin = 560

/** The slots whose tiles the dashed lines join: two triangles, and the two ends of a diameter marked at the rim */
const Triangles = [[0, 8, 16], [4, 12, 20]] as const
const Diameter = [6, 18] as const

/** Something drawn outside the ring, beside a slot: what sits at a triangle's corner */
export type WheelAdornment = {
  /** Which slot it sits beside */
  slotIdx: number
  node:    ReactNode
}

export type CategoryWheelProps = {
  /** The hunt's wheel, holes and all */
  wheel:      WheelT
  /** What the wheel is called to a screen reader */
  title:      string
  /**
   * Told each rearrangement, which makes the wheel an editor: its tiles drag between slots and
   * the pool shown beneath it, and answer the keys. Null shows the total order, read-only.
   */
  onArrange:  ((wheel: WheelT) => void) | null
  /** Drawn outside the ring, each beside its slot */
  outside?:   readonly WheelAdornment[]
}

/**
 * The hunt's subject categories round a wheel, clockwise from the top, with the dashed lines
 * that mark its triangles, and room outside the ring for what sits beside a slot.
 *
 * Read-only, it shows the total order: every slot filled. As an editor it shows the wheel as
 * stored, an empty slot marked with the category the total order would put there, and the pool
 * beneath. A tile dragged onto another slot swaps with whatever is there, so a tile from the pool
 * sends that slot's tile to the pool; dragged into the pool, it leaves its slot empty. A tile on
 * the wheel double-clicked goes to the pool, and one in the pool double-clicked goes to the next
 * empty slot clockwise. The arrow keys move a focused tile round the wheel, Delete sends it to
 * the pool, and Enter brings a pool tile to the next empty slot as a double-click does.
 */
export function CategoryWheel({ wheel, title, onArrange, outside = [] }: Readonly<CategoryWheelProps>) {
  const hintId = useId()
  const editing = onArrange !== null
  const pool = editing ? Wheel.poolOf(wheel) : []
  const stageHt = editing ? 100 + WheelGeometry.poolGap + poolHeightOf(pool.length) : 100

  return (
    <Box>
      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ containerType: 'inline-size', width: '100%', minWidth: WheelWidthMin, maxWidth: 760, mx: 'auto' }}>
          <Box sx={{ position: 'relative', height: `${String(stageHt)}cqi` }}>
            <Ground />
            <Spokes />
            {/* The tiles' own box holds nothing else, so the list a reader is told of holds only them */}
            <Box role={editing ? 'group' : 'list'} aria-label={title} aria-describedby={editing ? hintId : undefined} sx={{ position: 'absolute', inset: 0 }}>
              {editing
                ? <Board wheel={wheel} pool={pool} onArrange={onArrange} />
                : Wheel.orderOf(wheel).map((label, idx) => <ShownTile key={label} label={label} slotIdx={idx} />)}
            </Box>
            {outside.map(({ slotIdx, node }) => (
              <Box key={slotIdx} sx={{ ...atSpot(spotOf(slotIdx, WheelGeometry.outsideRadius)) }}>{node}</Box>
            ))}
          </Box>
        </Box>
      </Box>
      {editing && (
        <p id={hintId} className={styles.microcopy}>
          Drag a category onto another slot to swap the two, or into the pool to take it off the
          wheel; each empty slot takes the first category left in the pool. Double-click a category
          to send it to the pool, or one in the pool to put it in the next empty slot clockwise.
          From the keyboard, the arrow keys move a category round the wheel, Delete sends it to the
          pool, and Enter brings one back from the pool.
        </p>
      )}
    </Box>
  )
}

/** The pieces of the editor: a tile for every category, on the wheel or in the pool, and the places a tile can be dropped */
function Board({ wheel, pool, onArrange }: Readonly<{ wheel: WheelT, pool: readonly CategoryLabel[], onArrange: (wheel: WheelT) => void }>) {
  const boardkey = useId()
  const stage = useRef<HTMLDivElement>(null)
  const order = Wheel.orderOf(wheel)
  // The tile a key just moved, to keep focus on once it is drawn in its new place: moving
  // between the wheel and the pool draws it anew.
  const keyed = useRef<CategoryLabel | null>(null)
  // The slot a tile from the pool last went to: the next one brought back goes to the empty slot
  // clockwise after it, so a run of them fills the holes in turn round the wheel.
  const [filledIdx, setFilledIdx] = useState<number | null>(null)

  useEffect(() => {
    if (keyed.current === null) { return }
    stage.current?.querySelector<HTMLElement>(`[data-category="${CSS.escape(keyed.current)}"]`)?.focus()
    keyed.current = null
  }, [wheel])

  const place = (piecekey: string, placekey: string, placing: Placing | 'doubleClick') => {
    const label = CategoryLabelVals.find((each) => each === piecekey)
    if (label === undefined) { return }
    const onto = placekey === PoolPlacekey ? 'pool' : Number(placekey)
    const placedWheel = Wheel.placed(wheel, label, onto)
    if (placedWheel === wheel) { return }
    if (placing === 'key') { keyed.current = label }
    if (onto !== 'pool' && ! wheel.includes(label)) { setFilledIdx(onto) }
    onArrange(placedWheel)
  }
  const nextEmptyIdx = Wheel.nextEmptyIdxOf(wheel, filledIdx)
  const nextEmptyPlacekey = nextEmptyIdx === null ? null : String(nextEmptyIdx)

  return (
    <Box ref={stage}>
      <Pool count={pool.length} boardkey={boardkey} />
      {wheel.map((label, idx) => (label === null
        ? <EmptySlot key={`slot-${String(idx)}`} slotIdx={idx} filling={order[idx] ?? null} boardkey={boardkey} />
        : <Tile key={label} label={label} spot={spotOf(idx, WheelGeometry.ringRadius)} placekey={String(idx)} boardkey={boardkey} onPlace={place} placeForKey={(key) => ringKeyPlace(key, idx)} doubleClickPlace={PoolPlacekey} where={`slot ${String(idx + 1)}`} />
      ))}
      {pool.map((label, rank) => (
        <Tile key={label} label={label} spot={poolSpotOf(rank, pool.length)} placekey={PoolPlacekey} boardkey={boardkey} onPlace={place} placeForKey={(key) => poolKeyPlace(key, nextEmptyPlacekey)} doubleClickPlace={nextEmptyPlacekey} where="in the pool" />
      ))}
    </Box>
  )
}

/** What a place on the editor's board is called when it is the pool; a slot is called by its index */
const PoolPlacekey = 'pool'

/** Where a key sends a tile in the slot `slotIdx`: round the wheel either way, or to the pool */
function ringKeyPlace(key: string, slotIdx: number): string | null {
  const [prevIdx, , nextIdx] = Wheel.around(slotIdx, 1)
  switch (key) {
  case 'ArrowRight': case 'ArrowDown': { return String(nextIdx) }
  case 'ArrowLeft':  case 'ArrowUp':   { return String(prevIdx) }
  case 'Delete':     case 'Backspace': { return PoolPlacekey }
  default:                             { return null }
  }
}

/** Where a key sends a tile in the pool: Enter or Space, to the next empty slot, `nextEmptyPlacekey` */
function poolKeyPlace(key: string, nextEmptyPlacekey: string | null): string | null {
  return key === 'Enter' || key === ' ' ? nextEmptyPlacekey : null
}

type TileProps = {
  label:            CategoryLabel
  spot:             Spot
  placekey:         string
  boardkey:         string
  onPlace:          (piecekey: string, placekey: string, placing: Placing | 'doubleClick') => void
  placeForKey:      (key: string) => string | null
  /** The place a double-click sends the tile to; null when it sends it nowhere */
  doubleClickPlace: string | null
  /** Where the tile sits, as a screen reader is told */
  where:            string
}

/** One category's tile in the editor: dragged, dropped on, moved by the keys, and sent on by a double-click */
function Tile({ label, spot, placekey, boardkey, onPlace, placeForKey, doubleClickPlace, where }: Readonly<TileProps>) {
  const { pieceRef, dragging, over, onPieceKeyDown } = usePiece({ boardkey, piecekey: label, placekey, disabled: false, onPlace, placeForKey })
  return (
    <Paper
      ref={pieceRef}
      variant="outlined"
      role="button"
      tabIndex={0}
      aria-label={`${Category.titleOf(label)}, ${where}`}
      aria-roledescription="category"
      data-category={label}
      data-place={placekey}
      onKeyDown={onPieceKeyDown}
      onDoubleClick={() => { if (doubleClickPlace !== null) { onPlace(label, doubleClickPlace, 'doubleClick') } }}
      sx={{ ...tileSx(spot), cursor: 'grab', opacity: dragging ? 0.4 : 1, ...(over && OverSx), '&:focus-visible': FocusSx }}
    >
      {Category.titleOf(label)}
    </Paper>
  )
}

/** One category's tile on a read-only wheel */
function ShownTile({ label, slotIdx }: Readonly<{ label: CategoryLabel, slotIdx: number }>) {
  return (
    <Paper variant="outlined" role="listitem" aria-label={`${String(slotIdx + 1)}. ${Category.titleOf(label)}`} data-category={label} data-place={String(slotIdx)} sx={tileSx(spotOf(slotIdx, WheelGeometry.ringRadius))}>
      {Category.titleOf(label)}
    </Paper>
  )
}

/** A slot no category holds, marked with the one the total order puts there, which a tile can be dropped in */
function EmptySlot({ slotIdx, filling, boardkey }: Readonly<{ slotIdx: number, filling: CategoryLabel | null, boardkey: string }>) {
  const { placeRef, over } = usePlace({ boardkey, placekey: String(slotIdx), disabled: false })
  return (
    <Box
      ref={placeRef}
      data-place={String(slotIdx)}
      data-empty=""
      aria-label={filling === null ? `Empty slot ${String(slotIdx + 1)}` : `Empty slot ${String(slotIdx + 1)}, taken by ${Category.titleOf(filling)} in the total order`}
      sx={{ ...tileSx(spotOf(slotIdx, WheelGeometry.ringRadius)), border: 2, borderStyle: 'dashed', borderColor: 'divider', bgcolor: 'transparent', color: 'text.secondary', fontStyle: 'italic', ...(over && OverSx) }}
    >
      {filling !== null && Category.titleOf(filling)}
    </Box>
  )
}

/** The pool beneath the wheel: where the categories no slot holds sit, and a tile is dropped to take it off the wheel */
function Pool({ count, boardkey }: Readonly<{ count: number, boardkey: string }>) {
  const { placeRef, over } = usePlace({ boardkey, placekey: PoolPlacekey, disabled: false })
  return (
    <Box
      ref={placeRef}
      role="region"
      aria-label="Pool"
      data-place={PoolPlacekey}
      sx={{
        position:     'absolute',
        left:         0,
        top:          `${String(100 + WheelGeometry.poolGap)}cqi`,
        width:        '100cqi',
        height:       `${String(poolHeightOf(count))}cqi`,
        borderRadius: 'var(--radius-container)',
        bgcolor:      'var(--surface-sunk)',
        border:       1,
        borderColor:  'divider',
        ...(over && OverSx),
      }}
    >
      <Typography variant="overline" sx={{ position: 'absolute', left: '2cqi', top: '0.5cqi', color: 'text.secondary', lineHeight: 2 }}>Pool</Typography>
      {count === 0 && (
        <Typography variant="body2" sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'text.secondary', pt: '3cqi' }}>
          Drag a category here to take it off the wheel.
        </Typography>
      )}
    </Box>
  )
}

/** The disc the tiles sit on */
function Ground() {
  const { groundRadius } = WheelGeometry
  return (
    <Box
      aria-hidden
      sx={{
        position:     'absolute',
        left:         `${String(50 - groundRadius)}cqi`,
        top:          `${String(50 - groundRadius)}cqi`,
        width:        `${String(2 * groundRadius)}cqi`,
        height:       `${String(2 * groundRadius)}cqi`,
        borderRadius: '50%',
        bgcolor:      (theme) => alpha(theme.palette.secondary.main, 0.14),
      }}
    />
  )
}

/** The dashed lines across the wheel: its two triangles, and a diameter marked at the rim */
function Spokes() {
  const { ringRadius, tileSide } = WheelGeometry
  const corners = (slots: readonly number[]) => slots.map((idx) => spotOf(idx, ringRadius)).map(({ xx, yy }) => `${String(xx)},${String(yy)}`).join(' ')
  const rimMarks = Diameter.map((idx) => [spotOf(idx, ringRadius - (tileSide / 2)), spotOf(idx, ringRadius - (tileSide * 1.4))] as const)
  return (
    <Box component="svg" aria-hidden viewBox="0 0 100 100" sx={{ position: 'absolute', left: 0, top: 0, width: '100cqi', height: '100cqi', pointerEvents: 'none', fill: 'none', strokeWidth: 0.3, strokeDasharray: '1 0.8' }}>
      <Box component="polygon" points={corners(Triangles[0])} sx={{ stroke: 'var(--good)' }} />
      <Box component="polygon" points={corners(Triangles[1])} sx={{ stroke: 'var(--accent)' }} />
      {rimMarks.map(([from, onto]) => (
        <Box component="line" key={from.xx} x1={from.xx} y1={from.yy} x2={onto.xx} y2={onto.yy} sx={{ stroke: 'var(--muted)' }} />
      ))}
    </Box>
  )
}

/** A dragged tile is over this place */
const OverSx = { outline: 2, outlineStyle: 'solid', outlineColor: 'secondary.main', outlineOffset: 1 } as const

/** The focus ring a tile shows to the keyboard */
const FocusSx = { outline: '2px solid var(--highlight)', outlineOffset: 2 } as const

/** Centred on `spot` */
function atSpot({ xx, yy }: Spot) {
  return { position: 'absolute', left: `${String(xx)}cqi`, top: `${String(yy)}cqi`, transform: 'translate(-50%, -50%)' } as const
}

/** A tile centred on `spot`, its title wrapping to fit */
function tileSx(spot: Spot) {
  const side = `${String(WheelGeometry.tileSide)}cqi`
  return {
    ...atSpot(spot),
    width:          side,
    height:         side,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    textAlign:      'center',
    p:              '0.3cqi',
    fontSize:       'clamp(8px, 1.55cqi, 13px)',
    lineHeight:     1.15,
    overflowWrap:   'break-word',
    hyphens:        'auto',
    borderRadius:   1,
    userSelect:     'none',
  } as const
}
