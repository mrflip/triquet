'use client'

import { Fragment } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Box, Stack } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import _ from 'es-toolkit/compat'
import { Panel } from './Panel'
import { ReadonlyBox } from './ReadonlyBox'
import { CopyButton } from '../CopyButton'
import { hiddenUntil } from '../room'
import { EntryKindWords, FormularyWords, NoCellsLine, StatusJoint, paramsGist, statusPhrases } from '../widget-words'
import { EntryFormulary } from '../../lib/formulary/entry'
import { Formularies } from '../../lib/formulary/formularies'
import * as Runner from '../../lib/formulary/runner'
import * as Rank from '../../lib/rank'
import { Question } from '../../models/question'
import type { QuizT } from '../../models/quiz'
import styles from '../workbench.module.css'

/**
 * How wide the list of widgetings must be for a folded one to show each of its lesser fields, as
 * MUI's container-query shorthand. Its description goes first as it narrows, then the widget it
 * works, then how its cells stand; its own label always stays.
 */
const RoomFor = { description: '@900', widget: '@720', status: '@520' } as const

/** How wide a folded widgeting's fields are, so each lines up with the one above it */
const WidthFor = { label: 190, widget: 190, status: 230 } as const

export type WidgetsPanelProps = {
  quiz: QuizT
  /** The quiz, run: its widgetings in run order, and what each came to */
  run:  Runner.QuizRun
}

/**
 * The quiz's widgetings in run order (the entries first, then the rest by their positions, both
 * tiers mixed as the author placed them), each folded to a line of fields that line up down the
 * list: its label, the widget it works, how its cells stand (`statusLine`) and a snippet of its
 * description. Open, the descriptions in full, the widget's formula or prompt exactly as it
 * stands, placeholders and all, and the button that copies a prompt asking a chatbot for help --
 * or, for an entry, what kind of value is typed into it, and what its params let a cell hold. The
 * list measures its own width, not the window's, to decide which fields there is room for
 * (`RoomFor`).
 */
export function WidgetsPanel({ quiz, run }: Readonly<WidgetsPanelProps>) {
  // The advice is shown a real question: the lowest-numbered, as the widget editor's preview starts on.
  const [sample] = Rank.inRankOrder(Question.unarchived(quiz.questions))
  return (
    <Panel
      title="Widgets"
      blurb="What this quiz puts to work, in run order: each reads what those above it came to. A prompt is shown exactly as it is filled in and sent when you ask -- your own model usage, read as evidence about your own questions."
      wide
    >
      {run.steps.length === 0 && <p className={styles.microcopy}>This quiz puts no widgets to work yet: add one from the gear, under Widgetings.</p>}
      <Box sx={{ containerType: 'inline-size' }}>
        {run.steps.map((step) => (
          <WidgetingFold
            key={step.widgeting.label}
            step={step}
            counts={Runner.statusCounts(run, step.widgeting.label)}
            sampleOf={() => (sample ? Runner.bagsAt(run, step.widgeting).get(sample._id) ?? null : null)}
          />
        ))}
      </Box>
    </Panel>
  )
}

/** How a widgeting's cells stand, as `statusLine` says it, with a count of failures in the colour of one */
function StatusSentence({ counts }: Readonly<{ counts: Runner.StatusCounts }>) {
  const phrases = statusPhrases(counts)
  if (phrases.length === 0) { return <>{NoCellsLine}</> }
  return (
    <>
      {phrases.map(({ status, said }, idx) => (
        <Fragment key={status}>
          {idx > 0 ? StatusJoint : ''}
          <Box component="span" sx={status === 'errored' ? { color: 'error.main' } : undefined}>{said}</Box>
        </Fragment>
      ))}
    </>
  )
}

type WidgetingFoldProps = {
  step:     Runner.RunStep
  counts:   Runner.StatusCounts
  /** The bag the widgeting reads for the question the advice is shown, made only when it is asked for */
  sampleOf: () => Runner.QuizBag | null
}

/**
 * One widgeting, folded to a line, opening to its widget's formula or prompt. Folded, the line
 * ends in a one-line snippet of its description (the widgeting's own, or failing that its
 * widget's), which gives way to the descriptions in full as it opens.
 */
function WidgetingFold({ step, counts, sampleOf }: Readonly<WidgetingFoldProps>) {
  const { widgeting, widget } = step
  const summaryId = `widgeting-${widgeting.label}-summary`
  const noun = widget ? FormularyWords[widget.formulary].noun : 'widget'
  const description = widgeting.description || (widget?.description ?? '')
  const once = widgeting.tier === 'quiz' ? ', once for the quiz' : ''
  const works = widget ? `${noun} ${widget.label}${once}` : `works ${widgeting.widget_label}, which the library no longer holds`
  return (
    <Accordion disableGutters slotProps={{ transition: { unmountOnExit: true } }}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />} id={summaryId} aria-controls={`widgeting-${widgeting.label}-details`}
        sx={{ '& .MuiAccordionSummary-content': { minWidth: 0 }, '&.Mui-expanded [data-snippet]': { visibility: 'hidden' } }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: 'baseline', flex: 1, minWidth: 0 }}>
          <Box component="strong" sx={{ width: WidthFor.label, flexShrink: 0, overflowWrap: 'anywhere' }}>{widgeting.label}</Box>
          <Box className={styles.microcopy} sx={{ ...hiddenUntil(RoomFor.widget), width: WidthFor.widget, flexShrink: 0, overflowWrap: 'anywhere' }}>
            {works}
          </Box>
          <Box role="group" aria-label={`Cells of ${widgeting.label}`} sx={{ ...hiddenUntil(RoomFor.status), width: WidthFor.status, flexShrink: 0, fontSize: 13 }}>
            <StatusSentence counts={counts} />
          </Box>
          <Box
            data-snippet className={styles.microcopy}
            sx={{ ...hiddenUntil(RoomFor.description), flex: 1, minWidth: 0, maxWidth: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {description}
          </Box>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        {widgeting.description === '' ? null : <p className={styles.microcopy}>In this quiz: {widgeting.description}</p>}
        {widget?.formulary === 'entry' && (
          <>
            {widget.description === '' ? null : <p className={styles.microcopy}>The widget: {widget.description}</p>}
            <p className={styles.microcopy}>{widgeting.tier === 'quiz' ? 'Typed into the Quiz entries panel, one value for the whole quiz.' : 'Typed into its cells, one value per question.'} {EntryKindWords[widget.config.entry_kind]}. {paramsGist(EntryFormulary.inForce(widget, widgeting))}</p>
          </>
        )}
        {widget && widget.formulary !== 'entry' && (
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
              <CopyButton textOf={() => Formularies[widget.formulary].advice(widget, widgeting, sampleOf())}>Copy a prompt for a chatbot</CopyButton>
            </Stack>
          </>
        )}
      </AccordionDetails>
    </Accordion>
  )
}
