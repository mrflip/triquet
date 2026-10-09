'use client'

import { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, IconButton, Link, List, ListItem, ListItemText, Stack, Tooltip, Typography } from '@mui/material'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined'
import { ClosableTitle } from './ClosableTitle'
import { ColumnsEditor } from './ColumnsEditor'
import { DangerZone, type DangerousAct } from './DangerZone'
import { ExplicitField } from './ExplicitField'
import NextLink from './NextLink'
import { RunOrderLine, RunOrderList } from './RunOrder'
import { TemplateableEditor } from './TemplateableEditor'
import type { WorkbenchOffersT } from './offers'
import type { FoldSet } from './use-folds'
import type { QuizRun } from '../lib/formulary/runner'
import * as Labelmaker from '../lib/labelmaker'
import * as HuntMirror from '../state/hunt-mirror'
import { AppNotices } from '../lib/notices'
import * as Routes from '../lib/routes'
import type { HuntActionDNA, LibraryActionDNA } from '../models/actions'
import { HuntValidators } from '../models/hunt'
import { Question, type QuestionT } from '../models/question'
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
  /** Carry out a change to the library, from a widgeting's door to the widget editor (`useLibraryActions`) */
  changeLibrary: (action: LibraryActionDNA) => void
  /** Which of the columns' and widgetings' panels are open, kept by the screen so they stay so across a reopen */
  folds:     FoldSet
  /** The quiz, run: what its widgetings came to, for the columns' row preview */
  run:       QuizRun
  /** Go to another quiz of the realm */
  onOpen:    (quiz: Labelmaker.Labelled) => void
  /** Give the hunt a new title: what it is called on screen */
  onRetitleHunt: (title: string) => void
  /** Give the hunt a new label, which the address then follows */
  onRelabelHunt: (label: string) => void
  /** Delete this quiz, and go to a neighbour */
  onDeleteQuiz:  () => void
  /** Delete this quiz, the hunt's last, with the hunt, and go back to the hunts list */
  onDeleteHunt:  () => void
  /** Delete one question of this quiz, an archived one, at once */
  onDeleteQuestion: (question_id: string) => void
}

/**
 * The gear icon's modal: editing this quiz's own label (top), its columns, each with the widgeting
 * it shows folded beneath it and one question's row previewed above them, the run order of its
 * widgetings for each question and those run once for the whole quiz (put to work and edited in
 * the *Widgets* panel below the grid), which of its fields are templateable, its history,
 * a quick way to open any other quiz in the realm by name, the hunt's title and label, the quiz's
 * archived questions, each to un-archive or delete, and, fenced off at the foot, deleting the quiz
 * -- or, when it is the hunt's last, the quiz and its hunt.
 *
 * Every change here is kept as it is made, so there is nothing to apply or cancel: *Done* only
 * closes it. A label, which other things name, waits for its own *Relabel* button, as the hunt's
 * title and label wait for theirs.
 */
export function QuizManageModal({ open, onClose, hunt, realm, quiz, library, offers, dispatch, changeLibrary, folds, run, onOpen, onRetitleHunt, onRelabelHunt, onDeleteQuiz, onDeleteHunt, onDeleteQuestion }: Readonly<QuizManageModalProps>) {
  const [noted, setNoted] = useState<string | null>(null)
  const huntLabel = hunt.label
  const quizLabel = quiz.label
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

  /** The hunt's new name, or what is wrong with it */
  const onRenameHunt = (title: string): string | null => {
    if (! HuntValidators.row.shape.title.safeParse(title).success) { return AppNotices.huntTitleTooLong }
    onRetitleHunt(title)
    onClose()
    return null
  }

  /** The hunt's new label, or what is wrong with it */
  const onRelabelHuntClick = (cleaned: string): string | null => {
    if (Labelmaker.isReserved(cleaned, { toplevel: true })) { return AppNotices.labelReserved }
    if (! HuntValidators.row.shape.label.safeParse(cleaned).success) { return AppNotices.huntLabelShape }
    onRelabelHunt(cleaned)
    onClose()
    return null
  }

  /** The quiz's new label, or what is wrong with it */
  const onRelabelQuiz = (cleaned: string): string | null => {
    if (cleaned === '') { return 'Enter a label.' }
    if (Labelmaker.isReserved(cleaned)) { return AppNotices.labelReserved }
    const taken = realm.quizzes.some((other) => other._id !== quiz._id && other.label === cleaned)
    if (taken) { return 'Another quiz already uses that label.' }
    // The quiz is addressed by its label, so a relabel is also a move: the address follows it
    // once it lands (`useHunt`'s `movedTo`).
    dispatch({ kind: 'relabel_quiz', label: cleaned })
    onClose()
    return null
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
          <ExplicitField
            label="Label" committed={quizLabel} act="Relabel" actLabel="Relabel quiz" disabled={! offers.reviseQuiz} tidy={Labelmaker.normalize}
            helperText="Used in this page's web address." onCommit={onRelabelQuiz}
          />

          <section>
            <Typography variant="h6" component="h3">Columns</Typography>
            <p className={styles.microcopy}>
              The grid&apos;s columns in the order they appear, with one question&apos;s row as the grid
              draws it from them. Drag a handle to move one; its triangle unfolds the rest of it. Beneath
              a column showing a widgeting, that widgeting&apos;s line, unfolding to the whole of it.
              Every change is kept as it is made; a label waits for its own <em>Relabel</em>.
            </p>
            <ColumnsEditor
              hunt={hunt} quiz={quiz} library={library} revisable={offers.reviseLayout} changeable={offers.changeLibrary}
              dispatch={dispatch} changeLibrary={changeLibrary} folds={folds} run={run}
            />
          </section>

          <section>
            <Typography variant="h6" component="h3">Run order</Typography>
            <p className={styles.microcopy}>
              The widgets of the library this quiz puts to work, its widgetings, in the order they run:
              each one reads what those above it came to. Drag a handle to move one. One for
              <em> each question</em> runs for every question and a column shows it. One for the
              <em> whole quiz</em> runs once -- an entry typed into the Quiz entries panel (the
              playtesters, the winners), or a formula over the questions as those above it left them --
              and those below read it as <code>{'quiz.<label>'}</code>. Templates read them all. Each is
              put to work, and edited, in the <em>Widgets</em> panel below the grid, or beneath a column
              showing it.
            </p>
            {quiz.widgetings.length === 0 && <p className={styles.microcopy}>This quiz puts no widgets to work yet.</p>}
            <RunOrderList
              quiz={quiz} library={library} revisable={offers.reviseLayout} dispatch={dispatch}
              rowOf={(widgeting, handle) => <RunOrderLine widgeting={widgeting} widget={library.find((each) => each.label === widgeting.widget_label) ?? null} handle={handle} />}
            />
          </section>

          <section>
            <Typography variant="h6" component="h3">Templates</Typography>
            <p className={styles.microcopy}>
              A ticked field is filled in as a template on the grid and in the LL Export; you edit it
              as typed. <code>{'{{qn.photo}}'}</code> puts in what the question&apos;s <code>photo</code> widgeting
              holds; <code>{'{{ qn.rank }}'}</code>, <code>{'{{ quiz.title }}'}</code> and <code>{'{% for qn in qns %}...{% endfor %}'}</code> work
              too: it is Liquid. Markdown only, never HTML; an image only from an <code>https</code> address.
            </p>
            <TemplateableEditor quiz={quiz} library={library} revisable={offers.reviseLayout} dispatch={dispatch} />
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
              <ExplicitField
                label="Hunt name" committed={hunt.title} act="Rename" disabled={false} tidy={(typed) => typed.trim()}
                helperText="What the hunt is called on screen. Its web address stays as it is." onCommit={onRenameHunt}
              />
              <ExplicitField
                label="Hunt label" committed={huntLabel} act="Relabel" actLabel="Relabel hunt" disabled={false} tidy={Labelmaker.normalize}
                helperText="Used in the web address of every quiz in this hunt; links to the old one stop working." onCommit={onRelabelHuntClick}
              />
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

          <ArchivedQuestions
            questions={quiz.questions.filter((question) => Question.isArchived(question))}
            revisable={offers.reviseQuestions}
            onUnarchive={(question_id) => { dispatch({ kind: 'set_viz', question_ids: [question_id], viz: 'normal' }) }}
            onDelete={onDeleteQuestion}
          />

          <DangerZone
            acts={[deleting]}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">Done</Button>
      </DialogActions>
    </Dialog>
  )
}

type ArchivedQuestionsProps = {
  /** The quiz's archived questions, in its order */
  questions:   readonly QuestionT[]
  /** Whether the questions may be changed: un-archived or deleted */
  revisable:   boolean
  onUnarchive: (question_id: string) => void
  onDelete:    (question_id: string) => void
}

/**
 * The quiz's archived questions, which no other screen shows: each by its title and the start of
 * its clueing, with a button to bring it back to the grid and one to delete it, which asks nothing
 * first.
 */
function ArchivedQuestions({ questions, revisable, onUnarchive, onDelete }: Readonly<ArchivedQuestionsProps>) {
  return (
    <section>
      <Typography variant="h6" component="h3">Archived questions</Typography>
      <p className={styles.microcopy}>
        Put away from the grid, the playtest and the exports, but kept with the quiz. Un-archive one
        to bring it back to the grid; deleting one is at once, and for good.
      </p>
      {questions.length === 0 ? <p className={styles.microcopy}>{AppNotices.noArchivedQuestions}</p> : (
        <List dense disablePadding aria-label="Archived questions">
          {questions.map((question) => {
            const named = Question.titleShown(question, question.label)
            return (
              <ListItem
                key={question._id}
                disableGutters
                secondaryAction={(
                  <Stack direction="row">
                    <Tooltip title="Un-archive: back to the grid">
                      <span>
                        <IconButton aria-label={`Un-archive ${named}`} disabled={! revisable} onClick={() => { onUnarchive(question._id) }}>
                          <UnarchiveOutlinedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Delete, at once and for good">
                      <span>
                        <IconButton aria-label={`Delete ${named}`} color="error" disabled={! revisable} onClick={() => { onDelete(question._id) }}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                )}
                sx={{ pr: 10 }}
              >
                <ListItemText primary={named} secondary={question.clueing.replaceAll(/\s+/g, ' ').trim()} slotProps={{ secondary: { noWrap: true } }} />
              </ListItem>
            )
          })}
        </List>
      )}
    </section>
  )
}
