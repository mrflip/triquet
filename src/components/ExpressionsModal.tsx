'use client'

import { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, IconButton, Stack } from '@mui/material'
import { ClosableTitle, ignoringBackdrop } from './ClosableTitle'
import { ConfirmRemove } from './ConfirmRemove'
import { ExpressionFields, type ExpressionDraft } from './ExpressionFields'
import { ExpressionValidators, type ExpressionT } from '../models/expression'
import { expressionUsage, type WorkspaceAction } from '../state/workspace-reducer'
import type { WorkspaceT } from '../models/workspace'
import styles from './workbench.module.css'

export type ExpressionsModalProps = {
  onClose:   () => void
  workspace: WorkspaceT
  /** The quiz the preview starts on */
  quizId:    string
  dispatch:  (action: WorkspaceAction) => void
}

/**
 * The workspace's expressions -- the calculations any quiz can show as a column -- listed, each
 * with a gear that opens its formula for editing and, when no column works it, removing.
 *
 * New expressions are written from a new column's editor, where they can be tried against real
 * questions and put to work at once; this list is for revisiting and tidying them.
 */
export function ExpressionsModal({ onClose, workspace, quizId, dispatch }: Readonly<ExpressionsModalProps>) {
  const [editing, setEditing] = useState<string | null>(null)
  const edited = workspace.expressions.find((expression) => expression.label === editing)

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="expressions-title">
      <ClosableTitle id="expressions-title" onClose={onClose}>Expressions</ClosableTitle>
      <DialogContent>
        <p className={styles.microcopy}>
          Each is a <a href="https://docs.jsonata.org" target="_blank" rel="noreferrer">JSONata</a> formula
          worked out for every question. To make a new one, add a new column to a quiz and choose
          &ldquo;New expression&rdquo;.
        </p>
        <Stack spacing={1}>
          {workspace.expressions.map((expression) => (
            <Stack key={`${expression.owner}/${expression.label}`} direction="row" spacing={1} role="group" aria-label={`Expression ${expression.label}`} sx={{ alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{expression.label}</strong>
                <div className={styles.microcopy}>{expression.description}</div>
              </div>
              <span className={styles.microcopy}>{usageNote(expressionUsage(workspace, expression.label))}</span>
              <IconButton size="small" aria-label={`Edit expression ${expression.label}`} onClick={() => { setEditing(expression.label) }}>⚙</IconButton>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Done</Button></DialogActions>
      {edited && (
        <ExpressionEditor
          key={edited.label}
          workspace={workspace}
          quizId={quizId}
          expression={edited}
          dispatch={dispatch}
          onClose={() => { setEditing(null) }}
        />
      )}
    </Dialog>
  )
}

/** What to say about how many columns work an expression */
function usageNote(usage: number): string {
  if (usage === 0) { return 'Not used by any column' }
  return usage === 1 ? 'Worked by 1 column' : `Worked by ${String(usage)} columns`
}

type ExpressionEditorProps = {
  workspace:  WorkspaceT
  quizId:     string
  expression: ExpressionT
  dispatch:   (action: WorkspaceAction) => void
  onClose:    () => void
}

/**
 * One expression on its own: formula and description to revise with a live preview, and a
 * removal that asks first and is not offered while any column works the expression.
 */
function ExpressionEditor({ workspace, quizId, expression, dispatch, onClose }: Readonly<ExpressionEditorProps>) {
  const [draft, setDraft] = useState<ExpressionDraft>(expression)
  const [issue, setIssue] = useState<string | null>(null)
  const usage = expressionUsage(workspace, expression.label)

  const onApply = () => {
    const patch = ExpressionValidators.expressionPatch.safeParse({ formula: draft.formula, description: draft.description })
    if (! patch.success) { setIssue(patch.error.issues[0]?.message ?? 'That will not do.'); return }
    dispatch({ kind: 'edit_expression', label: expression.label, patch: patch.data })
    onClose()
  }

  return (
    <Dialog open onClose={ignoringBackdrop(onClose)} fullWidth maxWidth="md" aria-labelledby="expression-editor-title">
      <ClosableTitle id="expression-editor-title" onClose={onClose}>Expression: {expression.label}</ClosableTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 1 }}>
          <ExpressionFields
            workspace={workspace}
            defaultQuizId={quizId}
            draft={draft}
            onChange={(patch) => { setDraft((was) => ({ ...was, ...patch })); setIssue(null) }}
            labelEditable={false}
            labelIssue={null}
            expressing={null}
          />
          {issue !== null && <p className={styles.microcopy} role="alert">{issue}</p>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <ConfirmRemove
          noun="expression"
          question="Remove this expression for good?"
          refusal={usage > 0 ? `${usageNote(usage)}, so it cannot be removed.` : null}
          onConfirm={() => { dispatch({ kind: 'delete_expression', label: expression.label }); onClose() }}
        />
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={onApply}>Apply</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}
