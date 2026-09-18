'use client'

import { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'
import { effectiveLabelOf, normalize } from '../lib/labelmaker'
import { AppNotices } from '../lib/notices'
import type { WorkspaceAction } from '../state/workspace-reducer'
import type { QuizT } from '../models/quiz'
import type { WorkspaceT } from '../models/workspace'

export type QuizManageModalProps = {
  open:      boolean
  onClose:   () => void
  workspace: WorkspaceT
  quiz:      QuizT
  dispatch:  (action: WorkspaceAction) => void
}

/**
 * The gear icon's modal: editing this quiz's own label (top), and a quick way to open any other
 * quiz in the workspace by name (bottom).
 */
export function QuizManageModal({ open, onClose, workspace, quiz, dispatch }: Readonly<QuizManageModalProps>) {
  const [draft, setDraft] = useState(effectiveLabelOf(quiz))
  const [issue, setIssue] = useState<string | null>(null)

  const onSave = () => {
    const cleaned = normalize(draft)
    if (cleaned === '') { setIssue('Enter a label.'); return }
    const taken = workspace.quizzes.some((other) => other.id !== quiz.id && effectiveLabelOf(other) === cleaned)
    if (taken) { setIssue('Another quiz already uses that label.'); return }
    dispatch({ kind: 'relabel_quiz', label: cleaned })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} variant="contained" disabled={quiz.locked}>Save</Button>
      </DialogActions>

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
