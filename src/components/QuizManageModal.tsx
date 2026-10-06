'use client'

import { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, Link, Stack, TextField, Typography } from '@mui/material'
import { ClosableTitle } from './ClosableTitle'
import { ColumnsEditor } from './ColumnsEditor'
import { DangerZone, type DangerousAct } from './DangerZone'
import NextLink from './NextLink'
import { WidgetingsEditor } from './WidgetingsEditor'
import type { WorkbenchOffersT } from './offers'
import * as Labelmaker from '../lib/labelmaker'
import * as HuntMirror from '../state/hunt-mirror'
import { AppNotices } from '../lib/notices'
import * as Routes from '../lib/routes'
import type { HuntActionDNA, LibraryActionDNA } from '../models/actions'
import { HuntValidators } from '../models/hunt'
import type { ShallowHuntT, ShallowRealmT } from '../lib/rows'
import type { QuizT } from '../models/quiz'
import type { WidgetT } from '../models/widget'
import styles from './workbench.module.css'

export type QuizManageModalProps = {
  open:      boolean
  onClose:   () => void
  hunt:      ShallowHuntT
  realm:     ShallowRealmT
  quiz:      QuizT
  /** The library's widgets, which the quiz's widgetings work */
  library:   readonly WidgetT[]
  /** What the screen offers whoever is working: the quiz's own label and layout are left as they are where it is not revisable */
  offers:    WorkbenchOffersT
  dispatch:  (action: HuntActionDNA) => void
  /** Carry out a change to the library, from the widgeting editor's door to the widget editor (`useLibraryActions`) */
  changeLibrary: (action: LibraryActionDNA) => void
  /** Go to another quiz of the realm */
  onOpen:    (quiz: Labelmaker.Labelled) => void
  /** Open the library for editing */
  onEditLibrary: () => void
  /** Give the hunt a new title: what it is called on screen */
  onRetitleHunt: (title: string) => void
  /** Give the hunt a new label, which the address then follows */
  onRelabelHunt: (label: string) => void
  /** Delete this quiz, and go to a neighbour */
  onDeleteQuiz:  () => void
  /** Delete this quiz, the hunt's last, with the hunt, and go back to the hunts list */
  onDeleteHunt:  () => void
}

/**
 * The gear icon's modal: editing this quiz's own label (top), its computed columns, its history,
 * a quick way to open any other quiz in the realm by name, the hunt's title and label, and, fenced
 * off at the foot, deleting the quiz -- or, when it is the hunt's last, the quiz and its hunt.
 */
export function QuizManageModal({ open, onClose, hunt, realm, quiz, library, offers, dispatch, changeLibrary, onOpen, onEditLibrary, onRetitleHunt, onRelabelHunt, onDeleteQuiz, onDeleteHunt }: Readonly<QuizManageModalProps>) {
  const [draft, setDraft] = useState(quiz.label)
  const [issue, setIssue] = useState<string | null>(null)
  const [noted, setNoted] = useState<string | null>(null)
  const huntLabel = hunt.label
  const quizLabel = quiz.label
  const [huntTitleDraft, setHuntTitleDraft] = useState(hunt.title)
  const [huntTitleIssue, setHuntTitleIssue] = useState<string | null>(null)
  const [huntLabelDraft, setHuntLabelDraft] = useState(huntLabel)
  const [huntLabelIssue, setHuntLabelIssue] = useState<string | null>(null)
  const lastQuiz = realm.quizzes.length <= 1

  // A hunt goes only with its last quiz, so that no one act loses a hunt's worth of quizzes.
  const deleting: DangerousAct = lastQuiz
    ? {
      actname: 'Delete this quiz and its hunt',
      blurb:   `“${quiz.title || AppNotices.untitledQuiz}” is the last quiz of the hunt “${hunt.title}”, so the two go together: its questions, its widgetings and what they stored, every review of it, and everyone's place on it.`,
      confirm: huntLabel,
      onAct:   () => { onDeleteHunt(); onClose() },
    }
    : {
      actname: 'Delete this quiz',
      blurb:   `Deletes “${quiz.title || AppNotices.untitledQuiz}”: its questions, what the bots said of them, and every review of it. A hunt goes with its last quiz.`,
      confirm: quizLabel,
      onAct:   () => { onDeleteQuiz(); onClose() },
    }

  const onRenameHunt = () => {
    const title = huntTitleDraft.trim()
    if (! HuntValidators.row.shape.title.safeParse(title).success) { setHuntTitleIssue(AppNotices.huntTitleTooLong); return }
    if (title === hunt.title) { return }
    onRetitleHunt(title)
    onClose()
  }

  const onRelabelHuntClick = () => {
    const cleaned = Labelmaker.normalize(huntLabelDraft)
    if (Labelmaker.isReserved(cleaned)) { setHuntLabelIssue(AppNotices.labelReserved); return }
    if (! HuntValidators.row.shape.label.safeParse(cleaned).success) { setHuntLabelIssue(AppNotices.huntLabelShape); return }
    if (cleaned === huntLabel) { return }
    onRelabelHunt(cleaned)
    onClose()
  }

  const onApply = () => {
    const cleaned = Labelmaker.normalize(draft)
    if (cleaned === '') { setIssue('Enter a label.'); return }
    if (Labelmaker.isReserved(cleaned)) { setIssue(AppNotices.labelReserved); return }
    const taken = realm.quizzes.some((other) => other._id !== quiz._id && other.label === cleaned)
    if (taken) { setIssue('Another quiz already uses that label.'); return }
    // The quiz is addressed by its label, so a relabel is also a move: the address follows it
    // once it lands (`useHunt`'s `movedTo`).
    dispatch({ kind: 'relabel_quiz', label: cleaned })
    onClose()
  }

  const onMilestone = async () => {
    const tag = await HuntMirror.milestone(hunt, quiz)
    setNoted(tag ?? AppNotices.nothingToMilestone)
  }

  const onDownload = async () => {
    if (! await HuntMirror.downloadHuntRepo(hunt)) { setNoted(AppNotices.noHistoryHere) }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" aria-labelledby="manage-title">
      <ClosableTitle id="manage-title" onClose={onClose}>Manage this quiz</ClosableTitle>
      {/* One scrolling region for the whole dialog: each section is as tall as what it holds. */}
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="Label"
            value={draft}
            size="small"
            disabled={! offers.reviseQuiz}
            error={issue !== null}
            helperText={issue ?? "Used in this page's web address."}
            onChange={(event) => { setDraft(event.target.value); setIssue(null) }}
          />

          <section>
            <Typography variant="h6" component="h3">Columns</Typography>
            <p className={styles.microcopy}>The grid&apos;s columns in the order they appear. Drag a handle to move one; the gear opens the rest.</p>
            <ColumnsEditor quiz={quiz} library={library} revisable={offers.reviseLayout} dispatch={dispatch} />
          </section>

          <section>
            <Typography variant="h6" component="h3">Widgetings</Typography>
            <p className={styles.microcopy}>The widgets of the library this quiz puts to work, in run order: each one reads what those above it came to. A column shows a widgeting.</p>
            <WidgetingsEditor hunt={hunt} quiz={quiz} library={library} revisable={offers.reviseLayout} changeable={offers.changeLibrary} dispatch={dispatch} changeLibrary={changeLibrary} onEditLibrary={onEditLibrary} />
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
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <TextField
                  label="Hunt name"
                  value={huntTitleDraft}
                  size="small"
                  error={huntTitleIssue !== null}
                  helperText={huntTitleIssue ?? 'What the hunt is called on screen. Its web address stays as it is.'}
                  onChange={(event) => { setHuntTitleDraft(event.target.value); setHuntTitleIssue(null) }}
                  sx={{ flex: 1 }}
                />
                <Button variant="outlined" onClick={onRenameHunt} disabled={huntTitleDraft.trim() === hunt.title}>Rename</Button>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <TextField
                  label="Hunt label"
                  value={huntLabelDraft}
                  size="small"
                  error={huntLabelIssue !== null}
                  helperText={huntLabelIssue ?? 'Used in the web address of every quiz in this hunt; links to the old one stop working.'}
                  onChange={(event) => { setHuntLabelDraft(event.target.value); setHuntLabelIssue(null) }}
                  sx={{ flex: 1 }}
                />
                <Button variant="outlined" onClick={onRelabelHuntClick} disabled={Labelmaker.normalize(huntLabelDraft) === huntLabel}>Relabel</Button>
              </Stack>
            </Stack>
            <p className={styles.microcopy}>
              <Link component={NextLink} href={Routes.categoriesPath({ org: hunt.org, hunt: huntLabel })}>Arrange the hunt&apos;s categories</Link>
              {' '}round its wheel. {AppNotices.deletingHunt}
            </p>
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
            acts={[deleting]}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onApply} variant="contained" disabled={! offers.reviseQuiz}>Apply</Button>
      </DialogActions>
    </Dialog>
  )
}
