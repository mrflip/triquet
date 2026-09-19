'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { Columns, GridWidthPx, type Headkind } from './columns'
import { QuestionRow } from './QuestionRow'
import { useSettledResize } from './use-settled-resize'
import * as Sums from '../lib/sums'
import type { Askkind } from '../state/use-asking'
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
  /** The grip column only takes up space while the quiz is in Q# order */
  gripShown:    boolean
  /** Which column the quiz was last committed to, bold across reloads as a reminder */
  lastSortkey:  Sortkey | null
  /** Which column was sorted in this session, and which way; the only thing an arrow marks */
  sortMark:     SortMark | null
  onSort:       (sortkey: Sortkey) => void
  onChain:      (question_id: string, chains_to: string | null) => void
  asking:       (question_id: string, askkind: Askkind) => boolean
  /** Why a kind of ask cannot be made at all, when it cannot; null when it can */
  unavailableNotice: (askkind: Askkind) => string | null
  onAsk:        (question: QuestionT, askkind: Askkind) => void
  onEdit:       (question_id: string, patch: QuestionPatch) => void
  onDrag:       (question_id: string, onto_idx: number) => void
}

/** The grid: one row per question, scrolling sideways inside its own container */
export function QuestionTable({ questions, locked, gripShown, lastSortkey, sortMark, onSort, onChain, asking, unavailableNotice, onAsk, onEdit, onDrag }: Readonly<QuestionTableProps>) {
  const resizeToken = useSettledResize()
  // Derived on demand and stored nowhere, so a sum is never out of step with its extraction.
  const sums = Sums.sumsForQuiz(questions)
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
                  <span className={clsx(column.headkind === 'vertical' && styles.headVerticalInner)}>
                    {sortkey === null ? column.title : (
                      <button type="button" className={styles.headButton} disabled={locked} onClick={() => { onSort(sortkey) }}>
                        {column.title}
                        {/* Decorative: the direction is already on the header as aria-sort, and
                            folding the arrow into the button's name would rename it on every click. */}
                        <span aria-hidden="true">{arrowFor(sortkey, sortMark)}</span>
                      </button>
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {questions.map((question, idx) => (
            <QuestionRow
              key={question.id}
              question={question}
              questions={questions}
              locked={locked}
              gripShown={gripShown}
              resizeToken={resizeToken}
              dragging={draggingId === question.id}
              dropTarget={overIdx === idx && draggingId !== null && draggingId !== question.id}
              onDragBegin={() => { setDraggingId(question.id) }}
              onDragOver={() => { setOverIdx(idx) }}
              onDrop={() => { settle(idx) }}
              onDragEnd={() => { setDraggingId(null); setOverIdx(null) }}
              onChain={(chains_to) => { onChain(question.id, chains_to) }}
              sums={sums.get(question.id) ?? Sums.EmptySums}
              asking={(askkind) => asking(question.id, askkind)}
              unavailableNotice={unavailableNotice}
              onAsk={(askkind) => { onAsk(question, askkind) }}
              onAskTarget={(askkind) => {
                const target = questions.find((other) => other.id === question.chains_to)
                if (target) { onAsk(target, askkind) }
              }}
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

/** The arrow marking the column sorted in this session -- not the one the quiz remembers */
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
