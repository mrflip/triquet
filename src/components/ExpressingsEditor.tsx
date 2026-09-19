'use client'

import { useState } from 'react'
import { Button, IconButton, Stack, TextField } from '@mui/material'
import { ColumnEditor } from './ColumnEditor'
import { useDraft } from './use-draft'
import { ExpressingValidators, type ExpressingT } from '../models/expressing'
import type { QuizT } from '../models/quiz'
import type { WorkspaceT } from '../models/workspace'
import type { WorkspaceAction } from '../state/workspace-reducer'
import styles from './workbench.module.css'

export type ExpressingsEditorProps = {
  workspace:         WorkspaceT
  quiz:              QuizT
  dispatch:          (action: WorkspaceAction) => void
  onEditExpressions: () => void
}

/** Which column's editor is open: one of the quiz's, or a new one */
type Editing = { kind: 'column', label: string } | { kind: 'new' } | null

/**
 * A quiz's computed columns: each one's title to retitle in place, and a gear that opens
 * everything else about it -- its label, description and width, and the expression behind it.
 */
export function ExpressingsEditor({ workspace, quiz, dispatch, onEditExpressions }: Readonly<ExpressingsEditorProps>) {
  const [editing, setEditing] = useState<Editing>(null)
  const editedColumn = editing?.kind === 'column' ? quiz.expressings.find((each) => each.label === editing.label) ?? null : null

  return (
    <Stack spacing={1.5}>
      {quiz.expressings.length === 0 && <p className={styles.microcopy}>This quiz shows no computed columns yet.</p>}
      {quiz.expressings.map((expressing) => (
        <ExpressingRow
          key={expressing.label}
          expressing={expressing}
          locked={quiz.locked}
          dispatch={dispatch}
          onEdit={() => { setEditing({ kind: 'column', label: expressing.label }) }}
        />
      ))}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Button size="small" variant="outlined" disabled={quiz.locked} onClick={() => { setEditing({ kind: 'new' }) }}>+ New column…</Button>
        <Button size="small" variant="outlined" onClick={onEditExpressions}>Edit expressions…</Button>
      </Stack>
      {editing !== null && (editing.kind === 'new' || editedColumn !== null) && (
        <ColumnEditor
          key={editing.kind === 'new' ? 'new' : editing.label}
          workspace={workspace}
          quiz={quiz}
          expressing={editedColumn}
          dispatch={dispatch}
          onClose={() => { setEditing(null) }}
        />
      )}
    </Stack>
  )
}

type ExpressingRowProps = {
  expressing: ExpressingT
  locked:     boolean
  dispatch:   (action: WorkspaceAction) => void
  onEdit:     () => void
}

/** One computed column: its title to type into, and the gear that opens the rest */
function ExpressingRow({ expressing, locked, dispatch, onEdit }: Readonly<ExpressingRowProps>) {
  const [issue, setIssue] = useState<string | null>(null)
  const titleDraft = useDraft(expressing.title, (title) => {
    const checked = ExpressingValidators.expressingPatch.safeParse({ title })
    if (! checked.success) { setIssue(checked.error.issues[0]?.message ?? 'That will not do.'); return }
    setIssue(null)
    dispatch({ kind: 'edit_expressing', label: expressing.label, patch: checked.data })
  })

  return (
    <Stack direction="row" spacing={1} role="group" aria-label={`Column ${expressing.title || expressing.label}`} sx={{ alignItems: 'flex-start' }}>
      <TextField
        size="small" label="Column title" value={titleDraft.draft} disabled={locked} sx={{ flex: 1 }}
        error={issue !== null} helperText={issue ?? expressing.expression_label}
        onChange={(event) => { titleDraft.onChange(event.target.value) }} onBlur={titleDraft.onBlur}
      />
      <IconButton size="small" aria-label={`Edit column ${expressing.title || expressing.label}`} onClick={onEdit} sx={{ mt: 0.5 }}>⚙</IconButton>
    </Stack>
  )
}
