'use client'

import { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'
import { ExpressingsEditor } from './ExpressingsEditor'
import * as Downloading from '../lib/downloading'
import * as Labelmaker from '../lib/labelmaker'
import * as QuizMirror from '../state/quiz-mirror'
import { AppNotices } from '../lib/notices'
import type { WorkspaceAction } from '../state/workspace-reducer'
import type { QuizT } from '../models/quiz'
import type { WorkspaceT } from '../models/workspace'
import styles from './workbench.module.css'

export type QuizManageModalProps = {
  open:      boolean
  onClose:   () => void
  workspace: WorkspaceT
  quiz:      QuizT
  dispatch:  (action: WorkspaceAction) => void
  /** Open the workspace's expressions for editing */
  onEditExpressions: () => void
}

/**
 * The gear icon's modal: editing this quiz's own label (top), its computed columns, its history,
 * and a quick way to open any other quiz in the workspace by name (bottom).
 */
export function QuizManageModal({ open, onClose, workspace, quiz, dispatch, onEditExpressions }: Readonly<QuizManageModalProps>) {
  const [draft, setDraft] = useState(Labelmaker.effectiveLabelOf(quiz))
  const [versionDraft, setVersionDraft] = useState(quiz.version)
  const [issue, setIssue] = useState<string | null>(null)
  const [noted, setNoted] = useState<string | null>(null)

  const onApply = () => {
    const cleaned = Labelmaker.normalize(draft)
    if (cleaned === '') { setIssue('Enter a label.'); return }
    const taken = workspace.quizzes.some((other) => other.id !== quiz.id && Labelmaker.effectiveLabelOf(other) === cleaned)
    if (taken) { setIssue('Another quiz already uses that label.'); return }
    const version = Labelmaker.normalize(versionDraft)
    if (version === '') { setIssue('Enter a version.'); return }
    dispatch({ kind: 'relabel_quiz', label: cleaned })
    dispatch({ kind: 'reversion_quiz', version })
    onClose()
  }

  const onMilestone = async () => {
    const tag = await QuizMirror.milestoneQuiz(quiz)
    setNoted(tag ?? AppNotices.nothingToMilestone)
  }

  const onDownload = async () => {
    const zipped = await QuizMirror.quizRepoZip(quiz)
    if (! zipped) { setNoted(AppNotices.noHistoryHere); return }
    Downloading.offerDownload(`${Labelmaker.effectiveLabelOf(quiz)}.zip`, zipped, 'application/zip')
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Manage this quiz</DialogTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 1 }}>
          <TextField
            label="Label"
            value={draft}
            size="small"
            disabled={quiz.locked}
            error={issue !== null}
            helperText={issue ?? "Used in this page's web address."}
            onChange={(event) => { setDraft(event.target.value); setIssue(null) }}
          />
          <TextField
            label="Version"
            value={versionDraft}
            size="small"
            disabled={quiz.locked}
            helperText="The line of work this quiz is on, and the branch its history is kept on."
            onChange={(event) => { setVersionDraft(event.target.value); setIssue(null) }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onApply} variant="contained" disabled={quiz.locked}>Apply</Button>
      </DialogActions>

      <DialogTitle sx={{ pt: 0 }}>Computed columns</DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <p className={styles.microcopy}>
          Each column works out one expression for every question, shown between Q# and Alt Text.
        </p>
        <ExpressingsEditor workspace={workspace} quiz={quiz} dispatch={dispatch} onEditExpressions={onEditExpressions} />
      </DialogContent>

      <DialogTitle sx={{ pt: 0 }}>History</DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <p className={styles.microcopy}>
          Every change to this quiz is committed as it happens. Marking a milestone tags this
          moment so you can come back to it; downloading hands you the whole thing as a git repository.
        </p>
        <Stack direction="row" spacing={1}>
          <Button onClick={() => { void onMilestone() }} size="small" variant="outlined">Mark a milestone</Button>
          <Button onClick={() => { void onDownload() }} size="small" variant="outlined">Download as git</Button>
        </Stack>
        {noted !== null && <p className={styles.microcopy} role="status">{noted}</p>}
      </DialogContent>

      <DialogTitle sx={{ pt: 0 }}>All quizzes</DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Stack spacing={0.5}>
          {workspace.quizzes.map((other) => (
            <Button
              key={other.id}
              variant={other.id === quiz.id ? 'contained' : 'outlined'}
              size="small"
              onClick={() => { dispatch({ kind: 'open_quiz', quiz_id: other.id }); onClose() }}
            >
              {other.locked ? '🔒 ' : ''}{other.title === '' ? AppNotices.untitledQuiz : other.title}
            </Button>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
