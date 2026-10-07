'use client'

import { Box, Stack, TextField, Typography } from '@mui/material'
import { Panel } from './Panel'
import { NumberField } from '../cells/fields'
import { useDraft } from '../use-draft'
import { FormularyWords } from '../widget-words'
import * as Labelmaker from '../../lib/labelmaker'
import * as Runner from '../../lib/formulary/runner'
import * as PA from '../../lib/vv/patterns'
import { Widgeted, type WidgetedT } from '../../models/widgeted'
import type { EntryKind, EntryValueT } from '../../models/widget'
import styles from '../workbench.module.css'

export type QuizEntriesPanelProps = {
  /** The quiz, run: its widgetings for the whole quiz in run order, and what each came to */
  run:     Runner.QuizRun
  /** Whether the quiz's entries may be typed into: shown as they are when not */
  locked:  boolean
  /** Told what one entry of the quiz now holds once its box loses focus: the value typed, or null when it was emptied */
  onEnter: (widgeting_label: string, value: EntryValueT | null) => void
}

/**
 * The quiz's own widgetings, those run once for the whole quiz, in run order: each by its label,
 * with its description, and what it came to. An entry is typed into here, committing on blur, in
 * the box its kind takes; a formula's value is shown as it was worked out, or why it failed.
 * Formulas and templates read each as `quiz.<label>`.
 */
export function QuizEntriesPanel({ run, locked, onEnter }: Readonly<QuizEntriesPanelProps>) {
  const steps = run.steps.filter((step) => step.widgeting.tier === 'quiz')
  return (
    <Panel
      title="Quiz entries"
      blurb="What this quiz's own widgetings came to: entries typed here, formulas worked out over every question. Formulas and templates read each as quiz.<label>."
    >
      {steps.length === 0 && <p className={styles.microcopy}>Nothing runs once for the whole quiz yet: add a quiz widgeting from the gear.</p>}
      <Stack spacing={1.5} sx={{ mt: 1 }}>
        {steps.map((step) => (
          <QuizEntryRow key={step.widgeting.label} step={step} widgeted={Runner.quizWidgetedOf(run, step.widgeting.label)} locked={locked} onEnter={(value) => { onEnter(step.widgeting.label, value) }} />
        ))}
      </Stack>
    </Panel>
  )
}

type QuizEntryRowProps = {
  step:     Runner.RunStep
  widgeted: WidgetedT
  locked:   boolean
  onEnter:  (value: EntryValueT | null) => void
}

/** One widgeting for the whole quiz: its box, when it is an entry, or what it came to */
function QuizEntryRow({ step, widgeted, locked, onEnter }: Readonly<QuizEntryRowProps>) {
  const { widgeting, widget } = step
  const title = Labelmaker.titleize(widgeting.label)
  const description = widgeting.description || (widget?.description ?? '')
  return (
    <Box role="group" aria-label={`Quiz widgeting ${widgeting.label}`}>
      {widget?.formulary === 'entry'
        ? <EntryBox entry_kind={widget.config.entry_kind} widgeted={widgeted} label={title} locked={locked} onEnter={onEnter} />
        : (
          <>
            <Typography variant="body2" component="div"><strong>{title}</strong> <span className={styles.microcopy}>{widget ? FormularyWords[widget.formulary].noun : `works ${widgeting.widget_label}, which the library no longer holds`}</span></Typography>
            <ValueLine widgeted={widgeted} />
          </>
        )}
      {description === '' ? null : <div className={styles.microcopy}>{description}</div>}
    </Box>
  )
}

/** What a formula for the whole quiz came to: its value as text, the muted dash for nothing, or its failure */
function ValueLine({ widgeted }: Readonly<{ widgeted: WidgetedT }>) {
  if (widgeted.status === 'errored') { return <Typography variant="body2" sx={{ color: 'error.main' }}>{widgeted.err.message}</Typography> }
  if (Widgeted.isNothing(widgeted)) { return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography> }
  return <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{Widgeted.textOf(widgeted)}</Typography>
}

type EntryBoxProps = {
  entry_kind: EntryKind
  widgeted:   WidgetedT
  label:      string
  locked:     boolean
  onEnter:    (value: EntryValueT | null) => void
}

/**
 * An entry of the quiz's own, in a labelled box of its kind, committing on blur: prose in a box
 * that grows with it, a number in the signed, fractional number box, a label tidied into one and a
 * title kept to one line as the box is left. An emptied box is sent as null.
 */
function EntryBox({ entry_kind, widgeted, label, locked, onEnter }: Readonly<EntryBoxProps>) {
  if (entry_kind === 'number') {
    const committed = widgeted.status === 'ok' && typeof widgeted.value === 'number' ? widgeted.value : null
    return <NumberField fractional signed label={label} locked={locked} committed={committed} onCommit={onEnter} />
  }
  const tidy = entry_kind === 'labelish' ? (typed: string) => Labelmaker.normalize(typed) : (typed: string) => (entry_kind === 'text' ? typed : typed.trim())
  return <TextBox prose={entry_kind === 'text'} label={label} committed={Widgeted.textOf(widgeted)} locked={locked} tidy={tidy} onCommit={(typed) => { onEnter(typed.trim() === '' ? null : typed) }} />
}

type TextBoxProps = {
  /** Several lines of markdown, rather than one line */
  prose:     boolean
  label:     string
  committed: string
  locked:    boolean
  tidy:      (typed: string) => string
  onCommit:  (typed: string) => void
}

/** A labelled text box holding its own draft (`useDraft`), committed when it loses focus */
function TextBox({ prose, label, committed, locked, tidy, onCommit }: Readonly<TextBoxProps>) {
  const { draft, onChange, onBlur } = useDraft(committed, onCommit, tidy)
  return (
    <TextField
      label={label} value={draft} size="small" fullWidth multiline={prose} minRows={prose ? 2 : undefined}
      slotProps={{ htmlInput: { readOnly: locked, maxLength: prose ? PA.Textish.max : PA.Titleish.max }, inputLabel: { shrink: true } }}
      onChange={(event) => { onChange(event.target.value) }} onBlur={onBlur}
    />
  )
}
