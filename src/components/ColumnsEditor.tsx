'use client'

import { useId, useState } from 'react'
import { Box, Button, Collapse, Dialog, DialogActions, DialogContent, IconButton, Stack, TextField, Tooltip } from '@mui/material'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import { ClosableTitle, ignoringBackdrop } from './ClosableTitle'
import { ColumnRefField, ColumnStagesFields } from './ColumnFields'
import { ConfirmRemove } from './ConfirmRemove'
import { FoldButton } from './FoldButton'
import { FormulaField } from './FormulaField'
import { NumberField } from './cells/fields'
import { SortableList } from './SortableList'
import { useDraft } from './use-draft'
import { hiddenUntil } from './room'
import * as Labelmaker from '../lib/labelmaker'
import * as ColumnMenu from '../lib/column-menu'
import { alignAfter, headAlignOf, resolve } from '../lib/columns'
import { Column, ColumnValidators, WidthPxMax, namesFor, plainOf, type ColumnAlign, type ColumnPatch, type ColumnT } from '../models/column'
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

/**
 * A quiz's columns: every one listed in the order the grid shows them, dragged into a new order by
 * its handle, with its title, what it shows, its width and its alignment to change in place, its
 * label beside those, and a gear that opens the rest. The list measures its own width, not the
 * window's, to decide which of those there is room for.
 */
export function ColumnsEditor({ quiz, library, revisable, dispatch }: Readonly<ColumnsEditorProps>) {
  const [editing, setEditing] = useState<Editing>(null)
  const edited = editing?.kind === 'column' ? quiz.columns.find((each) => each.label === editing.label) ?? null : null
  const sources = ColumnMenu.refChoicesOf(quiz)

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
          <ColumnRow column={column} quiz={quiz} library={library} sources={sources} handle={handle} locked={! revisable} dispatch={dispatch} onEdit={() => { setEditing({ kind: 'column', label: column.label }) }} />
        )}
      />
      <Stack direction="row">
        <Button size="small" variant="outlined" disabled={! revisable} onClick={() => { setEditing({ kind: 'new' }) }}>+ New column…</Button>
      </Stack>
      {editing !== null && (editing.kind === 'new' || edited !== null) && (
        <ColumnDialog key={editing.kind === 'new' ? 'new' : editing.label} quiz={quiz} library={library} sources={sources} column={edited} revisable={revisable} dispatch={dispatch} onClose={() => { setEditing(null) }} />
      )}
    </Stack>
  )
}

type ColumnRowProps = {
  column:   ColumnT
  quiz:     QuizT
  /** The library, which says what a widgeting shown is, for the formulas offered beside it */
  library:  readonly WidgetT[]
  /** What the column could show instead */
  sources:  readonly ColumnMenu.RefChoice[]
  handle:   React.ReactNode
  locked:   boolean
  dispatch: (action: HuntActionDNA) => void
  onEdit:   () => void
}

/**
 * One column: its handle, its title to type into, what it shows to pick, its width, its
 * alignment, its label, and its gear; and, unfolded beneath, what it does with what it shows:
 * its formula, template, readout and collapse (`ColumnStagesFields`). The lesser of the first
 * line give way as the list narrows (`RoomFor`). A title, width, formula or template is kept when
 * its field loses focus, a pick or a click at once.
 */
function ColumnRow({ column, quiz, library, sources, handle, locked, dispatch, onEdit }: Readonly<ColumnRowProps>) {
  const [issue, setIssue] = useState<string | null>(null)
  const [unfolded, setUnfolded] = useState(false)
  const stagesId = useId()
  const commit = (patch: ColumnPatch) => {
    const checked = ColumnValidators.columnPatch.safeParse(patch)
    if (! checked.success) { setIssue(checked.error.issues[0]?.message ?? 'That will not do.'); return }
    setIssue(null)
    dispatch({ kind: 'edit_column', label: column.label, patch: checked.data })
  }
  const titleDraft = useDraft(column.title, (title) => { commit({ title }) })
  const columnName = column.title || column.label

  return (
    <Stack spacing={0.5} role="group" aria-label={`Column ${columnName}`}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ pt: 1 }}>{handle}</Box>
        <Box sx={{ pt: 0.5 }}>
          <FoldButton open={unfolded} onOpenChange={setUnfolded} label={`Formula, template and readout of ${columnName}`} controls={stagesId} />
        </Box>
        <TextField
          size="small" label="Column title" value={titleDraft.draft} disabled={locked} sx={{ flex: 1, minWidth: 140 }}
          onChange={(event) => { titleDraft.onChange(event.target.value) }} onBlur={titleDraft.onBlur}
        />
        <ColumnRefField
          source={plainOf(column).source} choices={sources} locked={locked} sx={{ ...hiddenUntil(RoomFor.source), width: 240, flexShrink: 0 }}
          onPick={(source) => { commit({ source }) }}
        />
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
      <Collapse in={unfolded} unmountOnExit id={stagesId}>
        <Box sx={{ pl: 8, pt: 1, pb: 1 }}>
          <ColumnStagesFields column={column} quiz={quiz} library={library} locked={locked} onCommit={commit} />
        </Box>
      </Collapse>
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
  /** The library, which says what a widgeting shown is, for the formulas offered beside it */
  library:   readonly WidgetT[]
  /** What a column of the quiz can show */
  sources:   readonly ColumnMenu.RefChoice[]
  /** The column being edited, or null to make a new one */
  column:    ColumnT | null
  /** Whether the column may be changed: shown as it is, with nothing to apply, when not */
  revisable: boolean
  dispatch:  (action: HuntActionDNA) => void
  onClose:   () => void
}

/**
 * Everything a column says about itself, to edit at once; nothing is applied until Apply. A new
 * column takes its formula here too; an existing one's is changed in its row, as it is made.
 */
function ColumnDialog({ quiz, library, sources, column, revisable, dispatch, onClose }: Readonly<ColumnDialogProps>) {
  const [title, setTitle] = useState(column?.title ?? '')
  const [label, setLabel] = useState(column?.label ?? '')
  /** What a new column offers to show first: the first thing no column shows yet */
  const unshown = sources.find((each) => quiz.columns.every((other) => plainOf(other).source !== each.source)) ?? sources[0]
  const [chosen, setChosen] = useState(column ? plainOf(column).source : unshown?.source ?? 'notes')
  const [formula, setFormula] = useState<string | null>(null)
  const [widthPx, setWidthPx] = useState(String(column?.width_px ?? AddedColumnWidthPx))
  const [issue, setIssue] = useState<string | null>(null)
  const named = namesFor(chosen, column ? plainOf(column).formula ?? null : formula)
  const typed = Labelmaker.normalize(label)
  /** The header it takes when the title is left blank: what it shows, or the label typed */
  const untitled = typed === '' ? named.title : Labelmaker.titleize(typed)
  const shown = resolve(chosen, quiz.widgetings)
  const presets = shown === null ? [] : ColumnMenu.presetsFor(ColumnMenu.subjectOf(shown, library))

  const onApply = () => {
    const siblings = new Set(quiz.columns.filter((other) => other.label !== column?.label).map((other) => other.label))
    const picked = typed === '' ? named.label : typed
    const finalLabel = typed === '' && siblings.has(picked) ? Labelmaker.appendFallback(picked) : picked
    if (siblings.has(finalLabel)) { setIssue('Another column in this quiz already has that label.'); return }
    const fields = { label: finalLabel, title: title.trim() === '' ? untitled : title.trim(), source: chosen, width_px: Number(widthPx), ...(column === null && formula !== null && { formula }) }
    const checked = ColumnValidators.column.safeParse(fields)
    if (! checked.success) { setIssue(checked.error.issues[0]?.message ?? 'That column will not do.'); return }
    if (column === null) {
      dispatch({ kind: 'add_column', column: Column.fill(checked.data) })
    } else {
      const changed = Object.entries(checked.data).filter(([key, val]) => (column as Record<string, unknown>)[key] !== val)
      const patch: ColumnPatch = Object.fromEntries(changed)
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
          <ColumnRefField source={chosen} choices={sources} locked={false} onPick={(source) => { setChosen(source); setIssue(null) }} />
          {column === null && (
            <FormulaField
              label="Formula" committed={formula} presets={presets} locked={false} placeholder="The thing itself"
              helperText="What to show of it: blank shows it as it is."
              onCommit={(next) => { setFormula(next); setIssue(null) }}
            />
          )}
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
