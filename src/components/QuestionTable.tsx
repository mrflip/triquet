'use client'

import { Checkbox, IconButton, Stack, Tooltip } from '@mui/material'
import ChecklistIcon from '@mui/icons-material/Checklist'
import clsx from 'clsx'
import { GutterWidthPx, gridWidthPx, type ColumnSpec, type Headkind } from '../lib/columns'
import { QuestionRow } from './QuestionRow'
import { useSettledResize } from './use-settled-resize'
import type { ExpressedForQuiz } from '../lib/expressed'
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
  /** The quiz's columns, in the order they appear */
  specs:        ColumnSpec[]
  /** What each computed column came to for each question */
  expressed:    ExpressedForQuiz
  locked:       boolean
  /** Grips are offered only while the quiz is in Q# order */
  gripShown:    boolean
  /** Batch mode: each row shows a checkbox and trash can in place of its grip */
  batching:     boolean
  /** Enter or leave batch mode, from the grid's top-left corner */
  onBatch:      (on: boolean) => void
  isChecked:    (question_id: string) => boolean
  onCheck:      (question_id: string, on: boolean) => void
  /** Check every question, or none */
  onCheckAll:   (on: boolean) => void
  /** Asks to delete one question; the asking-first is the caller's */
  onDelete:     (question_id: string) => void
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
  /** Told which question moved, and the index it lands on once it has been lifted out */
  onMove:       (question_id: string, onto_idx: number) => void
}

/** The grid: one row per question, scrolling sideways inside its own container */
export function QuestionTable({ questions, specs, expressed, locked, gripShown, batching, onBatch, isChecked, onCheck, onCheckAll, onDelete, lastSortkey, sortMark, onSort, onChain, asking, unavailableNotice, onAsk, onEdit, onMove }: Readonly<QuestionTableProps>) {
  const resizeToken = useSettledResize()
  const checkedCount = questions.filter((question) => isChecked(question._id)).length

  return (
    <div className={styles.scroller}>
      <table className={styles.grid} aria-label="Questions" style={{ width: `${String(gridWidthPx(specs))}px` }}>
        <thead>
          <tr>
            <th scope="col" className={styles.head} style={{ width: `${String(GutterWidthPx)}px` }}>
              <Stack sx={{ alignItems: 'center' }}>
                {/* The span lets the tooltip hear the pointer while the button is disabled. */}
                <Tooltip title={batching ? 'Done selecting' : 'Select questions to delete'}>
                  <span>
                    <IconButton
                      size="small" sx={{ p: 0.25 }} color={batching ? 'primary' : 'default'}
                      disabled={locked} aria-label="Batch select" aria-pressed={batching}
                      onClick={() => { onBatch(! batching) }}
                    >
                      <ChecklistIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                {batching && (
                  <Checkbox
                    size="small" sx={{ p: 0.25 }}
                    checked={checkedCount > 0 && checkedCount === questions.length}
                    indeterminate={checkedCount > 0 && checkedCount < questions.length}
                    slotProps={{ input: { 'aria-label': 'Select all questions' } }}
                    onChange={(event) => { onCheckAll(event.target.checked) }}
                  />
                )}
              </Stack>
            </th>
            {specs.map((column) => {
              const sortkey = column.sortkey ?? null
              return (
                <th
                  key={column.colkey}
                  scope="col"
                  className={clsx(styles.head, headClassOf(column.headkind), sortkey !== null && sortkey === lastSortkey && styles.headSorted)}
                  data-sorted={(sortkey !== null && sortkey === lastSortkey) || undefined}
                  style={{ width: `${String(column.widthPx)}px` }}
                  aria-sort={ariaSortFor(sortkey, sortMark)}
                >
                  <span className={clsx(column.headkind === 'vertical' && styles.headVerticalInner)}>
                    {sortkey === null ? column.title : (
                      <button type="button" className={styles.headButton} disabled={locked} onClick={() => { onSort(sortkey) }}>
                        {column.title}
                        {/* Decorative: the direction is already on the header as aria-sort, and
                            folding the arrow into the button's name would rename it on every click. */}
                        <span className={styles.headArrow} aria-hidden="true">{arrowFor(sortkey, sortMark)}</span>
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
              key={question._id}
              question={question}
              questions={questions}
              locked={locked}
              gripShown={gripShown}
              checked={batching ? isChecked(question._id) : null}
              onCheck={(on) => { onCheck(question._id, on) }}
              onDelete={() => { onDelete(question._id) }}
              resizeToken={resizeToken}
              idx={idx}
              count={questions.length}
              onMove={onMove}
              onChain={(chains_to) => { onChain(question._id, chains_to) }}
              specs={specs}
              expressed={expressed}
              asking={(askkind) => asking(question._id, askkind)}
              unavailableNotice={unavailableNotice}
              onAsk={(askkind) => { onAsk(question, askkind) }}
              onAskTarget={(askkind) => {
                const target = questions.find((other) => other._id === question.chains_to)
                if (target) { onAsk(target, askkind) }
              }}
              onEdit={(patch) => { onEdit(question._id, patch) }}
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
  return sortMark.descending ? '↓' : '↑'
}

/** What a screen reader is told about this column's part in the current order */
function ariaSortFor(sortkey: Sortkey | null, sortMark: SortMark | null): 'ascending' | 'descending' | 'none' | undefined {
  if (sortkey === null) { return undefined }
  if (sortMark?.sortkey !== sortkey) { return 'none' }
  return sortMark.descending ? 'descending' : 'ascending'
}
