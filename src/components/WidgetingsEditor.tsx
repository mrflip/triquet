'use client'

import { useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, Divider, IconButton, MenuItem, Stack, TextField } from '@mui/material'
import { ClosableTitle, ignoringBackdrop } from './ClosableTitle'
import { ConfirmRemove } from './ConfirmRemove'
import { AibotFields } from './AibotFields'
import { JsonataFields } from './JsonataFields'
import { SortableList } from './SortableList'
import { BlankAibotDraft, NewWidget, draftOf, planWidgetingEdit, type AibotDraft, type JsonataDraft, type WidgetPlan } from '../state/widget-edit'
import { Widget, type AibotWidgetT, type JsonataWidgetT, type WidgetT } from '../models/widget'
import type { WidgetingT } from '../models/widgeting'
import type { QuizT } from '../models/quiz'
import type { ShallowHuntT } from '../lib/rows'
import type { HuntActionDNA } from '../models/actions'
import styles from './workbench.module.css'

export type WidgetingsEditorProps = {
  hunt:          ShallowHuntT
  quiz:          QuizT
  /** The library's widgets, which the quiz's widgetings work */
  library:       readonly WidgetT[]
  dispatch:      (action: HuntActionDNA) => void
  onEditLibrary: () => void
}

/** Which widgeting's editor is open: one of the quiz's, or a new one working a formula or a prompt */
type Editing = { kind: 'widgeting', label: string } | { kind: 'new_formula' } | { kind: 'new_prompt' } | null

/**
 * A quiz's widgetings -- the widgets of the library it puts to work -- listed in run order,
 * dragged into a new one by their handles, each with a gear that opens it.
 */
export function WidgetingsEditor({ hunt, quiz, library, dispatch, onEditLibrary }: Readonly<WidgetingsEditorProps>) {
  const [editing, setEditing] = useState<Editing>(null)
  const edited: WidgetingT | null = editing?.kind === 'widgeting' ? quiz.widgetings.find((each) => each.label === editing.label) ?? null : null
  const editedWidget = edited && library.find((widget) => widget.label === edited.widget_label)
  const close = () => { setEditing(null) }

  return (
    <Stack spacing={1}>
      {quiz.widgetings.length === 0 && <p className={styles.microcopy}>This quiz puts no widgets to work.</p>}
      <SortableList
        label="Widgetings"
        items={quiz.widgetings}
        keyOf={(widgeting) => widgeting.label}
        disabled={quiz.locked}
        onMove={(label, onto_idx) => { dispatch({ kind: 'move_widgeting', label, onto_idx }) }}
        renderRow={(widgeting, handle) => (
          <Stack direction="row" spacing={1} role="group" aria-label={`Widgeting ${widgeting.label}`} sx={{ alignItems: 'center' }}>
            {handle}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <strong>{widgeting.label}</strong> <span className={styles.microcopy}>{widgetingNote(widgeting, library)}</span>
              {widgeting.description === '' ? null : <div className={styles.microcopy}>{widgeting.description}</div>}
            </Box>
            <IconButton size="small" aria-label={`Edit widgeting ${widgeting.label}`} onClick={() => { setEditing({ kind: 'widgeting', label: widgeting.label }) }}>⚙</IconButton>
          </Stack>
        )}
      />
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <Button size="small" variant="outlined" disabled={quiz.locked} onClick={() => { setEditing({ kind: 'new_formula' }) }}>+ New formula…</Button>
        <Button size="small" variant="outlined" disabled={quiz.locked} onClick={() => { setEditing({ kind: 'new_prompt' }) }}>+ New prompt…</Button>
        <Button size="small" variant="outlined" onClick={onEditLibrary}>Widget library…</Button>
      </Stack>
      {(editing?.kind === 'new_formula' || (edited && editedWidget?.formulary === 'jsonata')) && (
        <FormulaDialog key={edited?.label ?? 'new'} hunt={hunt} quiz={quiz} library={library} widgeting={edited} dispatch={dispatch} onClose={close} />
      )}
      {(editing?.kind === 'new_prompt' || (edited && editedWidget?.formulary !== 'jsonata')) && (
        <PromptDialog key={edited?.label ?? 'new'} hunt={hunt} quiz={quiz} library={library} widgeting={edited} dispatch={dispatch} onClose={close} />
      )}
    </Stack>
  )
}

/** What the widgeting works, in a few words */
function widgetingNote(widgeting: WidgetingT, library: readonly WidgetT[]): string {
  const widget = library.find((each) => each.label === widgeting.widget_label)
  if (! widget) { return `works ${widgeting.widget_label}, which the library no longer holds` }
  return `${widget.formulary === 'jsonata' ? 'formula' : 'prompt'} ${widget.label}`
}

const BlankWidget: JsonataDraft = { label: '', description: '', formula: '' }

/** Runs `plan`, dispatching what it comes to; says what is wrong instead when it is refused */
function carryOut(plan: WidgetPlan, dispatch: (action: HuntActionDNA) => void, refuse: (issue: string, labelIssue: string | null) => void, done: () => void) {
  if (! plan.ok) { refuse(plan.issue, plan.labelIssue); return }
  for (const action of plan.actions) { dispatch(action) }
  done()
}

/** How a dialog says what is wrong: the issue, and the label's issue beside the label */
function refusing(setIssue: (issue: string | null) => void, setLabelIssue: (issue: string | null) => void) {
  return (problem: string, forLabel: string | null) => { setIssue(problem); setLabelIssue(forLabel) }
}

type FormulaDialogProps = {
  hunt:      ShallowHuntT
  quiz:      QuizT
  library:   readonly WidgetT[]
  /** The widgeting being edited, or null to make a new one */
  widgeting: WidgetingT | null
  dispatch:  (action: HuntActionDNA) => void
  onClose:   () => void
}

/**
 * One widgeting of a formula and the widget behind it, edited together.
 *
 * The widgeting's label and description sit above the formula it works, which is written with a
 * live preview against any question in the hunt. Nothing is applied until Apply. A new widgeting
 * can work a formula of the library or a new one written on the spot, and brings a column to show
 * it. Removing a widgeting asks first; its widget stays in the library.
 */
function FormulaDialog({ hunt, quiz, library, widgeting, dispatch, onClose }: Readonly<FormulaDialogProps>) {
  const formulas = library.filter((widget): widget is JsonataWidgetT => widget.formulary === 'jsonata')
  const held = formulas.find((widget) => widget.label === widgeting?.widget_label)
  const [label, setLabel] = useState(widgeting?.label ?? '')
  const [description, setDescription] = useState(widgeting?.description ?? '')
  const [widgetLabel, setWidgetLabel] = useState(widgeting?.widget_label ?? NewWidget)
  const [draft, setDraft] = useState<JsonataDraft>(held ?? BlankWidget)
  const [issue, setIssue] = useState<string | null>(null)
  const [labelIssue, setLabelIssue] = useState<string | null>(null)

  const isNew = widgetLabel === NewWidget

  const pickWidget = (picked: string) => {
    setWidgetLabel(picked)
    setLabelIssue(null)
    setDraft(formulas.find((widget) => widget.label === picked) ?? BlankWidget)
  }

  const onApply = () => {
    carryOut(planWidgetingEdit({ widgeting, label, description, widgetLabel, widget: draft }, library, quiz), dispatch, refusing(setIssue, setLabelIssue), onClose)
  }

  return (
    <Dialog open onClose={ignoringBackdrop(onClose)} fullWidth maxWidth="md" aria-labelledby="formula-dialog-title">
      <ClosableTitle id="formula-dialog-title" onClose={onClose}>{widgeting ? `Widgeting: ${widgeting.label}` : 'New formula widgeting'}</ClosableTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1.5 }}>
            <TextField size="small" label="Widgeting label" value={label} disabled={quiz.locked} sx={{ flex: '1 1 220px' }} placeholder={widgetLabel}
              helperText="Names it within this quiz; blank takes the widget's." onChange={(event) => { setLabel(event.target.value); setIssue(null) }} />
            <TextField size="small" label="Widgeting description" value={description} disabled={quiz.locked} sx={{ flex: '2 1 280px' }}
              helperText="What this widgeting is for in this quiz." onChange={(event) => { setDescription(event.target.value) }} />
          </Stack>
          <Divider />
          <TextField select size="small" label="Widget" value={widgetLabel} disabled={quiz.locked || widgeting !== null} sx={{ maxWidth: 360 }}
            onChange={(event) => { pickWidget(event.target.value) }}>
            <MenuItem value={NewWidget}>＋ New widget…</MenuItem>
            {formulas.map((each) => <MenuItem key={each.label} value={each.label}>{each.label}</MenuItem>)}
          </TextField>
          <JsonataFields
            key={widgetLabel}
            hunt={hunt}
            library={library}
            openQuiz={quiz}
            draft={draft}
            onChange={(patch) => { setDraft((was) => ({ ...was, ...patch })); setIssue(null); setLabelIssue(null) }}
            labelEditable={isNew}
            labelIssue={labelIssue}
            widgeting={{ label: label || widgetLabel, description }}
          />
          {issue !== null && <p className={styles.microcopy} role="alert">{issue}</p>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        {widgeting && ! quiz.locked
          ? (
            <ConfirmRemove
              noun="widgeting"
              question="Remove this widgeting, and the columns that show it? Its widget stays in the library."
              onConfirm={() => { dispatch({ kind: 'delete_widgeting', label: widgeting.label }); onClose() }}
            />
          )
          : <span />}
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={onApply}>Apply</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}

type PromptDialogProps = {
  hunt:      ShallowHuntT
  quiz:      QuizT
  library:   readonly WidgetT[]
  /** The widgeting being edited, or null to make a new one */
  widgeting: WidgetingT | null
  dispatch:  (action: HuntActionDNA) => void
  onClose:   () => void
}

/**
 * One widgeting of a prompt and the widget behind it, edited together: what a pasted prompt is
 * written in.
 *
 * The widgeting's label and description sit above the prompt it works, which is written with its
 * input formula and config, and previewed against any question in the hunt: what the input
 * formula distils it to, and the prompt as it would be sent. Nothing is asked from here, and
 * nothing is applied until Apply. A new widgeting can work a prompt of the library or a new one
 * written on the spot, and brings a column to ask it from. Removing a widgeting asks first; its
 * widget stays in the library.
 */
function PromptDialog({ hunt, quiz, library, widgeting, dispatch, onClose }: Readonly<PromptDialogProps>) {
  const prompts = library.filter((widget): widget is AibotWidgetT => widget.formulary === 'aibot')
  const held = prompts.find((widget) => widget.label === widgeting?.widget_label)
  const [label, setLabel] = useState(widgeting?.label ?? '')
  const [description, setDescription] = useState(widgeting?.description ?? '')
  const [widgetLabel, setWidgetLabel] = useState(widgeting?.widget_label ?? NewWidget)
  const [draft, setDraft] = useState<AibotDraft>(held ? aibotDraftOf(held) : BlankAibotDraft)
  const [issue, setIssue] = useState<string | null>(null)
  const [labelIssue, setLabelIssue] = useState<string | null>(null)

  const pickWidget = (picked: string) => {
    const widget = prompts.find((each) => each.label === picked)
    setWidgetLabel(picked)
    setLabelIssue(null)
    setDraft(widget ? aibotDraftOf(widget) : BlankAibotDraft)
  }

  const onApply = () => {
    carryOut(planWidgetingEdit({ widgeting, label, description, widgetLabel, widget: draft }, library, quiz), dispatch, refusing(setIssue, setLabelIssue), onClose)
  }

  return (
    <Dialog open onClose={ignoringBackdrop(onClose)} fullWidth maxWidth="md" aria-labelledby="prompt-dialog-title">
      <ClosableTitle id="prompt-dialog-title" onClose={onClose}>{widgeting ? `Widgeting: ${widgeting.label}` : 'New prompt widgeting'}</ClosableTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1.5 }}>
            <TextField size="small" label="Widgeting label" value={label} disabled={quiz.locked} sx={{ flex: '1 1 220px' }} placeholder={widgetLabel}
              helperText="Names it within this quiz; blank takes the widget's." onChange={(event) => { setLabel(event.target.value); setIssue(null) }} />
            <TextField size="small" label="Widgeting description" value={description} disabled={quiz.locked} sx={{ flex: '2 1 280px' }}
              helperText="What this widgeting is for in this quiz." onChange={(event) => { setDescription(event.target.value) }} />
          </Stack>
          <Divider />
          <TextField select size="small" label="Widget" value={widgetLabel} disabled={quiz.locked || widgeting !== null} sx={{ maxWidth: 360 }}
            onChange={(event) => { pickWidget(event.target.value) }}>
            <MenuItem value={NewWidget}>＋ New widget…</MenuItem>
            {prompts.map((each) => <MenuItem key={each.label} value={each.label}>{Widget.titleOf(each)}</MenuItem>)}
          </TextField>
          <AibotFields
            key={widgetLabel}
            hunt={hunt}
            library={library}
            openQuiz={quiz}
            draft={draft}
            onChange={(patch) => { setDraft((was) => ({ ...was, ...patch })); setIssue(null); setLabelIssue(null) }}
            labelEditable={widgetLabel === NewWidget}
            labelIssue={labelIssue}
            widgeting={{ label: label || widgetLabel, description }}
          />
          {issue !== null && <p className={styles.microcopy} role="alert">{issue}</p>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        {widgeting && ! quiz.locked
          ? (
            <ConfirmRemove
              noun="widgeting"
              question="Remove this widgeting, the columns that show it, and every answer it kept? Its widget stays in the library."
              onConfirm={() => { dispatch({ kind: 'delete_widgeting', label: widgeting.label }); onClose() }}
            />
          )
          : <span />}
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={onApply}>Apply</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}

/** An `aibot` widget of the library as a draft to revise */
function aibotDraftOf(widget: AibotWidgetT): AibotDraft {
  return draftOf(widget) as AibotDraft
}
