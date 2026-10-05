'use client'

import { useId } from 'react'
import { Checkbox, IconButton, Stack, Tooltip, useMediaQuery } from '@mui/material'
import ChecklistIcon from '@mui/icons-material/Checklist'
import clsx from 'clsx'
import { GutterWidthPx, gridWidthPx, type ColumnSpec, type Headkind } from '../lib/columns'
import { FoldButton } from './FoldButton'
import { QuestionRow, alignClassOf } from './QuestionRow'
import { useFolds } from './use-folds'
import { useSettledResize } from './use-settled-resize'
import type { QuizRun } from '../lib/formulary/runner'
import type { QuestionPatch, QuestionT } from '../models/question'
import type { EntryValueT } from '../models/widget'
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
  /** The quiz, run: what each widgeting came to for each question */
  run:          QuizRun
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
  /** Whether an ask for one question's cell of one widgeting is in flight */
  asking:       (question_id: string, widgeting_label: string) => boolean
  /** Why the widgeting labelled so cannot be asked at all, when it cannot; null when it can */
  unavailableNotice: (widgeting_label: string) => string | null
  /** Ask the widgeting labelled so about one question */
  onAsk:        (question_id: string, widgeting_label: string) => void
  onEdit:       (question_id: string, patch: QuestionPatch) => void
  /** Put what was typed into one question's cell of the entry widgeting labelled so; null empties it */
  onEnter:      (question_id: string, widgeting_label: string, value: EntryValueT | null) => void
  /** Told which question moved, and the index it lands on once it has been lifted out */
  onMove:       (question_id: string, onto_idx: number) => void
}

/** Where the grid becomes one card per question, as `workbench.module.css` restructures it */
const CardLayoutQuery = '(max-width:640px)'

/**
 * The grid: one row per question, scrolling sideways inside its own container.
 *
 * Its top-left corner folds every row to one line, or unfolds them all when none is open; entering
 * a text box opens that row alone. The questions there when it opens start folded, and one added
 * later starts open. It holds this as its own state, so its owner keys it by the quiz. As cards,
 * below 640px, every question shows in full: the corner is not there to unfold them.
 */
export function QuestionTable({ questions, specs, run, locked, gripShown, batching, onBatch, isChecked, onCheck, onCheckAll, onDelete, lastSortkey, sortMark, onSort, onChain, asking, unavailableNotice, onAsk, onEdit, onEnter, onMove }: Readonly<QuestionTableProps>) {
  const resizeToken = useSettledResize()
  const checkedCount = questions.filter((question) => isChecked(question._id)).length
  const folds = useFolds(questions.map((question) => question._id))
  const carded = useMediaQuery(CardLayoutQuery)
  const bodyId = useId()

  return (
    <div className={styles.scroller}>
      <table className={styles.grid} aria-label="Questions" style={{ width: `${String(gridWidthPx(specs))}px` }}>
        <thead>
          <tr>
            <th scope="col" className={clsx(styles.head, styles.headCorner)} style={{ width: `${String(GutterWidthPx)}px` }}>
              <Stack sx={{ alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
                <Tooltip title={folds.anyOpen ? 'Fold every question to one line' : 'Show every question in full'}>
                  <FoldButton open={folds.anyOpen} onOpenChange={folds.setAllOpen} label="Show questions in full" controls={bodyId} />
                </Tooltip>
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
              </Stack>
            </th>
            {specs.map((column) => {
              const sortkey = column.sortkey ?? null
              return (
                <th
                  key={column.colkey}
                  scope="col"
                  className={clsx(styles.head, headClassOf(column.headkind), alignClassOf(column.align), sortkey !== null && sortkey === lastSortkey && styles.headSorted)}
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
        <tbody id={bodyId}>
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
              folded={! carded && folds.isFolded(question._id)}
              onUnfold={() => { folds.unfold(question._id) }}
              idx={idx}
              count={questions.length}
              onMove={onMove}
              onChain={(chains_to) => { onChain(question._id, chains_to) }}
              specs={specs}
              run={run}
              asking={(widgeting_label) => asking(question._id, widgeting_label)}
              unavailableNotice={unavailableNotice}
              onAsk={(widgeting_label) => { onAsk(question._id, widgeting_label) }}
              onAskTarget={(widgeting_label) => {
                if (question.chains_to !== null) { onAsk(question.chains_to, widgeting_label) }
              }}
              onEdit={(patch) => { onEdit(question._id, patch) }}
              onEnter={(widgeting_label, value) => { onEnter(question._id, widgeting_label, value) }}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Extra class for a header that is rotated */
function headClassOf(headkind: Headkind): string | undefined {
  return headkind === 'vertical' ? styles.headVertical : undefined
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
