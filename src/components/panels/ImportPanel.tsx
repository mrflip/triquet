'use client'

import { useState } from 'react'
import { Button } from '@mui/material'
import clsx from 'clsx'
import { Panel } from './Panel'
import * as Importing from '../../lib/importing'
import type { ImportLogEntry } from '../../lib/importing'
import type { ImportedQuestionT } from '../../models/import'
import type { QuizT } from '../../models/quiz'
import styles from '../workbench.module.css'

export type ImportPanelProps = {
  quiz:     QuizT
  locked:   boolean
  /** Fold what was read into the quiz: one entry per label */
  onImport: (questions: readonly ImportedQuestionT[]) => void
}

/**
 * The counterpart to Export: bring a quiz's questions back from a backup, or fold a
 * collaborator's edits into your own copy. What the bots replied is not pasted back: it is
 * recorded by asking.
 *
 * Results are reported twice -- a one-line summary next to the button, and a scrollable log
 * with a line per question and a nested line per validation issue. The same detail goes to the
 * browser console for anyone who wants to dig.
 */
export function ImportPanel({ quiz, locked, onImport }: Readonly<ImportPanelProps>) {
  const [pasted, setPasted] = useState('')
  const [summary, setSummary] = useState<{ text: string, ok: boolean } | null>(null)
  const [log, setLog] = useState<ImportLogEntry[]>([])

  const runImport = () => {
    const outcome = Importing.importInto(quiz, pasted)
    setSummary({ text: outcome.summary, ok: outcome.ok })
    setLog(outcome.log)
    console.warn('Triquet import:', outcome.summary, outcome.log)
    if (outcome.questions === null) { return }
    onImport(outcome.questions)
    // Only a run that actually merged something clears the box; anything else leaves the text
    // exactly where it is, so the author can fix it and retry rather than re-pasting a big blob.
    setPasted('')
  }

  return (
    <Panel
      title="Import"
      blurb="Paste back anything Export ever gave you, a single quiz, or a bare list of questions. Questions are matched by label; a field you leave out is left alone, a field set to null is cleared. Nothing is ever deleted."
    >
      <textarea
        className={styles.pasteBox}
        aria-label="Import"
        rows={6}
        placeholder="Paste exported JSON here"
        value={pasted}
        onChange={(event) => { setPasted(event.target.value) }}
      />
      <div className={styles.panelRow}>
        <Button size="small" variant="contained" disabled={locked || pasted.trim() === ''} onClick={runImport}>Import</Button>
        {summary === null ? null : (
          <span className={clsx(styles.microcopy, summary.ok ? styles.good : styles.bad)} role="status">{summary.text}</span>
        )}
      </div>
      {log.length === 0 ? null : (
        <div className={styles.importLog}>
          {log.map((entry) => (
            <div key={`${String(entry.position)}-${entry.label}`}>
              <div>
                {entry.position}. {entry.label === '' ? '(no label)' : entry.label} — {entry.outcome}
              </div>
              {entry.issues.map((issue) => (
                <div key={`${issue.fieldpath}-${issue.code}`} className={styles.importIssue}>
                  {issue.fieldpath}: {issue.message} [{issue.code}]
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
