'use client'

import { Fragment, useState } from 'react'
import { Box, Button, Stack } from '@mui/material'
import _ from 'es-toolkit/compat'
import { Panel } from './Panel'
import { ReadonlyBox } from './ReadonlyBox'
import { CopyButton } from '../CopyButton'
import { NewWidgetingPicker } from '../NewWidgeting'
import { RunOrderList } from '../RunOrder'
import { WidgetingPanel, type WidgetingPanelContext } from '../WidgetingPanel'
import { LayoutFoldkeys } from '../layout-folds'
import { hiddenUntil } from '../room'
import { EntryKindWords, FormularyWords, NoCellsLine, StatusJoint, paramsGist, statusPhrases, templateFromGist } from '../widget-words'
import * as ColumnMenu from '../../lib/column-menu'
import { EntryFormulary } from '../../lib/formulary/entry'
import { LiquidizeFormulary } from '../../lib/formulary/liquidize'
import { LiquidizeDefaultInput, type LiquidizeWidgetT, type WidgetT } from '../../models/widget'
import { Formularies } from '../../lib/formulary/formularies'
import * as Runner from '../../lib/formulary/runner'
import * as Rank from '../../lib/rank'
import { Question } from '../../models/question'
import type { WidgetingT, WidgetingTier } from '../../models/widgeting'
import styles from '../workbench.module.css'

/**
 * How wide the list of widgetings must be for a widgeting's row to say how its cells stand, as
 * MUI's container-query shorthand; its label, what it works and its folded line always stay.
 */
const RoomFor = { status: '@520' } as const

/** What the picker putting a widget to work is called, at each tier */
const NewLabels: Readonly<Record<WidgetingTier, string>> = {
  question: 'A new widgeting, for each question',
  quiz:     'A new widgeting, for the whole quiz',
}

export type WidgetsPanelProps = Omit<WidgetingPanelContext, 'sources'> & {
  /** The quiz, run: its widgetings in run order, and what each came to */
  run: Runner.QuizRun
}

/**
 * The quiz's widgetings in run order (`RunOrderList`: the entries first, then the rest by their
 * positions, both tiers mixed as the author placed them, dragged into a new order by their
 * handles), each its widgeting panel (`WidgetingPanel`), folded to its row: its label, what it
 * works, its tier, how its cells stand (`statusLine`, given way as the list narrows, `RoomFor`)
 * and its folded line. Open, the whole panel, where a widgeting no column shows is edited, with
 * the widget's formula or prompt exactly as it stands, placeholders and all, and the button that
 * copies a prompt asking a chatbot for help -- or, for an entry, what is typed into it. At its
 * head, the catalogue to put another widget to work, for each question (with its column) or once
 * for the whole quiz, made as it is picked and arriving open.
 */
export function WidgetsPanel({ run, ...props }: Readonly<WidgetsPanelProps>) {
  const { quiz, library, revisable, dispatch } = props
  const context = { ...props, sources: ColumnMenu.refChoicesOf(quiz) }
  const [adding, setAdding] = useState<WidgetingTier | null>(null)
  // The advice is shown a real question: the lowest-numbered, as the widget editor's preview starts on.
  const [sample] = Rank.inRankOrder(Question.unarchived(quiz.questions))
  const widgetOf = (widgeting: WidgetingT) => library.find((each) => each.label === widgeting.widget_label) ?? null

  return (
    <Panel
      title="Widgets"
      blurb="What this quiz puts to work, in run order: each reads what those above it came to. Drag a handle to move one; its triangle opens the whole of it. A prompt is shown exactly as it is filled in and sent when you ask -- your own model usage, read as evidence about your own questions."
      wide
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
          <Button size="small" variant="outlined" disabled={! revisable} onClick={() => { setAdding('question') }}>+ New widgeting…</Button>
          <Button size="small" variant="outlined" disabled={! revisable} onClick={() => { setAdding('quiz') }}>+ New quiz widgeting…</Button>
        </Stack>
        {adding !== null && revisable && <NewWidgetingPicker key={adding} tier={adding} entriesOnly={false} label={NewLabels[adding]} {...props} onDone={() => { setAdding(null) }} />}
        {quiz.widgetings.length === 0 && <p className={styles.microcopy}>This quiz puts no widgets to work yet.</p>}
        <Box sx={{ containerType: 'inline-size' }}>
          <RunOrderList
            quiz={quiz} library={library} revisable={revisable} dispatch={dispatch}
            rowOf={(widgeting, handle) => (
              <WidgetingPanel
                widgeting={widgeting} handle={handle} tierMark foldkeyOf={LayoutFoldkeys.widgeting} {...context}
                aside={<CellsLine label={widgeting.label} counts={Runner.statusCounts(run, widgeting.label)} />}
              >
                <WidgetShown
                  widgeting={widgeting} widget={widgetOf(widgeting)}
                  sampleOf={() => (sample ? Runner.bagsAt(run, widgeting).get(sample._id) ?? null : null)}
                />
              </WidgetingPanel>
            )}
          />
        </Box>
      </Stack>
    </Panel>
  )
}

/** How a widgeting's cells stand, on its row, where there is room for it */
function CellsLine({ label, counts }: Readonly<{ label: string, counts: Runner.StatusCounts }>) {
  return (
    <Box role="group" aria-label={`Cells of ${label}`} sx={{ ...hiddenUntil(RoomFor.status), width: 230, flexShrink: 0, pt: 1, fontSize: 13 }}>
      <StatusSentence counts={counts} />
    </Box>
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

type WidgetShownProps = {
  widgeting: WidgetingT
  /** The widget it works; null when the library no longer holds it */
  widget:    WidgetT | null
  /** The bag the widgeting reads for the question the advice is shown, made only when it is asked for */
  sampleOf:  () => Runner.QuizBag | null
}

/**
 * What a widgeting's open panel shows of its widget here: for an entry, where it is typed and
 * what its cells may hold; otherwise the widget's formula or prompt exactly as it stands (and a
 * prompt's input formula), or the template a `liquidize` widgeting fills in (its own, its
 * widget's, or where in the bag it is read from), read-only, and the button that copies a prompt
 * asking a chatbot for help with it.
 */
function WidgetShown({ widgeting, widget, sampleOf }: Readonly<WidgetShownProps>) {
  if (! widget) { return null }
  if (widget.formulary === 'entry') {
    const typed = widgeting.tier === 'quiz' ? 'Typed into the Quiz entries panel, one value for the whole quiz.' : 'Typed into its cells, one value per question.'
    return <p className={styles.microcopy}>{typed} {_.compact([`${EntryKindWords[widget.config.entry_kind]}.`, paramsGist(EntryFormulary.inForce(widget, widgeting))]).join(' ')}</p>
  }
  const { noun } = FormularyWords[widget.formulary]
  return (
    <Box>
      {widget.formulary === 'liquidize'
        ? <TemplateInForce widget={widget} widgeting={widgeting} noun={noun} />
        : (
          <>
            <div className={styles.microcopy}>{widget.formulary === 'aibot' ? 'The prompt, placeholders and all: each {{name}} is filled in from that key of the input' : 'The formula'}</div>
            <ReadonlyBox label={`${_.upperFirst(noun)}: ${widgeting.label}`} text={widget.formula} rows={widget.formulary === 'aibot' ? 10 : 4} />
          </>
        )}
      {widget.formulary === 'aibot' && (
        <>
          <div className={styles.microcopy}>The input formula: what the prompt is filled in from, for each question</div>
          <ReadonlyBox label={`Input formula: ${widgeting.label}`} text={widget.input_formula} rows={2} />
        </>
      )}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
        <CopyButton textOf={() => Formularies[widget.formulary].advice(widget, widgeting, sampleOf())}>Copy a prompt for a chatbot</CopyButton>
      </Stack>
    </Box>
  )
}

type TemplateInForceProps = {
  widget:    LiquidizeWidgetT
  widgeting: WidgetingT
  noun:      string
}

/**
 * The template a `liquidize` widgeting fills in: its own, said in full; where in the bag it is
 * read from, for each question; or its widget's, said in full. An input formula of its widget's
 * own, other than the whole bag, is said beneath.
 */
function TemplateInForce({ widget, widgeting, noun }: Readonly<TemplateInForceProps>) {
  const { template, template_from } = LiquidizeFormulary.ownOf(widgeting)
  return (
    <>
      {template_from === undefined
        ? (
          <>
            <div className={styles.microcopy}>{template === undefined ? "The widget's template, filled in for each question and shown as markdown" : "This widgeting's own template, in place of its widget's, filled in for each question and shown as markdown"}</div>
            <ReadonlyBox label={`${_.upperFirst(noun)}: ${widgeting.label}`} text={template ?? widget.formula} rows={4} />
          </>
        )
        : <p className={styles.microcopy}>The template: {templateFromGist(template_from)} What it comes to is filled in there, and shown as markdown.</p>}
      {widget.input_formula.trim() !== LiquidizeDefaultInput && (
        <>
          <div className={styles.microcopy}>The input formula: what the template is filled in from, for each question</div>
          <ReadonlyBox label={`Input formula: ${widgeting.label}`} text={widget.input_formula} rows={2} />
        </>
      )}
    </>
  )
}
