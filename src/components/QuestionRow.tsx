'use client'

import { useCallback, useState } from 'react'
import { Box, Checkbox, IconButton } from '@mui/material'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import clsx from 'clsx'
import { GutterWidthPx, drawnOf, isDrawnByEditor, readoutOf, shownOf, type ColumnSpec } from '../lib/columns'
import { openOnEntry } from './FoldButton'
import { GrowingField, PlainField, QnumField, StretchField } from './cells/fields'
import { DrawnReadout, WidgetedAskCell, WidgetedReadout } from './cells/readouts'
import { EntryCell } from './cells/entry'
import { EstimatePartReadout } from './cells/estimates'
import * as Runner from '../lib/formulary/runner'
import * as Templating from '../lib/templating'
import * as Estimates from '../lib/estimates'
import { formularyFor } from '../lib/formulary/formularies'
import { partOf, type ColumnAlign, type QuestionField } from '../models/column'
import type { WidgetingT } from '../models/widgeting'
import type { EntryValueT } from '../models/widget'
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
  /** Every question in the quiz, for the columns that read across them */
  questions:   QuestionT[]
  locked:      boolean
  gripShown:   boolean
  /** Whether this question is checked, in batch mode, where the button to change how it is shown shows too; null outside it, where its grip shows instead */
  checked:     boolean | null
  onCheck:     (on: boolean) => void
  /** Asks to change how this question is shown (its viz); the asking is the caller's */
  onViz:       () => void
  resizeToken: number
  /** Whether the row is folded, each of its boxes one line high until a text box in it is entered */
  folded:      boolean
  /** Opens the row, as the author clicks or tabs into one of its text boxes */
  onUnfold:    () => void
  /** Where this question sits in the grid, and how many there are, so its grip can move it */
  idx:         number
  count:       number
  /** Told which question moved, and the index it lands on once it has been lifted out */
  onMove:      (question_id: string, onto_idx: number) => void
  onChain:     (chains_to: string | null) => void
  /** The quiz's columns, in the order they appear */
  specs:       ColumnSpec[]
  /** The quiz, run: what each widgeting came to for each question of the quiz */
  run:         Runner.QuizRun
  /** The sources the quiz nominates as templateable (`clueing`, a widgeting's label): their boxes show them filled in */
  templateable: readonly string[]
  /** Whether an ask for this question's cell of the widgeting labelled so is in flight */
  asking:      (widgeting_label: string) => boolean
  /** Why the widgeting labelled so cannot be asked at all, when it cannot; null when it can */
  unavailableNotice: (widgeting_label: string) => string | null
  /** Ask the widgeting labelled so about this question */
  onAsk:       (widgeting_label: string) => void
  /** Ask the widgeting labelled so about the chained-to question, for the BUT NOT Full Sum shortcut */
  onAskTarget: (widgeting_label: string) => void
  onEdit:      (patch: QuestionPatch) => void
  /** Put what was typed into this question's cell of the entry widgeting labelled so; null empties it */
  onEnter:     (widgeting_label: string, value: EntryValueT | null) => void
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
 */
export function QuestionRow({ question, questions, locked, gripShown, checked, onCheck, onViz, resizeToken, folded, onUnfold, idx, count, onMove, onChain, specs, run, templateable, asking, unavailableNotice, onAsk, onAskTarget, onEdit, onEnter }: Readonly<QuestionRowProps>) {
  const [clueingNaturalPx, setClueingNaturalPx] = useState(RowFloorPx)
  const [hintNaturalPx, setHintNaturalPx] = useState(RowFloorPx)
  const batching = checked !== null
  const grippable = gripShown && ! batching && ! locked
  const { rowRef, handleRef, dragging, landing, onHandleKeyDown, onHandleBlur } = useReorderable({ listkey: QuestionListkey, itemkey: question._id, idx, count, disabled: ! grippable, onMove })
  const questionName = question.title || 'this question'

  const heightPx = folded ? FoldedRowPx : Math.min(Math.max(clueingNaturalPx, hintNaturalPx, RowFloorPx), RowCapPx)

  const commit = useCallback((patch: QuestionPatch) => { onEdit(patch) }, [onEdit])
  /** What the box showing `source` is filled in over, when the quiz templates it; null when it does not */
  const bagFor = (source: string): Templating.TemplateBag | null => (templateable.includes(source) ? Templating.bagOf(run, question._id) : null)
  const chainTarget = questions.find((other) => other._id === question.chains_to) ?? null

  /** The label of the quiz's widgeting working the `aibot` widget `widget_label`, if it has one */
  const labelWorking = (widget_label: string): string | null => (
    run.steps.find((step) => step.widget?.formulary === 'aibot' && step.widget.label === widget_label)?.widgeting.label ?? null
  )
  const reextractFor = (widget_label: string) => {
    if (locked) { return }
    const clueing = labelWorking('numnum_clueing')
    const hint = labelWorking('numnum_hint')
    if (widget_label === 'clueing_full' && clueing !== null) { onAsk(clueing) }
    if (widget_label === 'hint_full' && hint !== null) { onAsk(hint) }
    if (widget_label === 'butnot_full' && hint !== null) { onAskTarget(hint) }
  }
  /** The widget of the widgeting a column shows, when it shows one the library has */
  const widgetOf = (spec: ColumnSpec) => (spec.source.kind === 'widgeting' ? Runner.stepOf(run, spec.source.widgeting.label)?.widget ?? null : null)

  /**
   * What a column shows for this question: nothing while it is collapsed; a question's field, an
   * entry's cell or a bot's asked from the cell, each in its own editor, while the column is typed
   * into (`isDrawnByEditor`); anything else read-only, by its readout
   */
  const bodyOf = (spec: ColumnSpec): React.ReactNode => {
    const { source } = spec
    if (spec.collapsed) { return null }
    if (isDrawnByEditor(spec, widgetOf(spec))) {
      if (source.kind === 'field') { return fieldBody(source.field) }
      if (source.kind === 'widgeting') { return widgetingBody(source.widgeting, spec) }
    }
    return readoutBody(spec)
  }

  /**
   * What a column shows read-only: by its readout when it names one or has a template; else as the
   * cells choose, the chained-to hint as the BUT NOT preview, one part of a category-estimate entry
   * (`$.masie`) as the part is drawn, anything else as a worked-out cell is
   */
  const readoutBody = (spec: ColumnSpec): React.JSX.Element => {
    const wide = spec.widthPx >= WideReadoutPx
    const readout = readoutOf(spec, widgetOf(spec))
    if (readout !== null) { return <DrawnReadout drawn={drawnOf(spec, run, templateable, question._id)} readout={readout} wide={wide} heightPx={heightPx} /> }
    if (spec.source.kind === 'view' && spec.formula === null) {
      return <ButnotPreview target={chainTarget} chained={question.chains_to !== null} heightPx={heightPx} />
    }
    const widgeted = shownOf(spec, run, templateable, question._id)
    const part = Estimates.isEstimating(widgetOf(spec)) ? partOf(spec.formula) : null
    if (part !== null) { return <EstimatePartReadout part={part} widgeted={widgeted} label={spec.title} wide={wide} heightPx={heightPx} /> }
    return <WidgetedReadout widgeted={widgeted} label={spec.title} wide={wide} heightPx={heightPx} />
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
      return <ChainPicker question={question} questions={questions} locked={locked} onChain={onChain} />
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

  /** What a widgeting typed into or asked from the cell came to: an entry in its cell's editor, a bot's asked from the cell */
  const widgetingBody = (widgeting: WidgetingT, spec: ColumnSpec): React.JSX.Element => {
    const { label } = widgeting
    const widgeted = Runner.widgetedOf(run, label, question._id)
    const widget = widgetOf(spec)
    if (widget?.formulary === 'entry') {
      return <EntryCell widget={widget} widgeting={widgeting} widgeted={widgeted} label={spec.title} locked={locked} heightPx={heightPx} onEnter={(value) => { onEnter(label, value) }} bag={bagFor(label)} />
    }
    if (widget === null || formularyFor(widget).refresh !== 'click') { return readoutBody(spec) }
    return (
      <WidgetedAskCell
        widgeted={widgeted} meta={question.stored[label]?.ok?.result_meta ?? null} label={spec.title} asking={asking(label)} askable={Runner.inputOf(run, label, question._id).status === 'ok'}
        locked={locked} notice={unavailableNotice(label)} heightPx={heightPx} onAsk={() => { onAsk(label) }}
      />
    )
  }

  /** Whether a double-click on the column's cell may re-ask: a widgeting's, never an entry's, which is typed into */
  const asksOnDoubleClick = (spec: ColumnSpec): boolean => (
    spec.source.kind === 'widgeting' && Runner.stepOf(run, spec.source.widgeting.label)?.widget?.formulary !== 'entry'
  )

  /** The cell for one column */
  const cell = (spec: ColumnSpec) => (
    <td
      key={spec.colkey}
      className={clsx(styles.cell, alignClassOf(spec.align))}
      style={{ width: `${String(spec.widthPx)}px` }}
      data-colname={spec.title}
      onDoubleClick={! spec.collapsed && asksOnDoubleClick(spec) ? () => { reextractFor(spec.source.kind === 'widgeting' ? spec.source.widgeting.widget_label : '') } : undefined}
    >
      {bodyOf(spec)}
    </td>
  )

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
      onFocus={folded ? openOnEntry(onUnfold) : undefined}
    >
      <td className={styles.cell} style={{ width: `${String(GutterWidthPx)}px` }}>
        <div className={styles.gutter}>
          {batching ? (
            <>
              <Checkbox
                size="small" sx={{ p: 0.25 }} checked={checked}
                slotProps={{ input: { 'aria-label': `Select ${questionName}` } }}
                onChange={(event) => { onCheck(event.target.checked) }}
              />
              <IconButton size="small" sx={{ p: 0.25 }} aria-label={`Change how ${questionName} is shown`} onClick={onViz}>
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
}

