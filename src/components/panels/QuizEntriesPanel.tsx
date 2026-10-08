'use client'

import { Box, Stack, TextField, Typography } from '@mui/material'
import { Panel } from './Panel'
import { ChoiceField, NumberField, TruthField } from '../cells/fields'
import { useEntering } from '../cells/use-entering'
import { useDraft } from '../use-draft'
import { FormularyWords } from '../widget-words'
import * as Labelmaker from '../../lib/labelmaker'
import { EntryFormulary } from '../../lib/formulary/entry'
import * as Runner from '../../lib/formulary/runner'
import { Widgeted, type WidgetedT } from '../../models/widgeted'
import type { EntryValueT, EntryWidgetT } from '../../models/widget'
import type { WidgetingT } from '../../models/widgeting'
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
 * The quiz's own widgetings, those run once for the whole quiz, in run order (the entries first):
 * each by its label, with its description, and what it came to. An entry is typed into here, in
 * the box its family takes, as the grid's cell is (a checkbox and a select among them); a
 * formula's value is shown as it was worked out, or why it failed. Formulas and templates read
 * each as `quiz.<label>`.
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
        ? <EntryBox widget={widget} widgeting={widgeting} widgeted={widgeted} label={title} locked={locked} onEnter={onEnter} />
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
  widget:    EntryWidgetT
  widgeting: WidgetingT
  widgeted:  WidgetedT
  label:     string
  locked:    boolean
  onEnter:   (value: EntryValueT | null) => void
}

/**
 * An entry of the quiz's own, in a labelled box of its family, drawn from the params in force as
 * the grid's cell is: prose in a box that grows with it, or one line, a label tidied into one; a
 * number in the number box, signed and whole as its params say; a yes or no as a checkbox; a
 * choice as a select of its options. A box commits on blur, a checkbox and a select as they are
 * changed; an emptied one is sent as null, and a value the params refuse is not sent, the author
 * told why (`useEntering`).
 */
function EntryBox({ widget, widgeting, widgeted, label, locked, onEnter }: Readonly<EntryBoxProps>) {
  const { cell, enter } = useEntering(widget, widgeting, label, onEnter)
  switch (cell.family) {
  case 'number': {
    const committed = widgeted.status === 'ok' && typeof widgeted.value === 'number' ? widgeted.value : null
    const { signed, fractional } = EntryFormulary.numberBoxOf(cell.params, committed)
    return <NumberField fractional={fractional} signed={signed} max={cell.params.max} label={label} locked={locked} committed={committed} onCommit={enter} />
  }
  case 'boolean': {
    const committed = widgeted.status === 'ok' && typeof widgeted.value === 'boolean' ? widgeted.value : null
    return <TruthField label={label} locked={locked} committed={committed} onCommit={enter} />
  }
  case 'enum': {
    const committed = widgeted.status === 'ok' && typeof widgeted.value === 'string' ? widgeted.value : null
    return <ChoiceField label={label} locked={locked} committed={committed} options={cell.params.options ?? []} onCommit={enter} />
  }
  case 'text': {
    const oneLine = EntryFormulary.isOneLine(cell.params)
    const maxLength = EntryFormulary.lengthMaxOf(cell.params)
    const tidy = oneLine ? EntryFormulary.tidyFor(cell.params) : (typed: string) => typed
    return <TextBox prose={! oneLine} label={label} committed={Widgeted.textOf(widgeted)} locked={locked} maxLength={maxLength} tidy={tidy} onCommit={(typed) => { enter(typed.trim() === '' ? null : typed) }} />
  }
  case 'estimates': {
    // A question's category estimates never run once for the whole quiz (`Widgeting.runsAt`).
    return null
  }
  }
}

type TextBoxProps = {
  /** Several lines of markdown, rather than one line */
  prose:     boolean
  label:     string
  committed: string
  locked:    boolean
  /** The most characters that may be typed */
  maxLength: number
  tidy:      (typed: string) => string
  onCommit:  (typed: string) => void
}

/** A labelled text box holding its own draft (`useDraft`), committed when it loses focus */
function TextBox({ prose, label, committed, locked, maxLength, tidy, onCommit }: Readonly<TextBoxProps>) {
  const { draft, onChange, onBlur } = useDraft(committed, onCommit, tidy)
  return (
    <TextField
      label={label} value={draft} size="small" fullWidth multiline={prose} minRows={prose ? 2 : undefined}
      slotProps={{ htmlInput: { readOnly: locked, maxLength }, inputLabel: { shrink: true } }}
      onChange={(event) => { onChange(event.target.value) }} onBlur={onBlur}
    />
  )
}
