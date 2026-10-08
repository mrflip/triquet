'use client'

import { useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import { ClosableTitle, ignoringBackdrop } from './ClosableTitle'
import { ConfirmRemove } from './ConfirmRemove'
import { NumberField } from './cells/fields'
import { SortableList } from './SortableList'
import { useDraft } from './use-draft'
import { hiddenUntil } from './room'
import * as Labelmaker from '../lib/labelmaker'
import * as Estimates from '../lib/estimates'
import { alignAfter, headAlignOf } from '../lib/columns'
import { Column, ColumnValidators, QuestionFieldVals, QuestionViewVals, WidgetingPartVals, WidthPxMax, namesFor, partFormulaOf, type ColumnAlign, type ColumnPatch, type ColumnT } from '../models/column'
import type { QuizT } from '../models/quiz'
import { AddedColumnWidthPx } from '../models/layout'
import type { WidgetT } from '../models/widget'
import type { HuntActionDNA } from '../models/actions'
import styles from './workbench.module.css'

export type ColumnsEditorProps = {
  quiz:      QuizT
  /** The library's widgets, which say which of the quiz's widgetings offer parts to show */
  library:   readonly WidgetT[]
  /** Whether the columns may be changed here: listed as they are when not */
  revisable: boolean
  dispatch:  (action: HuntActionDNA) => void
}

/** Which column's editor is open: one of the quiz's, or a new one */
type Editing = { kind: 'column', label: string } | { kind: 'new' } | null

/** The familiar mark of each alignment, from a word processor's toolbar */
const AlignIcons: Readonly<Record<ColumnAlign, React.ReactNode>> = {
  left:   <FormatAlignLeftIcon fontSize="small" />,
  center: <FormatAlignCenterIcon fontSize="small" />,
  right:  <FormatAlignRightIcon fontSize="small" />,
}

/**
 * How wide the columns list must be for a row to show each of its lesser fields, as MUI's
 * container-query shorthand. The label goes first as it narrows, then what the column shows, then
 * its width; the title, the alignment and the gear always stay.
 */
const RoomFor = { label: '@800', source: '@620', width: '@400' } as const

/** One thing the columns editor offers a column to show: its ref and formula, under the key the menu lists it by */
type SourceChoice = { key: string, source: string, formula: string | null, group: string }

/** The key the menu lists a column's ref and formula by: the ref alone, or with its formula after it */
function choiceKeyOf(source: string, formula: string | null): string {
  return formula === null ? source : `${source}, ${formula}`
}

/** A menu choice of a ref and formula */
function choiceOf(source: string, formula: string | null, group: string): SourceChoice {
  return { key: choiceKeyOf(source, formula), source, formula, group }
}

/**
 * What a column of `quiz` can show, each with the group it is listed under: a category-estimate
 * widgeting's parts beneath it, each by the formula that picks it out (`$.masie`). A widgeting run
 * once for the whole quiz has no cell for any question, and is shown in the Quiz panel instead.
 */
function sourcesOf(quiz: QuizT, library: readonly WidgetT[]): SourceChoice[] {
  const estimating = new Set(library.filter((widget) => Estimates.isEstimating(widget)).map((widget) => widget.label))
  return [
    ...QuestionFieldVals.map((field) => choiceOf(field, null, 'A question field')),
    ...QuestionViewVals.map((view) => choiceOf(view, null, 'Worked out from the chain')),
    ...quiz.widgetings.flatMap((widgeting) => (widgeting.tier === 'question' ? [
      choiceOf(widgeting.label, null, 'A widgeting'),
      ...(estimating.has(widgeting.widget_label) ? WidgetingPartVals.map((part) => choiceOf(widgeting.label, partFormulaOf(part), 'Part of a widgeting')) : []),
    ] : [])),
  ]
}

/** The choices for `column`: those of its quiz, and what it shows now if they lack it (a formula the menu does not offer) */
function choicesFor(column: Pick<ColumnT, 'source' | 'formula'>, sources: readonly SourceChoice[]): readonly SourceChoice[] {
  const key = choiceKeyOf(column.source, column.formula ?? null)
  return sources.some((each) => each.key === key) ? sources : [...sources, choiceOf(column.source, column.formula ?? null, 'As it is')]
}

/**
 * A quiz's columns: every one listed in the order the grid shows them, dragged into a new order by
 * its handle, with its title, what it shows, its width and its alignment to change in place, its
 * label beside those, and a gear that opens the rest. The list measures its own width, not the
 * window's, to decide which of those there is room for.
 */
export function ColumnsEditor({ quiz, library, revisable, dispatch }: Readonly<ColumnsEditorProps>) {
  const [editing, setEditing] = useState<Editing>(null)
  const edited = editing?.kind === 'column' ? quiz.columns.find((each) => each.label === editing.label) ?? null : null
  const sources = sourcesOf(quiz, library)

  return (
    <Stack spacing={1} sx={{ containerType: 'inline-size' }}>
      {quiz.columns.length === 0 && <p className={styles.microcopy}>This quiz shows no columns.</p>}
      <SortableList
        label="Columns"
        items={quiz.columns}
        keyOf={(column) => column.label}
        disabled={! revisable}
        onMove={(label, onto_idx) => { dispatch({ kind: 'move_column', label, onto_idx }) }}
        renderRow={(column, handle) => (
          <ColumnRow column={column} sources={sources} handle={handle} locked={! revisable} dispatch={dispatch} onEdit={() => { setEditing({ kind: 'column', label: column.label }) }} />
        )}
      />
      <Stack direction="row">
        <Button size="small" variant="outlined" disabled={! revisable} onClick={() => { setEditing({ kind: 'new' }) }}>+ New column…</Button>
      </Stack>
      {editing !== null && (editing.kind === 'new' || edited !== null) && (
        <ColumnDialog key={editing.kind === 'new' ? 'new' : editing.label} quiz={quiz} sources={sources} column={edited} revisable={revisable} dispatch={dispatch} onClose={() => { setEditing(null) }} />
      )}
    </Stack>
  )
}

type ColumnRowProps = {
  column:   ColumnT
  /** What the column could show instead */
  sources:  readonly SourceChoice[]
  handle:   React.ReactNode
  locked:   boolean
  dispatch: (action: HuntActionDNA) => void
  onEdit:   () => void
}

/**
 * One column: its handle, its title to type into, what it shows to pick, its width, its
 * alignment, its label, and its gear. The lesser of those give way as the list narrows
 * (`RoomFor`). A title or width is kept when its field loses focus, a pick or a click at once.
 */
function ColumnRow({ column, sources, handle, locked, dispatch, onEdit }: Readonly<ColumnRowProps>) {
  const [issue, setIssue] = useState<string | null>(null)
  const commit = (patch: ColumnPatch) => {
    const checked = ColumnValidators.columnPatch.safeParse(patch)
    if (! checked.success) { setIssue(checked.error.issues[0]?.message ?? 'That will not do.'); return }
    setIssue(null)
    dispatch({ kind: 'edit_column', label: column.label, patch: checked.data })
  }
  const titleDraft = useDraft(column.title, (title) => { commit({ title }) })
  const columnName = column.title || column.label
  const choices = choicesFor(column, sources)

  return (
    <Stack spacing={0.5} role="group" aria-label={`Column ${columnName}`}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ pt: 1 }}>{handle}</Box>
        <TextField
          size="small" label="Column title" value={titleDraft.draft} disabled={locked} sx={{ flex: 1, minWidth: 140 }}
          onChange={(event) => { titleDraft.onChange(event.target.value) }} onBlur={titleDraft.onBlur}
        />
        <TextField
          select fullWidth size="small" label="Shows" value={choiceKeyOf(column.source, column.formula ?? null)} disabled={locked} sx={{ ...hiddenUntil(RoomFor.source), width: 240, flexShrink: 0 }}
          slotProps={{ select: { renderValue: String } }}
          onChange={(event) => {
            const choice = choices.find((each) => each.key === event.target.value)
            if (choice) { commit({ source: choice.source, formula: choice.formula }) }
          }}
        >
          {choices.map((each) => <MenuItem key={each.key} value={each.key}>{`${each.key} — ${each.group}`}</MenuItem>)}
        </TextField>
        <Box sx={{ ...hiddenUntil(RoomFor.width), width: 96, flexShrink: 0 }}>
          <NumberField
            label="Width (px)" locked={locked} fractional={false} max={WidthPxMax} committed={column.width_px}
            onCommit={(width_px) => { if (width_px !== null) { commit({ width_px }) } }}
          />
        </Box>
        <AlignButton column={column} columnName={columnName} locked={locked} onAlign={(align) => { commit({ align }) }} />
        <Box className={styles.microcopy} sx={{ ...hiddenUntil(RoomFor.label), width: 160, flexShrink: 0, pt: 1, overflowWrap: 'anywhere' }}>{column.label}</Box>
        <IconButton size="small" aria-label={`Edit column ${columnName}`} onClick={onEdit} sx={{ mt: 0.5 }}>⚙</IconButton>
      </Stack>
      {issue !== null && <p className={styles.microcopy} role="alert">{issue}</p>}
    </Stack>
  )
}

type AlignButtonProps = {
  column:     ColumnT
  /** What the column is called on screen */
  columnName: string
  locked:     boolean
  /** Told the alignment a click moves the column to */
  onAlign:    (align: ColumnAlign) => void
}

/**
 * A column's alignment, as the mark of where its header sits; a click moves it on to the next:
 * left, center, right, and round again. A column that has never been set shows where it sits
 * unset (`headAlignOf`), and says so.
 */
function AlignButton({ column, columnName, locked, onAlign }: Readonly<AlignButtonProps>) {
  const align = headAlignOf(column)
  const next = alignAfter(align)
  const unset = column.align === undefined ? ', as it sits unset' : ''
  return (
    <Tooltip title={`Aligned ${align}${unset}. Click to align ${next}.`}>
      {/* The span lets the tooltip hear the pointer while the button is disabled. */}
      <span>
        <IconButton size="small" aria-label={`Alignment of ${columnName}: ${align}`} disabled={locked} sx={{ mt: 0.5 }} onClick={() => { onAlign(next) }}>
          {AlignIcons[align]}
        </IconButton>
      </span>
    </Tooltip>
  )
}

type ColumnDialogProps = {
  quiz:      QuizT
  /** What a column of the quiz can show */
  sources:   readonly SourceChoice[]
  /** The column being edited, or null to make a new one */
  column:    ColumnT | null
  /** Whether the column may be changed: shown as it is, with nothing to apply, when not */
  revisable: boolean
  dispatch:  (action: HuntActionDNA) => void
  onClose:   () => void
}

/** Everything a column says about itself, to edit at once; nothing is applied until Apply */
function ColumnDialog({ quiz, sources, column, revisable, dispatch, onClose }: Readonly<ColumnDialogProps>) {
  const [title, setTitle] = useState(column?.title ?? '')
  const [label, setLabel] = useState(column?.label ?? '')
  const choices = column ? choicesFor(column, sources) : sources
  /** What a new column offers to show first: the first thing no column shows yet */
  const unshown = choices.find((each) => quiz.columns.every((other) => choiceKeyOf(other.source, other.formula ?? null) !== each.key)) ?? choices[0]
  const [chosen, setChosen] = useState(column ? choiceKeyOf(column.source, column.formula ?? null) : unshown?.key ?? 'notes')
  const choice = choices.find((each) => each.key === chosen) ?? choiceOf(chosen, null, '')
  const [widthPx, setWidthPx] = useState(String(column?.width_px ?? AddedColumnWidthPx))
  const [issue, setIssue] = useState<string | null>(null)
  const named = namesFor(choice.source, choice.formula)
  const typed = Labelmaker.normalize(label)
  /** The header it takes when the title is left blank: what it shows, or the label typed */
  const untitled = typed === '' ? named.title : Labelmaker.titleize(typed)

  const onApply = () => {
    const siblings = new Set(quiz.columns.filter((other) => other.label !== column?.label).map((other) => other.label))
    const picked = typed === '' ? named.label : typed
    const finalLabel = typed === '' && siblings.has(picked) ? Labelmaker.appendFallback(picked) : picked
    if (siblings.has(finalLabel)) { setIssue('Another column in this quiz already has that label.'); return }
    const fields = { label: finalLabel, title: title.trim() === '' ? untitled : title.trim(), source: choice.source, width_px: Number(widthPx), ...(choice.formula !== null && { formula: choice.formula }) }
    const checked = ColumnValidators.column.safeParse(fields)
    if (! checked.success) { setIssue(checked.error.issues[0]?.message ?? 'That column will not do.'); return }
    if (column === null) {
      dispatch({ kind: 'add_column', column: Column.fill(checked.data) })
    } else {
      const changed = Object.entries(checked.data).filter(([key, val]) => (column as Record<string, unknown>)[key] !== val)
      const formulaTaken = column.formula !== undefined && choice.formula === null ? { formula: null } : {}
      const patch: ColumnPatch = { ...Object.fromEntries(changed), ...formulaTaken }
      if (Object.keys(patch).length > 0) { dispatch({ kind: 'edit_column', label: column.label, patch }) }
    }
    onClose()
  }

  return (
    <Dialog open onClose={ignoringBackdrop(onClose)} fullWidth maxWidth="sm" aria-labelledby="column-dialog-title">
      <ClosableTitle id="column-dialog-title" onClose={onClose}>{column ? `Column: ${column.title || column.label}` : 'New column'}</ClosableTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField size="small" label="Column title" value={title} placeholder={untitled} helperText="The header the grid shows." onChange={(event) => { setTitle(event.target.value); setIssue(null) }} />
          <TextField size="small" label="Column label" value={label} placeholder={named.label} helperText="Names it in exports and in the quiz's sort memory; blank takes one from what it shows."
            onChange={(event) => { setLabel(event.target.value); setIssue(null) }} />
          <TextField select size="small" label="Shows" value={chosen} onChange={(event) => { setChosen(event.target.value); setIssue(null) }}>
            {choices.map((each) => <MenuItem key={each.key} value={each.key}>{`${each.key} — ${each.group}`}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Width (px)" type="number" value={widthPx} sx={{ maxWidth: 160 }} onChange={(event) => { setWidthPx(event.target.value); setIssue(null) }} />
          {issue !== null && <p className={styles.microcopy} role="alert">{issue}</p>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        {column && revisable
          ? (
            <ConfirmRemove
              noun="column"
              question="Remove this column from the quiz? What it showed is kept."
              onConfirm={() => { dispatch({ kind: 'delete_column', label: column.label }); onClose() }}
            />
          )
          : <span />}
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" disabled={! revisable} onClick={onApply}>Apply</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}
