'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, TextField } from '@mui/material'
import clsx from 'clsx'
import * as PendingImports from '../pending-imports'
import * as Importing from '../../lib/importing'
import { AppNotices } from '../../lib/notices'
import type { ElsewhereT } from '../../lib/importing'
import type { HuntActionDNA } from '../../models/actions'
import type { QuizT } from '../../models/quiz'
import type { WidgetT } from '../../models/widget'
import styles from '../workbench.module.css'

export type ImportFormProps = {
  /** The hunt the quiz belongs to: where a paste sent from another of its quizzes waits */
  hunt_id:  string
  quiz:     QuizT
  /** The library, whose widgets a pasted widgeting must name */
  library:  readonly WidgetT[]
  locked:   boolean
  /** Fold what was read into the quiz: its own fields, its widgetings, its columns, then its questions, as actions in order */
  onImport: (actions: readonly HuntActionDNA[]) => void
  /** Send a paste read as a hunt none of whose quizzes matches this one to the quiz it belongs to (`ElsewhereT`), to be read there */
  onElsewhere: (elsewhere: ElsewhereT, pasted: string) => void
}

/**
 * The Import tab, the counterpart to Raw Export: bring a quiz back from a backup -- its questions,
 * widgetings and columns, its title and notes -- or fold a collaborator's edits into your own
 * copy. What the widgetings came to is not pasted back: it is worked out again, or recorded by
 * asking.
 *
 * Results are reported twice -- a one-line summary next to the button, and a scrollable log
 * with a line per question and a nested line per validation issue. The same detail goes to the
 * browser console for anyone who wants to dig.
 *
 * A hunt pasted here whose quizzes match none of this one is sent on to the quiz of its first
 * quiz's label (`onElsewhere`), whose own Import reads it the moment it is on screen
 * (`PendingImports`).
 */
export function ImportForm({ hunt_id, quiz, library, locked, onImport, onElsewhere }: Readonly<ImportFormProps>) {
  const [pasted, setPasted] = useState('')
  // A paste sent here from another quiz's Import is read as this quiz opens, and what it came to
  // shows from the first.
  const pendingKey = PendingImports.keyOf(hunt_id, quiz.label)
  const [arrival] = useState(() => {
    const pending = locked ? null : PendingImports.peek(pendingKey)
    return pending && Importing.importInto(quiz, pending.pasted, library, { take: pending.take })
  })
  // A paste sent to a locked quiz is not read, nor kept to be read on a later visit: it is let
  // go, and the summary says so.
  const [turnedAway] = useState(() => locked && PendingImports.peek(pendingKey) !== null)
  const [shown, setShown] = useState<Importing.ImportOutcome | null>(arrival)
  const { summary = turnedAway ? AppNotices.importSentToLocked : null, ok = false, log = [], widgetingLog = [], columnLog = [], fieldLog = [] } = shown ?? {}

  const runImport = () => {
    const outcome = Importing.importInto(quiz, pasted, library)
    setShown(outcome)
    reported(outcome)
    if (outcome.elsewhere) {
      onElsewhere(outcome.elsewhere, pasted)
      setPasted('')
      return
    }
    if (outcome.questions === null) { return }
    onImport(outcome.actions)
    // Only a run that actually merged something clears the box; anything else leaves the text
    // exactly where it is, so the author can fix it and retry rather than re-pasting a big blob.
    setPasted('')
  }

  // What the paste sent here came to is folded in once: the ref keeps a remounted effect (React's
  // strict mode) from sending it twice.
  const sentHere = useRef(false)
  useEffect(() => {
    if (! arrival || sentHere.current) { return }
    sentHere.current = true
    PendingImports.clear(pendingKey)
    reported(arrival)
    if (arrival.questions !== null) { onImport(arrival.actions) }
  }, [arrival, onImport, pendingKey])
  useEffect(() => {
    if (turnedAway) { PendingImports.clear(pendingKey) }
  }, [turnedAway, pendingKey])

  return (
    <>
      <TextField
        multiline
        minRows={6}
        maxRows={16}
        fullWidth
        size="small"
        placeholder="Paste exported JSON here"
        value={pasted}
        onChange={(event) => { setPasted(event.target.value) }}
        slotProps={{ htmlInput: { 'aria-label': 'Import' } }}
        sx={{ mt: 1, '& textarea': { fontFamily: 'var(--font-data)', fontSize: 12 } }}
      />
      <div className={styles.panelRow}>
        <Button size="small" variant="contained" disabled={locked || pasted.trim() === ''} onClick={runImport}>Import</Button>
        {summary === null ? null : (
          <span className={clsx(styles.microcopy, ok ? styles.good : styles.bad)} role="status">{summary}</span>
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
          {widgetingLog.map((entry, idx) => (
            <div key={`widgeting-${String(idx)}-${entry.label}`}>
              widgeting {entry.label === '' ? '(no label)' : entry.label} — {entry.outcome}{entry.reason === null ? '' : `: ${entry.reason}`}
            </div>
          ))}
          {columnLog.map((entry, idx) => (
            <div key={`column-${String(idx)}-${entry.label}`}>
              column {entry.label === '' ? '(no label)' : entry.label} — {entry.outcome}{entry.reason === null ? '' : `: ${entry.reason}`}
            </div>
          ))}
          {fieldLog.map((entry) => (
            <div key={`field-${entry.fieldname}`}>
              {entry.fieldname} — {entry.outcome}{entry.reason === null ? '' : `: ${entry.reason}`}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/** What an import came to, in the console too, for anyone who wants to dig */
function reported(outcome: Importing.ImportOutcome): void {
  console.warn('Triquet import:', outcome.summary, outcome.log, outcome.widgetingLog, outcome.columnLog, outcome.fieldLog)
}
