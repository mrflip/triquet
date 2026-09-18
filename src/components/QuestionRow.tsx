'use client'

import { useCallback, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Columns, type Colkey } from './columns'
import { GrowingField, PlainField, QnumField, StretchField } from './cells/fields'
import { AskableCell, ReadonlyCell, SumReadout } from './cells/readouts'
import { CellNotices } from '../lib/notices'
import type { QuestionPatch, QuestionT } from '../models/question'
import styles from './workbench.module.css'

/** Tallest a row may grow before its Clueing and Hint boxes scroll internally instead */
export const RowCapPx = 480

/** Shortest a row may be, so an empty round still reads as a grid */
export const RowFloorPx = 56

export type QuestionRowProps = {
  question:    QuestionT
  locked:      boolean
  gripShown:   boolean
  resizeToken: number
  /** This is the question being dragged, so it goes translucent */
  dragging:    boolean
  /** The dragged question would land here, so this row takes an accent line along its top */
  dropTarget:  boolean
  onDragBegin: () => void
  onDragOver:  () => void
  onDrop:      () => void
  onDragEnd:   () => void
  onEdit:      (patch: QuestionPatch) => void
}

/**
 * One question, across every column.
 *
 * The Clueing and Hint boxes grow with their own content and the taller of the two sets the
 * height for both, capped; the notes columns are stretched to that same height but never get a
 * say in it, and the ishes columns are capped at it and scroll.
 */
export function QuestionRow({ question, locked, gripShown, resizeToken, dragging, dropTarget, onDragBegin, onDragOver, onDrop, onDragEnd, onEdit }: Readonly<QuestionRowProps>) {
  const [clueingNaturalPx, setClueingNaturalPx] = useState(RowFloorPx)
  const [hintNaturalPx, setHintNaturalPx] = useState(RowFloorPx)

  const heightPx = Math.min(Math.max(clueingNaturalPx, hintNaturalPx, RowFloorPx), RowCapPx)

  const commit = useCallback((patch: QuestionPatch) => { onEdit(patch) }, [onEdit])
  const widths = useMemo(() => Object.fromEntries(Columns.map((column) => [column.colkey, column])), [])

  const cell = (colkey: Colkey, body: React.ReactNode) => {
    const column = widths[colkey]
    const isCollapsedGrip = colkey === 'grip' && ! gripShown
    return (
      <td
        key={colkey}
        className={clsx(styles.cell, isCollapsedGrip && styles.gripCollapsed)}
        style={{ width: `${String(column?.widthPx ?? 0)}px` }}
        data-colname={column?.title}
      >
        {isCollapsedGrip ? null : body}
      </td>
    )
  }

  const draggable = gripShown && ! locked

  return (
    <tr
      className={clsx(dragging && styles.rowDragging, dropTarget && styles.rowDropTarget)}
      onDragOver={(event) => {
        if (! draggable) { return }
        event.preventDefault()
        onDragOver()
      }}
      onDrop={(event) => {
        if (! draggable) { return }
        event.preventDefault()
        onDrop()
      }}
    >
      {cell('grip', (
        <div
          className={clsx(styles.grip, locked && styles.gripLocked)}
          draggable={draggable}
          role="button"
          tabIndex={draggable ? 0 : -1}
          aria-label={`Reorder ${question.short_answer || 'this question'}`}
          onDragStart={onDragBegin}
          onDragEnd={onDragEnd}
        >
          ⠿
        </div>
      ))}
      {cell('clueing', (
        <GrowingField
          label="Clueing" committed={question.clueing} locked={locked}
          onCommit={(clueing) => { commit({ clueing }) }}
          heightPx={heightPx} onNatural={setClueingNaturalPx} resizeToken={resizeToken}
        />
      ))}
      {cell('hint', (
        <GrowingField
          label="Hint" committed={question.hint} locked={locked}
          onCommit={(hint) => { commit({ hint }) }}
          heightPx={heightPx} onNatural={setHintNaturalPx} resizeToken={resizeToken}
        />
      ))}
      {cell('short_answer', (
        <PlainField
          label="Short answer" committed={question.short_answer} locked={locked}
          onCommit={(short_answer) => { commit({ short_answer }) }}
        />
      ))}
      {cell('chains_to', <span className={styles.muted}>{CellNotices.chainUnset}</span>)}
      {cell('butnot', <ReadonlyCell heightPx={heightPx}><span className={styles.muted}>{CellNotices.butnotNoChain}</span></ReadonlyCell>)}
      {cell('qnum', (
        <QnumField label="Q#" committed={question.qnum} locked={locked} onCommit={(qnum) => { commit({ qnum }) }} />
      ))}
      {SumColkeys.map((colkey) => cell(colkey, <div className={styles.sum}><SumReadout total={null} stale={false} /></div>))}
      {cell('alt_text', (
        <StretchField
          label="Alt Text" committed={question.alt_text} locked={locked}
          onCommit={(alt_text) => { commit({ alt_text }) }} heightPx={heightPx}
        />
      ))}
      {cell('notes', (
        <StretchField
          label="Notes" committed={question.notes} locked={locked}
          onCommit={(notes) => { commit({ notes }) }} heightPx={heightPx}
        />
      ))}
      {cell('full_answer', (
        <StretchField
          label="Full Answer" committed={question.full_answer} locked={locked}
          onCommit={(full_answer) => { commit({ full_answer }) }} heightPx={heightPx}
        />
      ))}
      {cell('clueing_ishes', (
        <AskableCell label="Clueing ishes" locked={locked} heightPx={heightPx} onAsk={noAskYet}>
          <span className={styles.muted}>{CellNotices.askable}</span>
        </AskableCell>
      ))}
      {cell('butnot_ishes', (
        <ReadonlyCell heightPx={heightPx}><span className={styles.muted}>{CellNotices.butnotNoChain}</span></ReadonlyCell>
      ))}
      {cell('hint_ishes', (
        <AskableCell label="Hint Ishes" locked={locked} heightPx={heightPx} onAsk={noAskYet}>
          <span className={styles.muted}>{CellNotices.askable}</span>
        </AskableCell>
      ))}
      {cell('guess', (
        <AskableCell label="Quick-model guess" locked={locked} heightPx={heightPx} onAsk={noAskYet}>
          <span className={styles.muted}>{CellNotices.askable}</span>
        </AskableCell>
      ))}
    </tr>
  )
}

/** M4 and M5 wire these up; until then an askable cell has nothing to ask for. */
function noAskYet() { /* nothing to ask yet */ }

/** The eight derived numeric columns, in the order they appear */
const SumColkeys: readonly Colkey[] = [
  'clueing_plus_rank', 'clueing_full', 'clueing_numeral',
  'butnot_full', 'butnot_numeral', 'hint_full', 'hint_numeral', 'clueing_plus_butnot_full',
]
