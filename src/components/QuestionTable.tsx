'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { Columns, GridWidthPx, type Headkind } from './columns'
import { QuestionRow } from './QuestionRow'
import { useSettledResize } from './use-settled-resize'
import type { QuestionPatch, QuestionT } from '../models/question'
import type { Sortkey } from '../models/quiz'
import styles from './workbench.module.css'

export type SortMark = {
  sortkey:    Sortkey
  descending: boolean
}

export type QuestionTableProps = {
  questions:    QuestionT[]
  locked:       boolean
  /** The grip column only takes up space while the round is in Q# order */
  gripShown:    boolean
  /** Which column the round was last committed to, bold across reloads as a reminder */
  lastSortkey:  Sortkey | null
  /** Which column was sorted in this session, and which way; the only thing an arrow marks */
  sortMark:     SortMark | null
  onSort:       (sortkey: Sortkey) => void
  onChain:      (question_id: string, chains_to: string | null) => void
  onEdit:       (question_id: string, patch: QuestionPatch) => void
  onDrag:       (question_id: string, onto_idx: number) => void
}

/** The grid: one row per question, scrolling sideways inside its own container */
export function QuestionTable({ questions, locked, gripShown, lastSortkey, sortMark, onSort, onChain, onEdit, onDrag }: Readonly<QuestionTableProps>) {
  const resizeToken = useSettledResize()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const settle = (onto_idx: number) => {
    if (draggingId !== null) { onDrag(draggingId, onto_idx) }
    setDraggingId(null)
    setOverIdx(null)
  }

  return (
    <div className={styles.scroller}>
      <table className={styles.grid} style={{ width: `${String(GridWidthPx)}px` }}>
        <thead>
          <tr>
            {Columns.map((column) => {
              const sortkey = column.sortkey ?? null
              return (
                <th
                  key={column.colkey}
                  scope="col"
                  className={clsx(styles.head, headClassOf(column.headkind), sortkey !== null && sortkey === lastSortkey && styles.headSorted)}
                  style={{ width: `${String(column.widthPx)}px` }}
                  aria-sort={ariaSortFor(sortkey, sortMark)}
                >
                  {sortkey === null ? column.title : (
                    <button type="button" className={styles.headButton} disabled={locked} onClick={() => { onSort(sortkey) }}>
                      {column.title}{arrowFor(sortkey, sortMark)}
                    </button>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {questions.map((question, ii) => (
            <QuestionRow
              key={question.id}
              question={question}
              questions={questions}
              locked={locked}
              gripShown={gripShown}
              resizeToken={resizeToken}
              dragging={draggingId === question.id}
              dropTarget={overIdx === ii && draggingId !== null && draggingId !== question.id}
              onDragBegin={() => { setDraggingId(question.id) }}
              onDragOver={() => { setOverIdx(ii) }}
              onDrop={() => { settle(ii) }}
              onDragEnd={() => { setDraggingId(null); setOverIdx(null) }}
              onChain={(chains_to) => { onChain(question.id, chains_to) }}
              onEdit={(patch) => { onEdit(question.id, patch) }}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Extra class for a header that is rotated, or centred and allowed to wrap */
function headClassOf(headkind: Headkind): string | undefined {
  if (headkind === 'vertical') { return styles.headVertical }
  return headkind === 'centered' ? styles.headCentered : undefined
}

/** The arrow marking the column sorted in this session -- not the one the round remembers */
function arrowFor(sortkey: Sortkey, sortMark: SortMark | null): string {
  if (sortMark?.sortkey !== sortkey) { return '' }
  return sortMark.descending ? ' ↓' : ' ↑'
}

/** What a screen reader is told about this column's part in the current order */
function ariaSortFor(sortkey: Sortkey | null, sortMark: SortMark | null): 'ascending' | 'descending' | 'none' | undefined {
  if (sortkey === null) { return undefined }
  if (sortMark?.sortkey !== sortkey) { return 'none' }
  return sortMark.descending ? 'descending' : 'ascending'
}
