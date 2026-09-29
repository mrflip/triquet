'use client'

import { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, Stack, TextField, Typography } from '@mui/material'
import { ClosableTitle } from './ClosableTitle'
import { ColumnsEditor } from './ColumnsEditor'
import { DangerZone } from './DangerZone'
import { WidgetsEditor } from './WidgetsEditor'
import * as Labelmaker from '../lib/labelmaker'
import * as QuizMirror from '../state/quiz-mirror'
import { AppNotices, RefusalNotices } from '../lib/notices'
import type { HuntActionDNA } from '../models/actions'
import { HuntValidators } from '../models/hunt'
import type { ShallowHuntT, ShallowRealmT } from '../lib/rows'
import type { QuizT } from '../models/quiz'
import styles from './workbench.module.css'

export type QuizManageModalProps = {
  open:      boolean
  onClose:   () => void
  hunt:      ShallowHuntT
  realm:     ShallowRealmT
  quiz:      QuizT
  dispatch:  (action: HuntActionDNA) => void
  /** Go to another quiz of the realm */
  onOpen:    (quiz: Labelmaker.Labelled) => void
  /** Open the hunt's expressions for editing */
  onEditExpressions: () => void
  /** Give the hunt a new label, which the address then follows */
  onRelabelHunt: (label: string) => void
  /** Delete this quiz, and go to a neighbour */
  onDeleteQuiz:  () => void
  /** Delete the whole hunt, and go back to the hunts list */
  onDeleteHunt:  () => void
}

/**
 * The gear icon's modal: editing this quiz's own label (top), its computed columns, its history,
 * a quick way to open any other quiz in the realm by name, the hunt's label, and, fenced off at
 * the foot, deleting the quiz or the whole hunt.
 */
export function QuizManageModal({ open, onClose, hunt, realm, quiz, dispatch, onOpen, onEditExpressions, onRelabelHunt, onDeleteQuiz, onDeleteHunt }: Readonly<QuizManageModalProps>) {
  const [draft, setDraft] = useState(Labelmaker.effectiveLabelOf(quiz))
  const [versionDraft, setVersionDraft] = useState(quiz.version)
  const [issue, setIssue] = useState<string | null>(null)
  const [noted, setNoted] = useState<string | null>(null)
  const huntLabel = Labelmaker.effectiveLabelOf(hunt)
  const quizLabel = Labelmaker.effectiveLabelOf(quiz)
  const [huntDraft, setHuntDraft] = useState(huntLabel)
  const [huntIssue, setHuntIssue] = useState<string | null>(null)

  const onRenameHunt = () => {
    const cleaned = Labelmaker.normalize(huntDraft)
    if (! HuntValidators.row.shape.label.safeParse(cleaned).success) { setHuntIssue('Enter a label: letters, digits and single underscores, starting with a letter.'); return }
    if (cleaned === huntLabel) { return }
    onRelabelHunt(cleaned)
    onClose()
  }

  const onApply = () => {
    const cleaned = Labelmaker.normalize(draft)
    if (cleaned === '') { setIssue('Enter a label.'); return }
    const taken = realm.quizzes.some((other) => other._id !== quiz._id && Labelmaker.effectiveLabelOf(other) === cleaned)
    if (taken) { setIssue('Another quiz already uses that label.'); return }
    const version = Labelmaker.normalize(versionDraft)
    if (version === '') { setIssue('Enter a version.'); return }
    // The quiz is addressed by its label, so a relabel is also a move: the address follows it
    // once it lands (`useHunt`'s `movedTo`).
    dispatch({ kind: 'relabel_quiz', label: cleaned })
    dispatch({ kind: 'reversion_quiz', version })
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
            <Typography variant="h6" component="h3">Hunt</Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', mt: 1 }}>
              <TextField
                label="Hunt label"
                value={huntDraft}
                size="small"
                error={huntIssue !== null}
                helperText={huntIssue ?? 'Used in the web address of every quiz in this hunt; links to the old one stop working.'}
                onChange={(event) => { setHuntDraft(event.target.value); setHuntIssue(null) }}
                sx={{ flex: 1 }}
              />
              <Button variant="outlined" onClick={onRenameHunt} disabled={Labelmaker.normalize(huntDraft) === huntLabel}>Rename</Button>
            </Stack>
          </section>

          <section>
            <Typography variant="h6" component="h3">All quizzes</Typography>
            <Stack spacing={0.5} sx={{ maxHeight: '60vh', overflowY: 'auto', mt: 1 }}>
              {realm.quizzes.map((other) => (
                <Button
                  key={other._id}
                  variant={other._id === quiz._id ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => { onOpen(other); onClose() }}
                >
                  {other.locked ? '🔒 ' : ''}{other.title === '' ? AppNotices.untitledQuiz : other.title}
                </Button>
              ))}
            </Stack>
          </section>

          <DangerZone
            acts={[
              {
                actname: 'Delete this quiz',
                blurb:   `Deletes “${quiz.title || AppNotices.untitledQuiz}”: its questions, what the bots said of them, and every review of it.`,
                confirm: quizLabel,
                refusal: realm.quizzes.length <= 1 ? RefusalNotices.lastQuiz : null,
                onAct:   () => { onDeleteQuiz(); onClose() },
              },
              {
                actname: 'Delete this hunt',
                blurb:   `Deletes “${hunt.title}” and everything in it: every quiz, its expressions, and everyone's place on it.`,
                confirm: huntLabel,
                onAct:   () => { onDeleteHunt(); onClose() },
              },
            ]}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onApply} variant="contained" disabled={quiz.locked}>Apply</Button>
      </DialogActions>
    </Dialog>
  )
}
