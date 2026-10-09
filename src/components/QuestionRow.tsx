'use client'

import { memo, useCallback, useState } from 'react'
import { Box, Checkbox, IconButton } from '@mui/material'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import clsx from 'clsx'
import { GutterWidthPx, type ColumnSpec } from '../lib/columns'
import { openOnEntry } from './FoldButton'
import { GrowingField, PlainField, QnumField, StretchField } from './cells/fields'
import { DrawnReadout, WidgetedAskCell, WidgetedReadout } from './cells/readouts'
import { EntryCell } from './cells/entry'
import { EstimatePartReadout } from './cells/estimates'
import type * as Templating from '../lib/templating'
import type { ColumnAlign, QuestionField } from '../models/column'
import type { EntryValueT } from '../models/widget'
import { useAskingIn, type AsksT } from '../state/use-asking'
import { isSameRowRun, type CellRunT, type ReaskT, type RowRunT } from './row-runs'
import { ButnotPreview, ChainPicker } from './cells/chain'
import { useReorderable } from './use-reorder'
import { Question, type QuestionPatch, type QuestionT } from '../models/question'
import styles from './workbench.module.css'

/** Names the grid as a list to drag within, so its rows and the editors' never mix */
export const QuestionListkey = 'questions'

/** Tallest a row may grow before its Clueing and Hint boxes scroll internally instead */
export const RowCapPx = 480

/** Wide enough to say why a formula failed, rather than only that it did */
const WideReadoutPx = 150

/** Shortest a row may be, so an empty quiz still reads as a grid */
export const RowFloorPx = 56

/** The class that hands a column's alignment to every box in its cells and its header */
const AlignClasses: Readonly<Record<ColumnAlign, string | undefined>> = { left: styles.alignLeft, center: styles.alignCenter, right: styles.alignRight }

/** The class for a header or cell of a column aligned so; none when the column leaves each box to set itself */
export function alignClassOf(align: ColumnAlign | null): string | undefined {
  return align === null ? undefined : AlignClasses[align]
}

/** The height a folded row gives every cell: one line of the grid's own box, its 20px line and 5px of padding and border above and below */
export const FoldedRowPx = 30

export type QuestionRowProps = {
  question:    QuestionT
  /** The hint of the question this one chains to, for its BUT NOT; null when it chains to none */
  targetHint:  string | null
  locked:      boolean
  gripShown:   boolean
  /** Whether this question is checked, in batch mode, where the button to change how it is shown shows too; null outside it, where its grip shows instead */
  checked:     boolean | null
  onCheck:     (question_id: string, on: boolean) => void
  /** Asks to change how a question is shown (its viz); the asking is the caller's */
  onViz:       (question_id: string) => void
  resizeToken: number
  /** Whether the row is folded, each of its boxes one line high until a text box in it is entered */
  folded:      boolean
  /** Opens a question's row, as the author clicks or tabs into one of its text boxes */
  onUnfold:    (question_id: string) => void
  /** Where this question sits in the grid, and how many there are, so its grip can move it */
  idx:         number
  count:       number
  /** Told which question moved, and the index it lands on once it has been lifted out */
  onMove:      (question_id: string, onto_idx: number) => void
  onChain:     (question_id: string, chains_to: string | null) => void
  /** The quiz's columns, in the order they appear */
  specs:       readonly ColumnSpec[]
  /** What this question's cells came to in the quiz's run, and what its templated boxes are filled in over (`rowRunOf`) */
  rowRun:      RowRunT
  /** The sources the quiz nominates as templateable (`clueing`, a widgeting's label): their boxes show them filled in */
  templateable: readonly string[]
  /** The screen's asks in flight, of which the row reads its own (`useAskingIn`) */
  asks:        AsksT
  /** Ask the widgeting labelled so about a question */
  onAsk:       (question_id: string, widgeting_label: string) => void
  onEdit:      (question_id: string, patch: QuestionPatch) => void
  /** Put what was typed into a question's cell of the entry widgeting labelled so; null empties it */
  onEnter:     (question_id: string, widgeting_label: string, value: EntryValueT | null) => void
}

/**
 * One question, across every column, after a gutter holding its grip -- or, in batch mode, its
 * checkbox and the button that changes how it is shown. An alternate's title is in italics, with
 * `(alt)` after it.
 *
 * The Clueing and Hint boxes grow with their own content and the taller of the two sets the
 * height for both, capped; the notes columns (and text entries) are stretched to that same height
 * but never get a say in it, and the widgetings' columns are capped at it and scroll.
 *
 * Folded, every box is one line high and shows the first line of what it holds, ending in an
 * ellipsis, and the lines beneath a box (the title's label) are put away. The boxes go on
 * measuring themselves, so the row opens straight to the height it would have had.
 *
 * Drawn again only when something it shows has changed (`isSameRowProps`): its question, its
 * cells in the quiz's run, how its templated boxes fill in, or the grid's own state. Every
 * function it is handed takes the question's id, so the grid hands every row the same ones.
 */
export const QuestionRow = memo(function QuestionRow({ question, targetHint, locked, gripShown, checked, onCheck, onViz, resizeToken, folded, onUnfold, idx, count, onMove, onChain, specs, rowRun, templateable, asks, onAsk, onEdit, onEnter }: Readonly<QuestionRowProps>) {
  const [clueingNaturalPx, setClueingNaturalPx] = useState(RowFloorPx)
  const [hintNaturalPx, setHintNaturalPx] = useState(RowFloorPx)
  const batching = checked !== null
  const grippable = gripShown && ! batching && ! locked
  const { _id: question_id } = question
  const { rowRef, handleRef, dragging, landing, onHandleKeyDown, onHandleBlur } = useReorderable({ listkey: QuestionListkey, itemkey: question_id, idx, count, disabled: ! grippable, onMove })
  const asking = useAskingIn(asks, question_id)
  const questionName = question.title || 'this question'

  const heightPx = folded ? FoldedRowPx : Math.min(Math.max(clueingNaturalPx, hintNaturalPx, RowFloorPx), RowCapPx)

  const commit = useCallback((patch: QuestionPatch) => { onEdit(question_id, patch) }, [onEdit, question_id])
  /** What the box showing `source` is filled in over, when the quiz templates it; null when it does not */
  const bagFor = (source: string): Templating.TemplateBag | null => (templateable.includes(source) ? rowRun.bag : null)

  /** Ask again what a double-click on a cell asks, unless the quiz is locked */
  const reaskFor = (reask: ReaskT) => {
    if (locked) { return }
    if (! reask.ofTarget) { onAsk(question_id, reask.widgeting_label) } else if (question.chains_to !== null) { onAsk(question.chains_to, reask.widgeting_label) }
  }

  /** What a column shows for this question: nothing while it is collapsed; a question's field, an entry's cell or a bot's asked from the cell, each in its own editor; anything else read-only */
  const bodyOf = (spec: ColumnSpec, cellRun: CellRunT): React.ReactNode => {
    const wide = spec.widthPx >= WideReadoutPx
    switch (cellRun.kind) {
    case 'collapsed': { return null }
    case 'field':     { return fieldBody(cellRun.field) }
    case 'entry': {
      const { widget, widgeting, widgeted } = cellRun
      return <EntryCell widget={widget} widgeting={widgeting} widgeted={widgeted} label={spec.title} locked={locked} heightPx={heightPx} onEnter={(value) => { onEnter(question_id, widgeting.label, value) }} bag={bagFor(widgeting.label)} />
    }
    case 'ask': {
      const label = spec.source.kind === 'widgeting' ? spec.source.widgeting.label : ''
      return (
        <WidgetedAskCell
          widgeted={cellRun.widgeted} meta={question.stored[label]?.ok?.result_meta ?? null} label={spec.title} asking={asking(label)} askable={cellRun.askable}
          locked={locked} notice={cellRun.notice} heightPx={heightPx} onAsk={() => { onAsk(question_id, label) }}
        />
      )
    }
    case 'drawn':    { return <DrawnReadout drawn={cellRun.drawn} readout={cellRun.readout} wide={wide} heightPx={heightPx} /> }
    case 'butnot':   { return <ButnotPreview target={targetHint === null ? null : { hint: targetHint }} chained={question.chains_to !== null} heightPx={heightPx} /> }
    case 'estimate': { return <EstimatePartReadout part={cellRun.part} widgeted={cellRun.widgeted} label={spec.title} wide={wide} heightPx={heightPx} /> }
    case 'widgeted': { return <WidgetedReadout widgeted={cellRun.widgeted} label={spec.title} wide={wide} heightPx={heightPx} /> }
    }
  }

  /** One of the question's own fields, in the box it is edited in */
  const fieldBody = (field: QuestionField): React.JSX.Element => {
    switch (field) {
    case 'title': {
      const field = <PlainField label="Title" committed={question.title} locked={locked} onCommit={(title) => { commit({ title }) }} />
      return (
        <>
          {Question.isSecondary(question) ? (
            // The box inherits its font, so the alternate's title is in italics as it is typed.
            <Box sx={{ display: 'flex', alignItems: 'baseline', fontStyle: 'italic', '& input': { minWidth: 0 } }}>
              {field}
              <Box component="span" sx={{ flex: 'none', pr: 0.75 }}>{Question.AltMark}</Box>
            </Box>
          ) : field}
          <div className={clsx(styles.metaline, styles.fieldNote)}>{question.label}</div>
        </>
      )
    }
    case 'clueing': {
      return <GrowingField label="Clueing" committed={question.clueing} locked={locked} onCommit={(clueing) => { commit({ clueing }) }} heightPx={heightPx} onNatural={setClueingNaturalPx} resizeToken={resizeToken} bag={bagFor('clueing')} />
    }
    case 'hint': {
      return <GrowingField label="Hint" committed={question.hint} locked={locked} onCommit={(hint) => { commit({ hint }) }} heightPx={heightPx} onNatural={setHintNaturalPx} resizeToken={resizeToken} bag={bagFor('hint')} />
    }
    case 'chains_to': {
      return <ChainPicker question={question} locked={locked} onChain={(chains_to) => { onChain(question_id, chains_to) }} />
    }
    case 'qnum': {
      return <QnumField label="Q#" committed={question.qnum} locked={locked} onCommit={(qnum) => { commit({ qnum }) }} />
    }
    case 'alt_text': {
      return <StretchField label="Alt Text" plain committed={question.alt_text} locked={locked} onCommit={(alt_text) => { commit({ alt_text }) }} heightPx={heightPx} />
    }
    case 'notes': {
      return <StretchField label="Notes" committed={question.notes} locked={locked} onCommit={(notes) => { commit({ notes }) }} heightPx={heightPx} bag={bagFor('notes')} />
    }
    case 'full_answer': {
      return <StretchField label="Full Answer" committed={question.full_answer} locked={locked} onCommit={(full_answer) => { commit({ full_answer }) }} heightPx={heightPx} bag={bagFor('full_answer')} />
    }
    case 'recap': {
      return <StretchField label="Recap" committed={question.recap} locked={locked} onCommit={(recap) => { commit({ recap }) }} heightPx={heightPx} bag={bagFor('recap')} />
    }
    }
  }

  /** The cell for one column */
  const cell = (spec: ColumnSpec) => {
    const cellRun = rowRun.cells[spec.colkey]
    const { reask } = cellRun ?? { reask: null }
    return (
      <td
        key={spec.colkey}
        className={clsx(styles.cell, alignClassOf(spec.align))}
        style={{ width: `${String(spec.widthPx)}px` }}
        data-colname={spec.title}
        onDoubleClick={reask ? () => { reaskFor(reask) } : undefined}
      >
        {cellRun ? bodyOf(spec, cellRun) : null}
      </td>
    )
  }

  return (
    <tr
      ref={rowRef}
      className={clsx(
        dragging && styles.rowDragging,
        landing === 'top' && styles.rowDropAbove,
        landing === 'bottom' && styles.rowDropBelow,
        folded && styles.rowFolded,
      )}
      data-folded={folded || undefined}
      onFocus={folded ? openOnEntry(() => { onUnfold(question_id) }) : undefined}
    >
      <td className={styles.cell} style={{ width: `${String(GutterWidthPx)}px` }}>
        <div className={styles.gutter}>
          {batching ? (
            <>
              <Checkbox
                size="small" sx={{ p: 0.25 }} checked={checked}
                slotProps={{ input: { 'aria-label': `Select ${questionName}` } }}
                onChange={(event) => { onCheck(question_id, event.target.checked) }}
              />
              <IconButton size="small" sx={{ p: 0.25 }} aria-label={`Change how ${questionName} is shown`} onClick={() => { onViz(question_id) }}>
                <VisibilityOutlinedIcon fontSize="small" />
              </IconButton>
            </>
          ) : gripShown && (
            <div
              ref={handleRef}
              className={clsx(styles.grip, locked && styles.gripLocked)}
              role="button"
              tabIndex={grippable ? 0 : -1}
              aria-label={`Reorder ${questionName}`}
              onKeyDown={onHandleKeyDown}
              onBlur={onHandleBlur}
            >
              ⠿
            </div>
          )}
        </div>
      </td>
      {/* The double-click shortcut on a Full Sum is undocumented on screen, on purpose: it is
          muscle memory for someone iterating hard on one clue's total, and the ishes cell it
          summarises is the documented, keyboard-reachable way to the same thing. It belongs to
          the standard Full Sum widgets, wherever a quiz has put them to work. */}
      {specs.map((spec) => cell(spec))}
    </tr>
  )
}, isSameRowProps)

/**
 * Whether a row handed `next` draws what it drew from `prev`: every prop the very same, but its
 * row run, which need only draw the same (`isSameRowRun`): a run of the quiz in which nothing of
 * this question came out otherwise leaves its row as it is.
 */
export function isSameRowProps(prev: Readonly<QuestionRowProps>, next: Readonly<QuestionRowProps>): boolean {
  return (Object.keys(next) as (keyof QuestionRowProps)[]).every((propname) => (
    propname === 'rowRun' ? isSameRowRun(prev.rowRun, next.rowRun) : Object.is(prev[propname], next[propname])
  ))
}
