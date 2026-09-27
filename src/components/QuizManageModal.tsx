'use client'

import { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, Stack, TextField, Typography } from '@mui/material'
import { ClosableTitle } from './ClosableTitle'
import { ColumnsEditor } from './ColumnsEditor'
import { WidgetsEditor } from './WidgetsEditor'
import * as Labelmaker from '../lib/labelmaker'
import * as QuizMirror from '../state/quiz-mirror'
import { AppNotices } from '../lib/notices'
import type { HuntAction } from '../state/actions'
import type { HuntT } from '../models/hunt'
import type { QuizT } from '../models/quiz'
import type { RealmT } from '../models/realm'
import styles from './workbench.module.css'

export type QuizManageModalProps = {
  open:      boolean
  onClose:   () => void
  hunt:      HuntT
  realm:     RealmT
  quiz:      QuizT
  dispatch:  (action: HuntAction) => void
  /** Told the quiz's new label once it has one, so the address can follow it there */
  onRelabelled: (label: string) => void
  /** Go to another quiz of the realm */
  onOpen:    (quiz: QuizT) => void
  /** Open the hunt's expressions for editing */
  onEditExpressions: () => void
}

/**
 * The gear icon's modal: editing this quiz's own label (top), its computed columns, its history,
 * and a quick way to open any other quiz in the realm by name (bottom).
 */
export function QuizManageModal({ open, onClose, hunt, realm, quiz, dispatch, onRelabelled, onOpen, onEditExpressions }: Readonly<QuizManageModalProps>) {
  const [draft, setDraft] = useState(Labelmaker.effectiveLabelOf(quiz))
  const [versionDraft, setVersionDraft] = useState(quiz.version)
  const [issue, setIssue] = useState<string | null>(null)
  const [noted, setNoted] = useState<string | null>(null)

  const onApply = () => {
    const cleaned = Labelmaker.normalize(draft)
    if (cleaned === '') { setIssue('Enter a label.'); return }
    const taken = realm.quizzes.some((other) => other.id !== quiz.id && Labelmaker.effectiveLabelOf(other) === cleaned)
    if (taken) { setIssue('Another quiz already uses that label.'); return }
    const version = Labelmaker.normalize(versionDraft)
    if (version === '') { setIssue('Enter a version.'); return }
    const moved = cleaned !== Labelmaker.effectiveLabelOf(quiz)
    dispatch({ kind: 'relabel_quiz', label: cleaned })
    dispatch({ kind: 'reversion_quiz', version })
    // The quiz is addressed by its label, so a relabel is also a move.
    if (moved) { onRelabelled(cleaned) }
    onClose()
  }

  const onMilestone = async () => {
    const tag = await QuizMirror.milestoneQuiz(quiz)
    setNoted(tag ?? AppNotices.nothingToMilestone)
  }

  const onDownload = async () => {
    if (! await QuizMirror.downloadQuizRepo(quiz)) { setNoted(AppNotices.noHistoryHere) }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" aria-labelledby="manage-title">
      <ClosableTitle id="manage-title" onClose={onClose}>Manage this quiz</ClosableTitle>
      {/* One scrolling region for the whole dialog: each section is as tall as what it holds. */}
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Stack spacing={1}>
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

          <section>
            <Typography variant="h6" component="h3">Columns</Typography>
            <p className={styles.microcopy}>The grid&apos;s columns in the order they appear. Drag a handle to move one; the gear opens the rest.</p>
            <ColumnsEditor quiz={quiz} dispatch={dispatch} />
          </section>

          <section>
            <Typography variant="h6" component="h3">Widgets</Typography>
            <p className={styles.microcopy}>What this quiz can show for every question besides the questions&apos; own fields: bots put to it, and expressions put to work. A column shows a widget.</p>
            <WidgetsEditor hunt={hunt} quiz={quiz} dispatch={dispatch} onEditExpressions={onEditExpressions} />
          </section>

          <section>
            <Typography variant="h6" component="h3">History</Typography>
            <p className={styles.microcopy}>
              Every change to this quiz is committed as it happens. Marking a milestone tags this
              moment so you can come back to it; downloading hands you the whole thing as a git repository.
            </p>
            <Stack direction="row" spacing={1}>
              <Button onClick={() => { void onMilestone() }} size="small" variant="outlined">Mark a milestone</Button>
              <Button onClick={() => { void onDownload() }} size="small" variant="outlined">Download as git</Button>
            </Stack>
            {noted !== null && <p className={styles.microcopy} role="status">{noted}</p>}
          </section>

          <section>
            <Typography variant="h6" component="h3">All quizzes</Typography>
            <Stack spacing={0.5} sx={{ maxHeight: '60vh', overflowY: 'auto', mt: 1 }}>
              {realm.quizzes.map((other) => (
                <Button
                  key={other.id}
                  variant={other.id === quiz.id ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => { onOpen(other); onClose() }}
                >
                  {other.locked ? '🔒 ' : ''}{other.title === '' ? AppNotices.untitledQuiz : other.title}
                </Button>
              ))}
            </Stack>
          </section>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onApply} variant="contained" disabled={quiz.locked}>Apply</Button>
      </DialogActions>
    </Dialog>
  )
}
