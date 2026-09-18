'use client'

import { useState } from 'react'
import { Button } from '@mui/material'
import clsx from 'clsx'
import { Panel } from './Panel'
import { importInto, type ImportLogEntry } from '../../lib/importing'
import type { QuizT } from '../../models/quiz'
import styles from '../workbench.module.css'

export type ImportPanelProps = {
  quiz:     QuizT
  locked:   boolean
  onMerged: (quiz: QuizT) => void
}

/**
 * The counterpart to Export: move a round between browsers, recover a backup, or fold a
 * collaborator's edits back into your own copy.
 *
 * Results are reported twice -- a one-line summary next to the button, and a scrollable log
 * with a line per question and a nested line per validation issue. The same detail goes to the
 * browser console for anyone who wants to dig.
 */
export function ImportPanel({ quiz, locked, onMerged }: Readonly<ImportPanelProps>) {
  const [pasted, setPasted] = useState('')
  const [summary, setSummary] = useState<{ text: string, ok: boolean } | null>(null)
  const [log, setLog] = useState<ImportLogEntry[]>([])

  const runImport = () => {
    const outcome = importInto(quiz, pasted)
    setSummary({ text: outcome.summary, ok: outcome.ok })
    setLog(outcome.log)
    console.warn('Triquet import:', outcome.summary, outcome.log)
    if (outcome.quiz === null) { return }
    onMerged(outcome.quiz)
    // Only a run that actually merged something clears the box; anything else leaves the text
    // exactly where it is, so the author can fix it and retry rather than re-pasting a big blob.
    setPasted('')
  }

  return (
    <Panel
      title="Import"
      blurb="Paste back anything Export ever gave you, a single round, or a bare list of questions. Questions are matched by short answer; a field you leave out is left alone, a field set to null is cleared. Nothing is ever deleted."
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
            <div key={`${String(entry.position)}-${entry.short_answer}`}>
              <div>
                {entry.position}. {entry.short_answer === '' ? '(no short answer)' : entry.short_answer} — {entry.outcome}
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
