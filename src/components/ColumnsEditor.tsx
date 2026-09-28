'use client'

import { useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, IconButton, MenuItem, Stack, TextField } from '@mui/material'
import { ClosableTitle, ignoringBackdrop } from './ClosableTitle'
import { ConfirmRemove } from './ConfirmRemove'
import { SortableList } from './SortableList'
import { useDraft } from './use-draft'
import * as Labelmaker from '../lib/labelmaker'
import { Column, ColumnValidators, QuestionFieldVals, QuestionViewVals, type ColumnT } from '../models/column'
import { QuestionWidgetLabel } from '../models/widget'
import type { QuizT } from '../models/quiz'
import type { HuntActionDNA } from '../models/actions'
import styles from './workbench.module.css'

export type ColumnsEditorProps = {
  quiz:     QuizT
  dispatch: (action: HuntActionDNA) => void
}

/** Which column's editor is open: one of the quiz's, or a new one */
type Editing = { kind: 'column', label: string } | { kind: 'new' } | null

/** How wide a new column starts */
const NewColumnWidthPx = 180

/**
 * A quiz's columns: every one listed in the order the grid shows them, dragged into a new order by
 * its handle, with its title to retitle in place, its label beside that where there is room, and a
 * gear that opens the rest.
 */
export function ColumnsEditor({ quiz, dispatch }: Readonly<ColumnsEditorProps>) {
  const [editing, setEditing] = useState<Editing>(null)
  const edited = editing?.kind === 'column' ? quiz.columns.find((each) => each.label === editing.label) ?? null : null

  return (
    <Stack spacing={1}>
      {quiz.columns.length === 0 && <p className={styles.microcopy}>This quiz shows no columns.</p>}
      <SortableList
        label="Columns"
        items={quiz.columns}
        keyOf={(column) => column.label}
        disabled={quiz.locked}
        onMove={(label, onto_idx) => { dispatch({ kind: 'move_column', label, onto_idx }) }}
        renderRow={(column, handle) => (
          <ColumnRow column={column} handle={handle} locked={quiz.locked} dispatch={dispatch} onEdit={() => { setEditing({ kind: 'column', label: column.label }) }} />
        )}
      />
      <Stack direction="row">
        <Button size="small" variant="outlined" disabled={quiz.locked} onClick={() => { setEditing({ kind: 'new' }) }}>+ New column…</Button>
      </Stack>
      {editing !== null && (editing.kind === 'new' || edited !== null) && (
        <ColumnDialog key={editing.kind === 'new' ? 'new' : editing.label} quiz={quiz} column={edited} dispatch={dispatch} onClose={() => { setEditing(null) }} />
      )}
    </Stack>
  )
}

type ColumnRowProps = {
  column:   ColumnT
  handle:   React.ReactNode
  locked:   boolean
  dispatch: (action: HuntActionDNA) => void
  onEdit:   () => void
}

/** One column: its handle, its title to type into, its label where there is room, and its gear */
function ColumnRow({ column, handle, locked, dispatch, onEdit }: Readonly<ColumnRowProps>) {
  const [issue, setIssue] = useState<string | null>(null)
  const titleDraft = useDraft(column.title, (title) => {
    const checked = ColumnValidators.columnPatch.safeParse({ title })
    if (! checked.success) { setIssue(checked.error.issues[0]?.message ?? 'That will not do.'); return }
    setIssue(null)
    dispatch({ kind: 'edit_column', label: column.label, patch: checked.data })
  })

  return (
    <Stack direction="row" spacing={1} role="group" aria-label={`Column ${column.title || column.label}`} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ pt: 1 }}>{handle}</Box>
      <TextField
        size="small" label="Column title" value={titleDraft.draft} disabled={locked} sx={{ flex: 1, minWidth: 0 }}
        error={issue !== null} helperText={issue ?? column.source}
        onChange={(event) => { titleDraft.onChange(event.target.value) }} onBlur={titleDraft.onBlur}
      />
      <Box className={styles.microcopy} sx={{ display: { xs: 'none', md: 'block' }, width: 180, pt: 1, overflowWrap: 'anywhere' }}>{column.label}</Box>
      <IconButton size="small" aria-label={`Edit column ${column.title || column.label}`} onClick={onEdit} sx={{ mt: 0.5 }}>⚙</IconButton>
    </Stack>
  )
}

type ColumnDialogProps = {
  quiz:     QuizT
  /** The column being edited, or null to make a new one */
  column:   ColumnT | null
  dispatch: (action: HuntActionDNA) => void
  onClose:  () => void
}

/** Everything a column says about itself, to edit at once; nothing is applied until Apply */
function ColumnDialog({ quiz, column, dispatch, onClose }: Readonly<ColumnDialogProps>) {
  const sources = [
    ...QuestionFieldVals.map((field) => ({ value: `${QuestionWidgetLabel}.${field}`, group: 'A question field' })),
    ...QuestionViewVals.map((view) => ({ value: `${QuestionWidgetLabel}.${view}`, group: 'Worked out from the chain' })),
    ...quiz.widgets.map((widget) => ({ value: widget.label, group: `A ${widget.kind} widget` })),
  ]
  const [title, setTitle] = useState(column?.title ?? '')
  const [label, setLabel] = useState(column?.label ?? '')
  const [source, setSource] = useState(column?.source ?? sources[0]?.value ?? 'question.notes')
  const [widthPx, setWidthPx] = useState(String(column?.width_px ?? NewColumnWidthPx))
  const [issue, setIssue] = useState<string | null>(null)

  const onApply = () => {
    const siblings = new Set(quiz.columns.filter((other) => other.label !== column?.label).map((other) => other.label))
    const typed = Labelmaker.normalize(label)
    const chosen = typed === '' ? Labelmaker.normalize(source.replace('.', '_')) : typed
    const finalLabel = typed === '' && siblings.has(chosen) ? Labelmaker.appendFallback(chosen) : chosen
    if (siblings.has(finalLabel)) { setIssue('Another column in this quiz already has that label.'); return }
    const fields = { label: finalLabel, title: title.trim() === '' ? Labelmaker.titleize(finalLabel) : title.trim(), source, width_px: Number(widthPx) }
    const checked = ColumnValidators.column.safeParse(fields)
    if (! checked.success) { setIssue(checked.error.issues[0]?.message ?? 'That column will not do.'); return }
    if (column === null) {
      dispatch({ kind: 'add_column', column: Column.fill(checked.data) })
    } else {
      const changed = Object.entries(checked.data).filter(([key, val]) => (column as Record<string, unknown>)[key] !== val)
      if (changed.length > 0) { dispatch({ kind: 'edit_column', label: column.label, patch: Object.fromEntries(changed) }) }
    }
    onClose()
  }

  return (
    <Dialog open onClose={ignoringBackdrop(onClose)} fullWidth maxWidth="sm" aria-labelledby="column-dialog-title">
      <ClosableTitle id="column-dialog-title" onClose={onClose}>{column ? `Column: ${column.title || column.label}` : 'New column'}</ClosableTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField size="small" label="Column title" value={title} helperText="The header the grid shows." onChange={(event) => { setTitle(event.target.value); setIssue(null) }} />
          <TextField size="small" label="Column label" value={label} placeholder={source} helperText="Names it in exports and in the quiz's sort memory; blank takes one from what it shows."
            onChange={(event) => { setLabel(event.target.value); setIssue(null) }} />
          <TextField select size="small" label="Shows" value={source} onChange={(event) => { setSource(event.target.value); setIssue(null) }}>
            {sources.map((each) => <MenuItem key={each.value} value={each.value}>{`${each.value} — ${each.group}`}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Width (px)" type="number" value={widthPx} sx={{ maxWidth: 160 }} onChange={(event) => { setWidthPx(event.target.value); setIssue(null) }} />
          {issue !== null && <p className={styles.microcopy} role="alert">{issue}</p>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        {column
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
          <Button variant="contained" onClick={onApply}>Apply</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}
