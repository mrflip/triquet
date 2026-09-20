'use client'

import { useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, Divider, IconButton, MenuItem, Stack, TextField } from '@mui/material'
import { ClosableTitle, ignoringBackdrop } from './ClosableTitle'
import { ConfirmRemove } from './ConfirmRemove'
import { ExpressionFields, type ExpressionDraft } from './ExpressionFields'
import { SortableList } from './SortableList'
import { TextkindVals } from '../lib/ask/contract'
import { NewExpression, planExpressingEdit, planPlayingEdit, type WidgetPlan } from '../state/widget-edit'
import { PlayerLabelVals } from '../models/player-label'
import type { ExpressingT, PlayingWidgetT, WidgetT } from '../models/widget'
import type { QuizT } from '../models/quiz'
import type { WorkspaceT } from '../models/workspace'
import type { WorkspaceAction } from '../state/workspace-reducer'
import styles from './workbench.module.css'

export type WidgetsEditorProps = {
  workspace:         WorkspaceT
  quiz:              QuizT
  dispatch:          (action: WorkspaceAction) => void
  onEditExpressions: () => void
}

/** Which widget's editor is open: one of the quiz's, or a new one of a kind */
type Editing = { kind: 'widget', label: string } | { kind: 'new_expressing' } | { kind: 'new_playing' } | null

/**
 * A quiz's widgets -- what it can show for every question besides the questions' own fields --
 * listed in their order, dragged into a new one by their handles, each with a gear that opens it.
 */
export function WidgetsEditor({ workspace, quiz, dispatch, onEditExpressions }: Readonly<WidgetsEditorProps>) {
  const [editing, setEditing] = useState<Editing>(null)
  const edited: WidgetT | null = editing?.kind === 'widget' ? quiz.widgets.find((each) => each.label === editing.label) ?? null : null
  const close = () => { setEditing(null) }

  return (
    <Stack spacing={1}>
      {quiz.widgets.length === 0 && <p className={styles.microcopy}>This quiz has no widgets.</p>}
      <SortableList
        label="Widgets"
        items={quiz.widgets}
        keyOf={(widget) => widget.label}
        disabled={quiz.locked}
        onMove={(label, onto_idx) => { dispatch({ kind: 'move_widget', label, onto_idx }) }}
        renderRow={(widget, handle) => (
          <Stack direction="row" spacing={1} role="group" aria-label={`Widget ${widget.label}`} sx={{ alignItems: 'center' }}>
            {handle}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <strong>{widget.label}</strong> <span className={styles.microcopy}>{widgetNote(widget)}</span>
              {widget.description === '' ? null : <div className={styles.microcopy}>{widget.description}</div>}
            </Box>
            <IconButton size="small" aria-label={`Edit widget ${widget.label}`} onClick={() => { setEditing({ kind: 'widget', label: widget.label }) }}>⚙</IconButton>
          </Stack>
        )}
      />
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <Button size="small" variant="outlined" disabled={quiz.locked} onClick={() => { setEditing({ kind: 'new_expressing' }) }}>+ New expressing…</Button>
        <Button size="small" variant="outlined" disabled={quiz.locked} onClick={() => { setEditing({ kind: 'new_playing' }) }}>+ New playing…</Button>
        <Button size="small" variant="outlined" onClick={onEditExpressions}>Edit expressions…</Button>
      </Stack>
      {(editing?.kind === 'new_expressing' || edited?.kind === 'expressing') && (
        <ExpressingDialog key={edited?.label ?? 'new'} workspace={workspace} quiz={quiz} widget={edited?.kind === 'expressing' ? edited : null} dispatch={dispatch} onClose={close} />
      )}
      {(editing?.kind === 'new_playing' || edited?.kind === 'playing') && (
        <PlayingDialog key={edited?.label ?? 'new'} quiz={quiz} widget={edited?.kind === 'playing' ? edited : null} dispatch={dispatch} onClose={close} />
      )}
    </Stack>
  )
}

/** What kind of widget it is, and what it does, in a few words */
function widgetNote(widget: WidgetT): string {
  return widget.kind === 'expressing' ? `expressing ${widget.expression_label}` : `playing: ${widget.player_label}, ${widget.textkind}`
}

const BlankExpression: ExpressionDraft = { label: '', description: '', formula: '' }

/** Runs `plan`, dispatching what it comes to; says what is wrong instead when it is refused */
function carryOut(plan: WidgetPlan, dispatch: (action: WorkspaceAction) => void, refuse: (issue: string, labelIssue: string | null) => void, done: () => void) {
  if (! plan.ok) { refuse(plan.issue, plan.labelIssue); return }
  for (const action of plan.actions) { dispatch(action) }
  done()
}

type ExpressingDialogProps = {
  workspace: WorkspaceT
  quiz:      QuizT
  /** The widget being edited, or null to make a new one */
  widget:    ExpressingT | null
  dispatch:  (action: WorkspaceAction) => void
  onClose:   () => void
}

/**
 * One expressing widget and the expression behind it, edited together.
 *
 * The widget's label and description sit above the expression it works, whose formula is
 * written with a live preview against any question in the workspace. Nothing is applied until
 * Apply. A new widget can work an existing expression or a new one written on the spot, and
 * brings a column to show it. Removing a widget asks first; an expression is never removed from
 * here, because a widget may still be working it.
 */
function ExpressingDialog({ workspace, quiz, widget, dispatch, onClose }: Readonly<ExpressingDialogProps>) {
  const heldExpression = workspace.expressions.find((expression) => expression.label === widget?.expression_label)
  const [label, setLabel] = useState(widget?.label ?? '')
  const [description, setDescription] = useState(widget?.description ?? '')
  const [expressionLabel, setExpressionLabel] = useState(widget?.expression_label ?? NewExpression)
  const [draft, setDraft] = useState<ExpressionDraft>(heldExpression ?? BlankExpression)
  const [issue, setIssue] = useState<string | null>(null)
  const [labelIssue, setLabelIssue] = useState<string | null>(null)

  const isNew = expressionLabel === NewExpression

  const pickExpression = (picked: string) => {
    setExpressionLabel(picked)
    setLabelIssue(null)
    setDraft(workspace.expressions.find((expression) => expression.label === picked) ?? BlankExpression)
  }

  const onApply = () => {
    carryOut(
      planExpressingEdit({ widget, label, description, expressionLabel, expression: draft }, workspace, quiz),
      dispatch,
      (problem, forLabel) => { setIssue(problem); setLabelIssue(forLabel) },
      onClose,
    )
  }

  return (
    <Dialog open onClose={ignoringBackdrop(onClose)} fullWidth maxWidth="md" aria-labelledby="expressing-dialog-title">
      <ClosableTitle id="expressing-dialog-title" onClose={onClose}>{widget ? `Expressing: ${widget.label}` : 'New expressing'}</ClosableTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1.5 }}>
            <TextField size="small" label="Widget label" value={label} disabled={quiz.locked} sx={{ flex: '1 1 220px' }} placeholder={expressionLabel}
              helperText="Names it within this quiz; blank takes the expression's." onChange={(event) => { setLabel(event.target.value); setIssue(null) }} />
            <TextField size="small" label="Widget description" value={description} disabled={quiz.locked} sx={{ flex: '2 1 280px' }}
              helperText="What this widget is for in this quiz." onChange={(event) => { setDescription(event.target.value) }} />
          </Stack>
          <Divider />
          <TextField select size="small" label="Expression" value={expressionLabel} disabled={quiz.locked} sx={{ maxWidth: 360 }}
            onChange={(event) => { pickExpression(event.target.value) }}>
            <MenuItem value={NewExpression}>＋ New expression…</MenuItem>
            {workspace.expressions.map((each) => <MenuItem key={each.label} value={each.label}>{each.label}</MenuItem>)}
          </TextField>
          <ExpressionFields
            key={expressionLabel}
            workspace={workspace}
            defaultQuizId={quiz.id}
            draft={draft}
            onChange={(patch) => { setDraft((was) => ({ ...was, ...patch })); setIssue(null); setLabelIssue(null) }}
            labelEditable={isNew}
            labelIssue={labelIssue}
            expressing={{ label: label || expressionLabel, description }}
          />
          {issue !== null && <p className={styles.microcopy} role="alert">{issue}</p>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        {widget && ! quiz.locked
          ? (
            <ConfirmRemove
              noun="widget"
              question="Remove this widget, and the columns that show it? Its expression stays."
              onConfirm={() => { dispatch({ kind: 'delete_widget', label: widget.label }); onClose() }}
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

type PlayingDialogProps = {
  quiz:     QuizT
  /** The widget being edited, or null to make a new one */
  widget:   PlayingWidgetT | null
  dispatch: (action: WorkspaceAction) => void
  onClose:  () => void
}

/** One playing widget: which player is put which text. Nothing is applied until Apply. */
function PlayingDialog({ quiz, widget, dispatch, onClose }: Readonly<PlayingDialogProps>) {
  const [label, setLabel] = useState(widget?.label ?? '')
  const [player_label, setPlayer] = useState(widget?.player_label ?? PlayerLabelVals[0])
  const [textkind, setTextkind] = useState(widget?.textkind ?? 'clueing')
  const [description, setDescription] = useState(widget?.description ?? '')
  const [issue, setIssue] = useState<string | null>(null)

  const onApply = () => {
    carryOut(planPlayingEdit({ widget, label, player_label, textkind, description }, quiz), dispatch, (problem) => { setIssue(problem) }, onClose)
  }

  return (
    <Dialog open onClose={ignoringBackdrop(onClose)} fullWidth maxWidth="sm" aria-labelledby="playing-dialog-title">
      <ClosableTitle id="playing-dialog-title" onClose={onClose}>{widget ? `Playing: ${widget.label}` : 'New playing'}</ClosableTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField size="small" label="Widget label" value={label} disabled={quiz.locked} helperText="Names it within this quiz."
            onChange={(event) => { setLabel(event.target.value); setIssue(null) }} />
          <Stack direction="row" spacing={1}>
            <TextField select size="small" label="Player" value={player_label} disabled={quiz.locked} sx={{ flex: 1 }}
              onChange={(event) => { setPlayer(PlayerLabelVals.find((each) => each === event.target.value) ?? PlayerLabelVals[0]); setIssue(null) }}>
              {PlayerLabelVals.map((each) => <MenuItem key={each} value={each}>{each}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Is shown" value={textkind} disabled={quiz.locked} sx={{ flex: 1 }}
              onChange={(event) => { setTextkind(TextkindVals.find((each) => each === event.target.value) ?? 'clueing'); setIssue(null) }}>
              {TextkindVals.map((each) => <MenuItem key={each} value={each}>{each}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField size="small" label="Widget description" value={description} disabled={quiz.locked}
            onChange={(event) => { setDescription(event.target.value) }} />
          {issue !== null && <p className={styles.microcopy} role="alert">{issue}</p>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        {widget && ! quiz.locked
          ? (
            <ConfirmRemove
              noun="widget"
              question="Remove this widget, and the columns that show it? The answers it showed are kept on the questions."
              onConfirm={() => { dispatch({ kind: 'delete_widget', label: widget.label }); onClose() }}
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
