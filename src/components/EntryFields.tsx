'use client'

import { Box, MenuItem, Stack, TextField } from '@mui/material'
import { Explained } from './InfoTip'
import { EntryParamsFields } from './EntryParamsFields'
import { EntryKindWords } from './widget-words'
import { EntryFormulary } from '../lib/formulary/entry'
import { OfferedEntryKindVals, type EntryKind } from '../models/widget'
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
 * An `entry` widget's label, description and kind: what its cells take, typed in by hand; and the
 * params its widgetings start from, each of which a widgeting may say otherwise. There is no
 * formula to write, so no preview and no advice. The kind is chosen once, with the label, from
 * one per family (`OfferedEntryKindVals`): the values typed into its cells hang on it.
 */
export function EntryFields({ draft, onChange, labelEditable, labelIssue }: Readonly<EntryFieldsProps>) {
  const { entry_kind, ...defaults } = draft.config
  const offered = OfferedEntryKindVals.includes(entry_kind) ? OfferedEntryKindVals : [...OfferedEntryKindVals, entry_kind]
  return (
    <Stack spacing={1.5}>
      {labelEditable
        ? (
          <Box sx={{ maxWidth: 320 }}>
            <Explained topic="the widget label" about="What the widget is called in the library, for choosing it again. It cannot be changed afterward.">
              <TextField
                size="small" label="Widget label" value={draft.label}
                error={labelIssue !== null} helperText={labelIssue}
                onChange={(event) => { onChange({ label: event.target.value }) }}
              />
            </Explained>
          </Box>
        )
        : <div><strong>{draft.label}</strong> <span className={styles.microcopy}>widget</span></div>}
      <Explained topic="the widget description" about="What is typed into it, for whoever is choosing between widgets.">
        <TextField
          size="small" label="Widget description" value={draft.description}
          onChange={(event) => { onChange({ description: event.target.value }) }}
        />
      </Explained>
      <Box sx={{ maxWidth: 520 }}>
        <Explained topic="the entry kind" about={labelEditable ? 'What its cells take. It cannot be changed afterward: the values typed hang on it.' : 'What its cells take, fixed once the widget was made.'}>
          <TextField
            select size="small" label="Entry kind" value={entry_kind} disabled={! labelEditable}
            onChange={(event) => { onChange({ config: { entry_kind: event.target.value as EntryKind } }) }}
          >
            {offered.map((kind) => <MenuItem key={kind} value={kind}>{EntryKindWords[kind]}</MenuItem>)}
          </TextField>
        </Explained>
      </Box>
      <div className={styles.microcopy}>What every widgeting of it starts from; each may say otherwise for its own quiz.</div>
      <EntryParamsFields
        entry_kind={entry_kind} params={defaults} inherited={{}} validator={EntryFormulary.paramsOf({ config: { entry_kind } })} disabled={false}
        onChange={(params) => { onChange({ config: { entry_kind, ...params } }) }}
      />
    </Stack>
  )
}
