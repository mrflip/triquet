'use client'

import { useId, useMemo } from 'react'
import { Checkbox, IconButton, Stack, Tooltip, useMediaQuery } from '@mui/material'
import ChecklistIcon from '@mui/icons-material/Checklist'
import clsx from 'clsx'
import { GutterWidthPx, gridWidthPx, type ColumnSpec, type Headkind } from '../lib/columns'
import { FoldButton } from './FoldButton'
import { ChainChoices } from './cells/chain'
import { QuestionRow, alignClassOf } from './QuestionRow'
import { rowRunOf } from './row-runs'
import { useFolds } from './use-folds'
import { useSettledResize } from './use-settled-resize'
import type { QuizRun } from '../lib/formulary/runner'
import type { AsksT } from '../state/use-asking'
import { Question, type QuestionPatch, type QuestionT } from '../models/question'
import type { EntryValueT } from '../models/widget'
import type { Sortkey } from '../models/quiz'
import styles from './workbench.module.css'

export type SortMark = {
  sortkey:    Sortkey
  descending: boolean
}

export type QuestionTableProps = {
  /** The quiz's questions, in its order: the grid shows all but the archived, and a chain may point at any */
  questions:    QuestionT[]
  /** The quiz's columns, in the order they appear */
  specs:        readonly ColumnSpec[]
  /** The quiz, run: what each widgeting came to for each question */
  run:          QuizRun
  /** The sources the quiz nominates as templateable: their boxes show them filled in */
  templateable: readonly string[]
  locked:       boolean
  /** Grips are offered only while the quiz is in Q# order */
  gripShown:    boolean
  /** Batch mode: each row shows a checkbox, and a button to change how it is shown, in place of its grip */
  batching:     boolean
  /** Enter or leave batch mode, from the grid's top-left corner */
  onBatch:      (on: boolean) => void
  isChecked:    (question_id: string) => boolean
  onCheck:      (question_id: string, on: boolean) => void
  /** Check every question, or none */
  onCheckAll:   (on: boolean) => void
  /** Asks to change how one question is shown (its viz); the asking is the caller's */
  onViz:        (question_id: string) => void
  /** Which column the quiz was last committed to, bold across reloads as a reminder */
  lastSortkey:  Sortkey | null
  /** Which column was sorted in this session, and which way; the only thing an arrow marks */
  sortMark:     SortMark | null
  onSort:       (sortkey: Sortkey) => void
  /** Collapse one column to its turned header, or restore it, by a double-click on its head; absent where the columns may not be changed */
  onCollapse?:  (colkey: string, collapsed: boolean) => void
  onChain:      (question_id: string, chains_to: string | null) => void
  /** The asks in flight, each row reading its own (`useAskingIn`) */
  asks:         AsksT
  /** Why the widgeting labelled so cannot be asked at all, when it cannot; null when it can. Made again only with the run */
  unavailableNotice: (widgeting_label: string) => string | null
  /** Ask the widgeting labelled so about one question */
  onAsk:        (question_id: string, widgeting_label: string) => void
  onEdit:       (question_id: string, patch: QuestionPatch) => void
  /** Put what was typed into one question's cell of the entry widgeting labelled so; null empties it */
  onEnter:      (question_id: string, widgeting_label: string, value: EntryValueT | null) => void
  /** Told which question moved, and the index it lands on among those shown once it has been lifted out */
  onMove:       (question_id: string, onto_idx: number) => void
}

/** Where the grid becomes one card per question, as `workbench.module.css` restructures it */
const CardLayoutQuery = '(max-width:640px)'

/**
 * The grid: one row per question but the archived, scrolling sideways inside its own container.
 *
 * Its top-left corner folds every row to one line, or unfolds them all when none is open; entering
 * a text box opens that row alone. The questions there when it opens start folded, and one added
 * later starts open. It holds this as its own state, so its owner keys it by the quiz. As cards,
 * below 640px, every question shows in full: the corner is not there to unfold them.
 *
 * A row is drawn again only when what it shows changed (`QuestionRow`): each is handed its own
 * part of the run (`rowRunOf`), and the functions it is handed take a question's id, so the
 * owner hands the grid functions that keep their identity from render to render.
 */
export function QuestionTable({ questions, specs, run, templateable, locked, gripShown, batching, onBatch, isChecked, onCheck, onCheckAll, onViz, lastSortkey, sortMark, onSort, onCollapse, onChain, asks, unavailableNotice, onAsk, onEdit, onEnter, onMove }: Readonly<QuestionTableProps>) {
  const resizeToken = useSettledResize()
  const shown = useMemo(() => Question.unarchived(questions), [questions])
  const checkedCount = shown.filter((question) => isChecked(question._id)).length
  const folds = useFolds(shown.map((question) => question._id))
  const carded = useMediaQuery(CardLayoutQuery)
  const bodyId = useId()
  const rows = useMemo(() => shown.map((question) => ({ question, rowRun: rowRunOf(run, question, specs, templateable, unavailableNotice) })), [shown, run, specs, templateable, unavailableNotice])
  const hintOf = useMemo(() => new Map(questions.map((question) => [question._id, question.hint])), [questions])

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
                  <Tooltip title={batching ? 'Done selecting' : 'Select questions, to archive them or show them as alternates'}>
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
                      checked={checkedCount > 0 && checkedCount === shown.length}
                      indeterminate={checkedCount > 0 && checkedCount < shown.length}
                      slotProps={{ input: { 'aria-label': 'Select all questions' } }}
                      onChange={(event) => { onCheckAll(event.target.checked) }}
                    />
                  )}
                </Stack>
              </Stack>
            </th>
            {specs.map((column) => {
              // A collapsed column's cells are empty, so there is nothing on screen to order by.
              const sortkey = column.collapsed ? null : column.sortkey ?? null
              return (
                <ColumnHead
                  key={column.colkey}
                  column={column}
                  sorted={sortkey !== null && sortkey === lastSortkey}
                  ariaSort={ariaSortFor(sortkey, sortMark)}
                  hint={onCollapse ? collapseHintOf(column) : undefined}
                  onDoubleClick={onCollapse ? () => { onCollapse(column.colkey, ! column.collapsed) } : undefined}
                >
                  {sortkey === null ? column.title : (
                    // The second click of a double-click, which collapses the column, sorts nothing more.
                    <button type="button" className={styles.headButton} disabled={locked} onClick={(event) => { if (event.detail <= 1) { onSort(sortkey) } }}>
                      {column.title}
                      {/* Decorative: the direction is already on the header as aria-sort, and
                          folding the arrow into the button's name would rename it on every click. */}
                      <span className={styles.headArrow} aria-hidden="true">{arrowFor(sortkey, sortMark)}</span>
                    </button>
                  )}
                </ColumnHead>
              )
            })}
          </tr>
        </thead>
        <tbody id={bodyId}>
          <ChainChoices questions={questions}>
            {rows.map(({ question, rowRun }, idx) => (
              <QuestionRow
                key={question._id}
                question={question}
                targetHint={question.chains_to === null ? null : hintOf.get(question.chains_to) ?? null}
                locked={locked}
                gripShown={gripShown}
                checked={batching ? isChecked(question._id) : null}
                onCheck={onCheck}
                onViz={onViz}
                resizeToken={resizeToken}
                folded={! carded && folds.isFolded(question._id)}
                onUnfold={folds.unfold}
                idx={idx}
                count={shown.length}
                onMove={onMove}
                onChain={onChain}
                specs={specs}
                rowRun={rowRun}
                templateable={templateable}
                asks={asks}
                onAsk={onAsk}
                onEdit={onEdit}
                onEnter={onEnter}
              />
            ))}
          </ChainChoices>
        </tbody>
      </table>
    </div>
  )
}

export type ColumnHeadProps = {
  column:         ColumnSpec
  /** Whether the quiz was last committed to its order, marked bold across reloads */
  sorted?:        boolean
  /** What a screen reader is told of its part in the current order; nothing for a column that does not sort */
  ariaSort?:      'ascending' | 'descending' | 'none'
  /** What hovering over it says */
  hint?:          string
  onDoubleClick?: () => void
  /** What it says: its title, or the button that sorts by it */
  children:       React.ReactNode
}

/**
 * One column's head in the grid, as wide as the column, aligned and turned as it is, holding its
 * title or the button sorting by it. The grid's own heads and the manage dialog's row preview
 * both draw it.
 */
export function ColumnHead({ column, sorted = false, ariaSort, hint, onDoubleClick, children }: Readonly<ColumnHeadProps>) {
  return (
    <th
      scope="col"
      className={clsx(styles.head, headClassOf(column.headkind), alignClassOf(column.align), sorted && styles.headSorted)}
      data-sorted={sorted || undefined}
      data-collapsed={column.collapsed || undefined}
      style={{ width: `${String(column.widthPx)}px` }}
      aria-sort={ariaSort}
      title={hint}
      onDoubleClick={onDoubleClick}
    >
      <span className={clsx(column.headkind === 'vertical' && styles.headVerticalInner)}>{children}</span>
    </th>
  )
}

/** What a column's head says of the double-click that collapses it, or restores it */
function collapseHintOf(column: Pick<ColumnSpec, 'collapsed' | 'title'>): string {
  const verb = column.collapsed ? 'restore' : 'collapse'
  return `Double-click to ${verb} ${column.title}`
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
