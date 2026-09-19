'use client'

import { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, TextField } from '@mui/material'
import { useDraft } from './use-draft'
import * as Formulas from '../lib/formulas'
import * as Labelmaker from '../lib/labelmaker'
import { ExpressionValidators, DefaultOwner, type ExpressionPatch, type ExpressionT } from '../models/expression'
import { expressionUsage, type WorkspaceAction } from '../state/workspace-reducer'
import type { WorkspaceT } from '../models/workspace'
import styles from './workbench.module.css'

export type ExpressionsModalProps = {
  onClose:   () => void
  workspace: WorkspaceT
  dispatch:  (action: WorkspaceAction) => void
}

/**
 * The workspace's expressions -- the calculations any quiz can show as a column -- to read,
 * revise, remove and add to.
 *
 * A formula is checked as it is typed, so a mistake is named before it costs a column its
 * numbers. One that is still wrong is kept anyway: the column says so, and the author is
 * drafting, not filling in a form. An expression a column still works cannot be removed.
 */
export function ExpressionsModal({ onClose, workspace, dispatch }: Readonly<ExpressionsModalProps>) {
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="expressions-title">
      <DialogTitle id="expressions-title">Expressions</DialogTitle>
      <DialogContent>
        <p className={styles.microcopy}>
          A formula is written in <a href="https://docs.jsonata.org" target="_blank" rel="noreferrer">JSONata</a> and
          reads <code>qn</code> (this question), <code>qns</code> (every question), <code>qn_label</code>,
          {' '}<code>quiz</code> and <code>quiz_label</code>. Questions are named by label, and each carries
          its <code>rank</code>: <code>qns[label = $$.qn.chains_to]</code> is the question this one chains to.
          Answer with a value, or with <code>{'{ \'value\': …, \'stale\': … }'}</code> to grey a value that is out of date.
        </p>
        <Stack spacing={2} divider={<Divider flexItem />}>
          {workspace.expressions.map((expression) => (
            <ExpressionEditor
              key={`${expression.owner}/${expression.label}`}
              expression={expression}
              usage={expressionUsage(workspace, expression.label)}
              dispatch={dispatch}
            />
          ))}
          <NewExpression taken={new Set(workspace.expressions.map((expression) => expression.label))} dispatch={dispatch} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  )
}

type ExpressionEditorProps = {
  expression: ExpressionT
  /** How many columns work this expression */
  usage:      number
  dispatch:   (action: WorkspaceAction) => void
}

/** One expression: its formula and description to revise, and a way to remove it when nothing uses it */
function ExpressionEditor({ expression, usage, dispatch }: Readonly<ExpressionEditorProps>) {
  const [issue, setIssue] = useState<string | null>(null)

  const revise = (patch: ExpressionPatch) => {
    const checked = ExpressionValidators.expressionPatch.safeParse(patch)
    if (! checked.success) { setIssue(checked.error.issues[0]?.message ?? 'That will not do.'); return }
    setIssue(null)
    dispatch({ kind: 'edit_expression', label: expression.label, patch: checked.data })
  }

  const formulaDraft = useDraft(expression.formula, (formula) => { revise({ formula }) })
  const descriptionDraft = useDraft(expression.description, (description) => { revise({ description }) })
  const syntaxIssue = Formulas.check(formulaDraft.draft)

  return (
    <Stack spacing={1} role="group" aria-label={`Expression ${expression.label}`}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <strong>{expression.label}</strong>
        <span className={styles.microcopy} style={{ flex: 1 }}>{usageNote(usage)}</span>
        <Button
          size="small" color="error" disabled={usage > 0}
          aria-label={`Remove expression ${expression.label}`}
          onClick={() => { dispatch({ kind: 'delete_expression', label: expression.label }) }}
        >
          Remove
        </Button>
      </Stack>
      <TextField
        size="small" multiline minRows={2} maxRows={12} label="Formula" value={formulaDraft.draft}
        error={syntaxIssue !== null || issue !== null} helperText={syntaxIssue ?? issue ?? undefined}
        slotProps={{ htmlInput: { 'aria-label': `Formula of ${expression.label}`, style: { fontFamily: 'var(--font-data)', fontSize: 12 } } }}
        onChange={(event) => { formulaDraft.onChange(event.target.value); setIssue(null) }} onBlur={formulaDraft.onBlur}
      />
      <TextField
        size="small" label="Description" value={descriptionDraft.draft}
        slotProps={{ htmlInput: { 'aria-label': `Description of ${expression.label}` } }}
        onChange={(event) => { descriptionDraft.onChange(event.target.value) }} onBlur={descriptionDraft.onBlur}
      />
    </Stack>
  )
}

/** What to say about how many columns work an expression */
function usageNote(usage: number): string {
  if (usage === 0) { return 'Not used by any column.' }
  return usage === 1 ? 'Worked by 1 column.' : `Worked by ${String(usage)} columns.`
}

/** The form for a new expression: a label to choose, and a formula to start from */
function NewExpression({ taken, dispatch }: Readonly<{ taken: ReadonlySet<string>, dispatch: (action: WorkspaceAction) => void }>) {
  const [labelDraft, setLabelDraft] = useState('')
  const [formula, setFormula] = useState('')
  const [description, setDescription] = useState('')
  const [issue, setIssue] = useState<string | null>(null)

  const onAdd = () => {
    const label = Labelmaker.snakify(labelDraft)
    if (labelDraft.trim() === '') { setIssue('Give the expression a label.'); return }
    if (taken.has(label)) { setIssue('Another expression already has that label.'); return }
    const checked = ExpressionValidators.expression.safeParse({ owner: DefaultOwner, label, formula, description })
    if (! checked.success) { setIssue(checked.error.issues[0]?.message ?? 'That will not do.'); return }
    dispatch({ kind: 'add_expression', expression: checked.data })
    setLabelDraft('')
    setFormula('')
    setDescription('')
    setIssue(null)
  }

  return (
    <Stack spacing={1} role="group" aria-label="New expression">
      <strong>New expression</strong>
      <TextField
        size="small" label="Label" value={labelDraft} sx={{ maxWidth: 280 }}
        onChange={(event) => { setLabelDraft(event.target.value); setIssue(null) }}
      />
      <TextField
        size="small" multiline minRows={2} maxRows={12} label="New formula" value={formula}
        slotProps={{ htmlInput: { style: { fontFamily: 'var(--font-data)', fontSize: 12 } } }}
        error={formula !== '' && Formulas.check(formula) !== null} helperText={formula === '' ? undefined : Formulas.check(formula) ?? undefined}
        onChange={(event) => { setFormula(event.target.value); setIssue(null) }}
      />
      <TextField
        size="small" label="New description" value={description}
        onChange={(event) => { setDescription(event.target.value) }}
      />
      {issue !== null && <p className={styles.microcopy} role="alert">{issue}</p>}
      <Stack direction="row">
        <Button size="small" variant="contained" onClick={onAdd}>Add expression</Button>
      </Stack>
    </Stack>
  )
}
