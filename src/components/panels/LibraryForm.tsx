'use client'

import { useState } from 'react'
import { Button, TextField } from '@mui/material'
import clsx from 'clsx'
import { ReadonlyBox } from './ReadonlyBox'
import * as Exporting from '../../lib/exporting'
import * as Importing from '../../lib/importing'
import * as UU from '../../lib/useful'
import type { LibraryLogEntry } from '../../lib/importing'
import type { LibraryActionDNA } from '../../models/actions'
import type { WidgetT } from '../../models/widget'
import styles from '../workbench.module.css'

export type LibraryFormProps = {
  /** The library as it stands */
  library:    readonly WidgetT[]
  /** Whether the library may be written to here (`change_library`): only copied out, when not */
  changeable: boolean
  /** Carry out a change to the library (`useLibraryActions`) */
  dispatch:   (action: LibraryActionDNA) => void
}

/**
 * The Library tab: the library of widgets on its own, apart from any hunt, to copy out; and a box
 * to paste one back, merged by label, for whoever may change it. Widgets the library lacks are
 * added, those it holds are revised, and one whose formulary differs is skipped and named in the
 * log. Nothing is removed.
 */
export function LibraryForm({ library, changeable, dispatch }: Readonly<LibraryFormProps>) {
  const [pasted, setPasted] = useState('')
  const [summary, setSummary] = useState<{ text: string, ok: boolean } | null>(null)
  const [log, setLog] = useState<LibraryLogEntry[]>([])

  const runImport = () => {
    const outcome = Importing.libraryImported(library, pasted)
    setSummary({ text: outcome.summary, ok: outcome.ok })
    setLog(outcome.log)
    if (outcome.widgets === null) { return }
    if (outcome.widgets.length > 0) { dispatch({ kind: 'import_widgets', widgets: outcome.widgets }) }
    setPasted('')
  }

  return (
    <>
      <ReadonlyBox label="Library export" text={UU.jsonify(Exporting.libraryExported(library))} rows={6} dense />
      {changeable && <LibraryImport pasted={pasted} summary={summary} log={log} onPaste={setPasted} onImport={runImport} />}
    </>
  )
}

type LibraryImportProps = {
  pasted:   string
  summary:  { text: string, ok: boolean } | null
  log:      readonly LibraryLogEntry[]
  onPaste:  (pasted: string) => void
  onImport: () => void
}

/** The box a library is pasted back into, its button, and what the last import came to */
function LibraryImport({ pasted, summary, log, onPaste, onImport }: Readonly<LibraryImportProps>) {
  return (
    <>
      <TextField
        multiline
        minRows={4}
        maxRows={12}
        fullWidth
        size="small"
        placeholder="Paste an exported library here"
        value={pasted}
        onChange={(event) => { onPaste(event.target.value) }}
        slotProps={{ htmlInput: { 'aria-label': 'Import library' } }}
        sx={{ mt: 1, '& textarea': { fontFamily: 'var(--font-data)', fontSize: 12 } }}
      />
      <div className={styles.panelRow}>
        <Button size="small" variant="contained" disabled={pasted.trim() === ''} onClick={onImport}>Import library</Button>
        {summary === null ? null : (
          <span className={clsx(styles.microcopy, summary.ok ? styles.good : styles.bad)} role="status">{summary.text}</span>
        )}
      </div>
      {log.length === 0 ? null : (
        <div className={styles.importLog}>
          {log.map((entry, idx) => (
            <div key={`${String(idx)}-${entry.label}`}>
              {entry.label === '' ? '(no label)' : entry.label} — {entry.outcome}{entry.reason === null ? '' : `: ${entry.reason}`}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
