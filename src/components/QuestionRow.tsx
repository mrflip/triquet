'use client'

import { useCallback, useMemo, useState } from 'react'
import clsx from 'clsx'
import { columnsFor } from './columns'
import { GrowingField, PlainField, QnumField, StretchField } from './cells/fields'
import { ExpressedReadout } from './cells/readouts'
import * as Expressed from '../lib/expressed'
import { sortkeyOf, type ExpressingT } from '../models/expressing'
import type { Askkind } from '../state/use-asking'
import { ButnotPreview, ChainPicker } from './cells/chain'
import { GuessCell } from './cells/guess'
import { ButnotIshesCell, IshesCell } from './cells/ishes'
import type { QuestionPatch, QuestionT } from '../models/question'
import styles from './workbench.module.css'

/** Tallest a row may grow before its Clueing and Hint boxes scroll internally instead */
export const RowCapPx = 480

/** Shortest a row may be, so an empty quiz still reads as a grid */
export const RowFloorPx = 56

export type QuestionRowProps = {
  question:    QuestionT
  /** Every question in the quiz, for the columns that read across them */
  questions:   QuestionT[]
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
  onChain:     (chains_to: string | null) => void
  /** The quiz's computed columns, in the order they appear */
  expressings: ExpressingT[]
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
 * One question, across every column.
 *
 * The Clueing and Hint boxes grow with their own content and the taller of the two sets the
 * height for both, capped; the notes columns are stretched to that same height but never get a
 * say in it, and the ishes columns are capped at it and scroll.
 */
export function QuestionRow({ question, questions, locked, gripShown, resizeToken, dragging, dropTarget, onDragBegin, onDragOver, onDrop, onDragEnd, onChain, expressings, expressed, asking, unavailableNotice, onAsk, onAskTarget, onEdit }: Readonly<QuestionRowProps>) {
  const [clueingNaturalPx, setClueingNaturalPx] = useState(RowFloorPx)
  const [hintNaturalPx, setHintNaturalPx] = useState(RowFloorPx)

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
  const widths = useMemo(() => Object.fromEntries(columnsFor(expressings).map((column) => [column.colkey, column])), [expressings])

  const cell = (colkey: string, body: React.ReactNode, onDoubleClick?: () => void) => {
    const column = widths[colkey]
    const isCollapsedGrip = colkey === 'grip' && ! gripShown
    return (
      <td
        key={colkey}
        className={clsx(styles.cell, isCollapsedGrip && styles.gripCollapsed)}
        style={{ width: `${String(column?.widthPx ?? 0)}px` }}
        data-colname={column?.title}
        onDoubleClick={onDoubleClick}
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
      {cell('title', (
        <>
          <PlainField
            label="Title" committed={question.title} locked={locked}
            onCommit={(title) => { commit({ title }) }}
          />
          <div className={styles.metaline}>{question.label}</div>
        </>
      ))}
      {cell('grip', (
        <div
          className={clsx(styles.grip, locked && styles.gripLocked)}
          draggable={draggable}
          role="button"
          tabIndex={draggable ? 0 : -1}
          aria-label={`Reorder ${question.title || 'this question'}`}
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
      {cell('chains_to', (
        <ChainPicker question={question} questions={questions} locked={locked} onChain={onChain} />
      ))}
      {cell('butnot', (
        <ButnotPreview target={chainTarget} chained={question.chains_to !== null} heightPx={heightPx} />
      ))}
      {cell('qnum', (
        <QnumField label="Q#" committed={question.qnum} locked={locked} onCommit={(qnum) => { commit({ qnum }) }} />
      ))}
      {/* The double-click shortcut is undocumented on screen, on purpose: it is muscle memory
          for someone iterating hard on one clue's total, and the ishes cell it summarises is
          the documented, keyboard-reachable way to the same thing. It belongs to the standard
          Full Sum expressions, wherever a quiz has put them. */}
      {expressings.map((expressing) => cell(
        sortkeyOf(expressing),
        <ExpressedReadout
          reading={Expressed.readingOf(expressed, expressing.label, question.id)}
          shape={expressing.shape}
          heightPx={heightPx}
        />,
        () => { reextractFor(expressing.expression_label) },
      ))}
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
        <IshesCell
          ishes={question.clueing_ishes} label="Clueing ishes"
          asking={asking('clueing')} askable={question.clueing.trim() !== ''}
          locked={locked} notice={unavailableNotice('clueing')} heightPx={heightPx} onAsk={() => { onAsk('clueing') }}
        />
      ))}
      {cell('butnot_ishes', (
        <ButnotIshesCell
          ishes={chainTarget?.hint_ishes ?? null}
          chained={question.chains_to !== null}
          heightPx={heightPx}
        />
      ))}
      {cell('hint_ishes', (
        <IshesCell
          ishes={question.hint_ishes} label="Hint Ishes"
          asking={asking('hint')} askable={question.hint.trim() !== ''}
          locked={locked} notice={unavailableNotice('hint')} heightPx={heightPx} onAsk={() => { onAsk('hint') }}
        />
      ))}
      {cell('guess', (
        <GuessCell
          guess={question.guess}
          asking={asking('guess')}
          askable={question.clueing.trim() !== ''}
          locked={locked}
          notice={unavailableNotice('guess')}
          heightPx={heightPx}
          onAsk={() => { onAsk('guess') }}
        />
      ))}
    </tr>
  )
}

