'use client'

import { Accordion, AccordionDetails, AccordionSummary, Chip, Stack } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import _ from 'es-toolkit/compat'
import { Panel } from './Panel'
import { ReadonlyBox } from './ReadonlyBox'
import { CopyButton } from '../CopyButton'
import { FormularyWords } from '../widget-words'
import { formularyFor } from '../../lib/formulary/formularies'
import * as Runner from '../../lib/formulary/runner'
import * as Rank from '../../lib/rank'
import type { QuizT } from '../../models/quiz'
import styles from '../workbench.module.css'

export type WidgetsPanelProps = {
  quiz: QuizT
  /** The quiz, run: its widgetings in run order, and what each came to */
  run:  Runner.QuizRun
}

/**
 * The quiz's widgetings in run order, each folded to its label, the widget it works and how many
 * of its cells are ok, errored and missing; open, the widget's formula or prompt exactly as it
 * stands, placeholders and all, and the button that copies a prompt asking a chatbot for help.
 */
export function WidgetsPanel({ quiz, run }: Readonly<WidgetsPanelProps>) {
  // The advice is shown a real question: the lowest-numbered, as the widget editor's preview starts on.
  const [sample] = Rank.inRankOrder(quiz.questions)
  return (
    <Panel
      title="Widgets"
      blurb="What this quiz puts to work, in run order: each reads what those above it came to. A prompt is shown exactly as it is filled in and sent when you ask -- your own model usage, read as evidence about your own questions."
      wide
    >
      {run.steps.length === 0 && <p className={styles.microcopy}>This quiz puts no widgets to work yet: add one from the gear, under Widgetings.</p>}
      <div>
        {run.steps.map((step) => (
          <WidgetingFold
            key={step.widgeting.label}
            step={step}
            counts={Runner.statusCounts(run, step.widgeting.label)}
            sampleOf={() => (sample ? Runner.bagsAt(run, step.widgeting).get(sample._id) ?? null : null)}
          />
        ))}
      </div>
    </Panel>
  )
}

type WidgetingFoldProps = {
  step:     Runner.RunStep
  counts:   Runner.StatusCounts
  /** The bag the widgeting reads for the question the advice is shown, made only when it is asked for */
  sampleOf: () => Runner.QuizBag | null
}

/** One widgeting, folded to a line, opening to its widget's formula or prompt */
function WidgetingFold({ step, counts, sampleOf }: Readonly<WidgetingFoldProps>) {
  const { widgeting, widget } = step
  const summaryId = `widgeting-${widgeting.label}-summary`
  const noun = widget ? FormularyWords[widget.formulary].noun : 'widget'
  return (
    <Accordion disableGutters slotProps={{ transition: { unmountOnExit: true } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} id={summaryId} aria-controls={`widgeting-${widgeting.label}-details`}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
          <strong>{widgeting.label}</strong>
          <span className={styles.microcopy}>{widget ? `${noun} ${widget.label}` : `works ${widgeting.widget_label}, which the library no longer holds`}</span>
          <Stack direction="row" spacing={0.5} role="group" aria-label={`Cells of ${widgeting.label}`}>
            <Chip size="small" variant="outlined" color="success" label={`${String(counts.ok)} ok`} />
            <Chip size="small" variant="outlined" color={counts.errored > 0 ? 'error' : 'default'} label={`${String(counts.errored)} errored`} />
            <Chip size="small" variant="outlined" label={`${String(counts.missing)} missing`} />
          </Stack>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        {widgeting.description === '' ? null : <p className={styles.microcopy}>In this quiz: {widgeting.description}</p>}
        {widget && (
          <>
            {widget.description === '' ? null : <p className={styles.microcopy}>The widget: {widget.description}</p>}
            <div className={styles.microcopy}>{widget.formulary === 'aibot' ? 'The prompt, placeholders and all: each {{name}} is filled in from that key of the input' : 'The formula'}</div>
            <ReadonlyBox label={`${_.upperFirst(noun)}: ${widgeting.label}`} text={widget.formula} rows={widget.formulary === 'aibot' ? 10 : 4} />
            {widget.formulary === 'aibot' && (
              <>
                <div className={styles.microcopy}>The input formula: what the prompt is filled in from, for each question</div>
                <ReadonlyBox label={`Input formula: ${widgeting.label}`} text={widget.input_formula} rows={2} />
              </>
            )}
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
              <CopyButton textOf={() => formularyFor(widget).advice(widget, widgeting, sampleOf())}>Copy a prompt for a chatbot</CopyButton>
            </Stack>
          </>
        )}
      </AccordionDetails>
    </Accordion>
  )
}
