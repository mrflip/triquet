'use client'

import { useCallback, useState } from 'react'
import { Checkbox, IconButton } from '@mui/material'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import clsx from 'clsx'
import { GutterWidthPx, type ColumnSpec } from '../lib/columns'
import { GrowingField, PlainField, QnumField, StretchField } from './cells/fields'
import { ExpressedReadout } from './cells/readouts'
import * as Expressed from '../lib/expressed'
import type { QuestionField } from '../models/column'
import type { BotSlot } from '../models/botting'
import { askableTextOf, type Askkind } from '../state/use-asking'
import { ButnotPreview, ChainPicker } from './cells/chain'
import { GuessCell } from './cells/guess'
import { ButnotIshesCell, IshesCell } from './cells/ishes'
import { useReorderable } from './use-reorder'
import type { QuestionPatch, QuestionT } from '../models/question'
import styles from './workbench.module.css'

/** Names the grid as a list to drag within, so its rows and the editors' never mix */
export const QuestionListkey = 'questions'

/** Tallest a row may grow before its Clueing and Hint boxes scroll internally instead */
export const RowCapPx = 480

/** Wide enough to say why a formula failed, rather than only that it did */
const WideReadoutPx = 150

/** Shortest a row may be, so an empty quiz still reads as a grid */
export const RowFloorPx = 56

export type QuestionRowProps = {
  question:    QuestionT
  /** Every question in the quiz, for the columns that read across them */
  questions:   QuestionT[]
  locked:      boolean
  gripShown:   boolean
  /** Whether this question is checked, in batch mode; null outside it, where its grip and trash can show instead */
  checked:     boolean | null
  onCheck:     (on: boolean) => void
  /** Asks to delete this question; the asking-first is the caller's */
  onDelete:    () => void
  resizeToken: number
  /** Where this question sits in the grid, and how many there are, so its grip can move it */
  idx:         number
  count:       number
  /** Told which question moved, and the index it lands on once it has been lifted out */
  onMove:      (question_id: string, onto_idx: number) => void
  onChain:     (chains_to: string | null) => void
  /** The quiz's columns, in the order they appear */
  specs:       ColumnSpec[]
  /** What each computed column came to for each question of the quiz */
  expressed:   Expressed.ExpressedForQuiz
  /** Whether an ask for one of this question's cells is in flight */
  asking:      (askkind: Askkind) => boolean
  /** Why a kind of ask cannot be made at all, when it cannot; null when it can */
  unavailableNotice: (askkind: Askkind) => string | null
  onAsk:       (askkind: Askkind) => void
  /** Re-extract the chained-to question's hint, for the BUT NOT Full Sum shortcut */
  onAskTarget: (askkind: Askkind) => void
  onEdit:      (patch: QuestionPatch) => void
}

/**
 * One question, across every column, after a gutter holding its grip and trash can -- or, in
 * batch mode, its checkbox.
 *
 * The Clueing and Hint boxes grow with their own content and the taller of the two sets the
 * height for both, capped; the notes columns are stretched to that same height but never get a
 * say in it, and the ishes columns are capped at it and scroll.
 */
export function QuestionRow({ question, questions, locked, gripShown, checked, onCheck, onDelete, resizeToken, idx, count, onMove, onChain, specs, expressed, asking, unavailableNotice, onAsk, onAskTarget, onEdit }: Readonly<QuestionRowProps>) {
  const [clueingNaturalPx, setClueingNaturalPx] = useState(RowFloorPx)
  const [hintNaturalPx, setHintNaturalPx] = useState(RowFloorPx)
  const batching = checked !== null
  const grippable = gripShown && ! batching && ! locked
  const { rowRef, handleRef, dragging, landing, onHandleKeyDown, onHandleBlur } = useReorderable({ listkey: QuestionListkey, itemkey: question.id, idx, count, disabled: ! grippable, onMove })
  const questionName = question.title || 'this question'

  const heightPx = Math.min(Math.max(clueingNaturalPx, hintNaturalPx, RowFloorPx), RowCapPx)

  const commit = useCallback((patch: QuestionPatch) => { onEdit(patch) }, [onEdit])
  const chainTarget = questions.find((other) => other.id === question.chains_to) ?? null

  const reextractFor = (expression_label: string) => {
    if (locked) { return }
    switch (expression_label) {
    case 'clueing_full': { onAsk('clueing'); break }
    case 'hint_full':    { onAsk('hint'); break }
    case 'butnot_full':  { onAskTarget('hint'); break }
    default:             { break }
    }
  }
  /** What a column shows for this question */
  const bodyOf = (spec: ColumnSpec): React.JSX.Element => {
    const { source } = spec
    if (source.kind === 'field') { return fieldBody(source.field) }
    if (source.kind === 'view') {
      return source.view === 'butnot'
        ? <ButnotPreview target={chainTarget} chained={question.chains_to !== null} heightPx={heightPx} />
        : <ButnotIshesCell ishes={chainTarget?.hint_ishes ?? null} chained={question.chains_to !== null} heightPx={heightPx} />
    }
    if (source.kind === 'expressing') {
      return (
        <ExpressedReadout
          reading={Expressed.readingOf(expressed, source.widget.label, question.id)}
          wide={spec.widthPx >= WideReadoutPx}
          heightPx={heightPx}
        />
      )
    }
    return playedBody(source.slot.field)
  }

  /** One of the question's own fields, in the box it is edited in */
  const fieldBody = (field: QuestionField): React.JSX.Element => {
    switch (field) {
    case 'title': {
      return (
        <>
          <PlainField label="Title" committed={question.title} locked={locked} onCommit={(title) => { commit({ title }) }} />
          <div className={styles.metaline}>{question.label}</div>
        </>
      )
    }
    case 'clueing': {
      return <GrowingField label="Clueing" committed={question.clueing} locked={locked} onCommit={(clueing) => { commit({ clueing }) }} heightPx={heightPx} onNatural={setClueingNaturalPx} resizeToken={resizeToken} />
    }
    case 'hint': {
      return <GrowingField label="Hint" committed={question.hint} locked={locked} onCommit={(hint) => { commit({ hint }) }} heightPx={heightPx} onNatural={setHintNaturalPx} resizeToken={resizeToken} />
    }
    case 'chains_to': {
      return <ChainPicker question={question} questions={questions} locked={locked} onChain={onChain} />
    }
    case 'qnum': {
      return <QnumField label="Q#" committed={question.qnum} locked={locked} onCommit={(qnum) => { commit({ qnum }) }} />
    }
    case 'alt_text': {
      return <StretchField label="Alt Text" committed={question.alt_text} locked={locked} onCommit={(alt_text) => { commit({ alt_text }) }} heightPx={heightPx} />
    }
    case 'notes': {
      return <StretchField label="Notes" committed={question.notes} locked={locked} onCommit={(notes) => { commit({ notes }) }} heightPx={heightPx} />
    }
    case 'full_answer': {
      return <StretchField label="Full Answer" committed={question.full_answer} locked={locked} onCommit={(full_answer) => { commit({ full_answer }) }} heightPx={heightPx} />
    }
    }
  }

  /** What one bot answered, in the cell that asks it again */
  const playedBody = (field: BotSlot['field']): React.JSX.Element => {
    if (field === 'guess') {
      return (
        <GuessCell
          guess={question.guess} asking={asking('guess')} askable={question.clueing.trim() !== ''}
          locked={locked} notice={unavailableNotice('guess')} heightPx={heightPx} onAsk={() => { onAsk('guess') }}
        />
      )
    }
    const askkind = field === 'clueing_ishes' ? 'clueing' : 'hint'
    return (
      <IshesCell
        ishes={question[field]} label={field === 'clueing_ishes' ? 'Clueing ishes' : 'Hint Ishes'}
        asking={asking(askkind)} askable={askableTextOf(question, askkind) !== ''}
        locked={locked} notice={unavailableNotice(askkind)} heightPx={heightPx} onAsk={() => { onAsk(askkind) }}
      />
    )
  }

  /** The cell for one column */
  const cell = (spec: ColumnSpec) => (
    <td
      key={spec.colkey}
      className={styles.cell}
      style={{ width: `${String(spec.widthPx)}px` }}
      data-colname={spec.title}
      onDoubleClick={spec.source.kind === 'expressing' ? () => { reextractFor(spec.source.kind === 'expressing' ? spec.source.widget.expression_label : '') } : undefined}
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
      )}
    >
      <td className={styles.cell} style={{ width: `${String(GutterWidthPx)}px` }}>
        <div className={styles.gutter}>
          {batching ? (
            <Checkbox
              size="small" sx={{ p: 0.25 }} checked={checked}
              slotProps={{ input: { 'aria-label': `Select ${questionName}` } }}
              onChange={(event) => { onCheck(event.target.checked) }}
            />
          ) : (
            <>
              {gripShown && (
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
              <IconButton size="small" sx={{ p: 0.25 }} disabled={locked} aria-label={`Delete ${questionName}`} onClick={onDelete}>
                <DeleteOutlinedIcon fontSize="small" />
              </IconButton>
            </>
          )}
        </div>
      </td>
      {/* The double-click shortcut on a Full Sum is undocumented on screen, on purpose: it is
          muscle memory for someone iterating hard on one clue's total, and the ishes cell it
          summarises is the documented, keyboard-reachable way to the same thing. It belongs to
          the standard Full Sum expressions, wherever a quiz has put them. */}
      {specs.map((spec) => cell(spec))}
    </tr>
  )
}

