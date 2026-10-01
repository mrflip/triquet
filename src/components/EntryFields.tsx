'use client'

import { MenuItem, Stack, TextField } from '@mui/material'
import { EntryKindWords } from './widget-words'
import { EntryKindVals, type EntryKind } from '../models/widget'
import type { EntryDraft } from '../state/widget-edit'
import styles from './workbench.module.css'

export type EntryFieldsProps = {
  draft:         EntryDraft
  onChange:      (patch: Partial<EntryDraft>) => void
  /** A new widget is named, and its kind chosen, here; an existing one keeps both */
  labelEditable: boolean
  /** What is wrong with the label being typed, when something is */
  labelIssue:    string | null
}

/**
 * An `entry` widget's label, description and kind: what its cells take, typed in by hand. There
 * is no formula to write, so no preview and no advice. The kind is chosen once, with the label:
 * the values typed into its cells hang on it.
 */
export function EntryFields({ draft, onChange, labelEditable, labelIssue }: Readonly<EntryFieldsProps>) {
  return (
    <Stack spacing={1.5}>
      {labelEditable
        ? (
          <TextField
            size="small" label="Widget label" value={draft.label} sx={{ maxWidth: 320 }}
            error={labelIssue !== null} helperText={labelIssue ?? 'What the widget is called in the library, for choosing it again. It cannot be changed afterward.'}
            onChange={(event) => { onChange({ label: event.target.value }) }}
          />
        )
        : <div><strong>{draft.label}</strong> <span className={styles.microcopy}>widget</span></div>}
      <TextField
        size="small" label="Widget description" value={draft.description}
        helperText="What is typed into it, for whoever is choosing between widgets."
        onChange={(event) => { onChange({ description: event.target.value }) }}
      />
      <TextField
        select size="small" label="Entry kind" value={draft.config.entry_kind} disabled={! labelEditable} sx={{ maxWidth: 520 }}
        helperText={labelEditable ? 'What its cells take. It cannot be changed afterward: the values typed hang on it.' : 'What its cells take, fixed once the widget was made.'}
        onChange={(event) => { onChange({ config: { entry_kind: event.target.value as EntryKind } }) }}
      >
        {EntryKindVals.map((entry_kind) => <MenuItem key={entry_kind} value={entry_kind}>{EntryKindWords[entry_kind]}</MenuItem>)}
      </TextField>
    </Stack>
  )
}
