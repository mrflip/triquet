'use client'

import { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, Stack, TextField } from '@mui/material'
import { ConfirmRemove } from './ConfirmRemove'
import { ExpressionFields, type ExpressionDraft } from './ExpressionFields'
import { NewExpression, planColumnEdit } from '../state/column-edit'
import { ExpressingShapeVals, type ExpressingShape, type ExpressingT } from '../models/expressing'
import type { QuizT } from '../models/quiz'
import type { WorkspaceT } from '../models/workspace'
import type { WorkspaceAction } from '../state/workspace-reducer'
import styles from './workbench.module.css'

export type ColumnEditorProps = {
  workspace: WorkspaceT
  quiz:      QuizT
  /** The column being edited, or null to make a new one */
  expressing: ExpressingT | null
  dispatch:  (action: WorkspaceAction) => void
  onClose:   () => void
}

const BlankExpression: ExpressionDraft = { label: '', description: '', formula: '' }

/**
 * One computed column and the expression behind it, edited together.
 *
 * The column's title, label, description and width sit above the expression it works, whose
 * formula is written with a live preview against any question in the workspace. Nothing is
 * applied until Apply. A new column can work an existing expression or a new one written on the
 * spot. Removing a column asks first; an expression is never removed from here, because a
 * column may still be working it.
 */
export function ColumnEditor({ workspace, quiz, expressing, dispatch, onClose }: Readonly<ColumnEditorProps>) {
  const heldExpression = workspace.expressions.find((expression) => expression.label === expressing?.expression_label)
  const [title, setTitle] = useState(expressing?.title ?? '')
  const [label, setLabel] = useState(expressing?.label ?? '')
  const [description, setDescription] = useState(expressing?.description ?? '')
  const [shape, setShape] = useState<ExpressingShape>(expressing?.shape ?? 'skinny')
  const [expressionLabel, setExpressionLabel] = useState(expressing?.expression_label ?? NewExpression)
  const [draft, setDraft] = useState<ExpressionDraft>(heldExpression ?? BlankExpression)
  const [issue, setIssue] = useState<string | null>(null)
  const [labelIssue, setLabelIssue] = useState<string | null>(null)

  const isNew = expressionLabel === NewExpression
  const columnLocked = quiz.locked

  const pickExpression = (picked: string) => {
    setExpressionLabel(picked)
    setLabelIssue(null)
    setDraft(workspace.expressions.find((expression) => expression.label === picked) ?? BlankExpression)
  }

  const onApply = () => {
    const plan = planColumnEdit({ expressing, title, label, description, shape, expressionLabel, expression: draft }, workspace, quiz)
    if (! plan.ok) { setIssue(plan.issue); setLabelIssue(plan.labelIssue); return }
    for (const action of plan.actions) { dispatch(action) }
    onClose()
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="column-editor-title">
      <DialogTitle id="column-editor-title">{expressing ? `Column: ${expressing.title || expressing.label}` : 'New column'}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1.5 }}>
            <TextField size="small" label="Column title" value={title} disabled={columnLocked} sx={{ flex: '2 1 220px' }}
              helperText="The header the grid shows." onChange={(event) => { setTitle(event.target.value) }} />
            <TextField size="small" label="Column label" value={label} disabled={columnLocked} sx={{ flex: '1 1 180px' }}
              placeholder={expressionLabel} helperText="Names it in exports; blank takes the expression's."
              onChange={(event) => { setLabel(event.target.value) }} />
            <TextField select size="small" label="Width" value={shape} disabled={columnLocked} sx={{ flex: '0 1 120px' }}
              onChange={(event) => { setShape(ExpressingShapeVals.find((each) => each === event.target.value) ?? 'skinny') }}>
              {ExpressingShapeVals.map((each) => <MenuItem key={each} value={each}>{each}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField size="small" label="Column description" value={description} disabled={columnLocked}
            helperText="What this column is for in this quiz." onChange={(event) => { setDescription(event.target.value) }} />
          <Divider />
          <TextField select size="small" label="Expression" value={expressionLabel} disabled={columnLocked} sx={{ maxWidth: 360 }}
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
            expressing={{ label: label || expressionLabel, title, description, shape }}
          />
          {issue !== null && <p className={styles.microcopy} role="alert">{issue}</p>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        {expressing && ! columnLocked
          ? (
            <ConfirmRemove
              noun="column"
              question="Remove this column from the quiz? Its expression stays."
              onConfirm={() => { dispatch({ kind: 'delete_expressing', label: expressing.label }); onClose() }}
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
