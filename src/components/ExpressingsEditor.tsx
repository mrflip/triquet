'use client'

import { useState } from 'react'
import { Button, MenuItem, Stack, TextField } from '@mui/material'
import { useDraft } from './use-draft'
import * as Labelmaker from '../lib/labelmaker'
import { Expressing, ExpressingShapeVals, ExpressingValidators, type ExpressingPatch, type ExpressingT } from '../models/expressing'
import type { ExpressionT } from '../models/expression'
import type { QuizT } from '../models/quiz'
import type { WorkspaceAction } from '../state/workspace-reducer'
import styles from './workbench.module.css'

export type ExpressingsEditorProps = {
  quiz:              QuizT
  /** Every expression the workspace holds, for a column to name */
  expressions:       readonly ExpressionT[]
  dispatch:          (action: WorkspaceAction) => void
  onEditExpressions: () => void
}

/**
 * A quiz's computed columns, listed for revising, removing and adding to.
 *
 * Each column names one of the workspace's expressions and gives it a title, a label and a
 * width. Text is committed when its field loses focus; a choice is committed at once.
 */
export function ExpressingsEditor({ quiz, expressions, dispatch, onEditExpressions }: Readonly<ExpressingsEditorProps>) {
  const taken = new Set(quiz.expressings.map((expressing) => expressing.label))

  return (
    <Stack spacing={1.5}>
      {quiz.expressings.length === 0 && <p className={styles.microcopy}>This quiz shows no computed columns yet.</p>}
      {quiz.expressings.map((expressing) => (
        <ExpressingRow
          key={expressing.label}
          expressing={expressing}
          expressions={expressions}
          locked={quiz.locked}
          siblingLabels={taken}
          dispatch={dispatch}
        />
      ))}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <TextField
          select
          size="small"
          label="Add a column"
          value=""
          disabled={quiz.locked || expressions.length === 0}
          sx={{ minWidth: 240 }}
          onChange={(event) => {
            const expression = expressions.find((other) => other.label === event.target.value)
            if (! expression) { return }
            dispatch({ kind: 'add_expressing', expressing: Expressing.forExpression(expression, taken) })
          }}
        >
          {expressions.map((expression) => <MenuItem key={expression.label} value={expression.label}>{expression.label}</MenuItem>)}
        </TextField>
        <Button size="small" variant="outlined" onClick={onEditExpressions}>Edit expressions…</Button>
      </Stack>
    </Stack>
  )
}

type ExpressingRowProps = {
  expressing:    ExpressingT
  expressions:   readonly ExpressionT[]
  locked:        boolean
  siblingLabels: ReadonlySet<string>
  dispatch:      (action: WorkspaceAction) => void
}

/** One computed column: its title and label to type into, its expression and width to choose, and a way to remove it */
function ExpressingRow({ expressing, expressions, locked, siblingLabels, dispatch }: Readonly<ExpressingRowProps>) {
  const [issue, setIssue] = useState<string | null>(null)

  const revise = (patch: ExpressingPatch): boolean => {
    const checked = ExpressingValidators.expressingPatch.safeParse(patch)
    if (! checked.success) { setIssue(checked.error.issues[0]?.message ?? 'That will not do.'); return false }
    setIssue(null)
    dispatch({ kind: 'edit_expressing', label: expressing.label, patch: checked.data })
    return true
  }

  const titleDraft = useDraft(expressing.title, (title) => { revise({ title }) })
  const labelDraft = useDraft(expressing.label, (label) => {
    if (siblingLabels.has(label)) { setIssue('Another column in this quiz already has that label.'); return }
    revise({ label })
  }, (draft) => Labelmaker.normalize(draft))

  const known = expressions.some((expression) => expression.label === expressing.expression_label)

  return (
    <Stack direction="row" spacing={1} role="group" aria-label={`Column ${expressing.title || expressing.label}`} sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'flex-start' }}>
      <TextField
        size="small" label="Column title" value={titleDraft.draft} disabled={locked} sx={{ flex: '1 1 160px' }}
        onChange={(event) => { titleDraft.onChange(event.target.value) }} onBlur={titleDraft.onBlur}
      />
      <TextField
        size="small" label="Column label" value={labelDraft.draft} disabled={locked} sx={{ flex: '1 1 140px' }}
        error={issue !== null} helperText={issue}
        onChange={(event) => { labelDraft.onChange(event.target.value); setIssue(null) }} onBlur={labelDraft.onBlur}
      />
      <TextField
        select size="small" label="Expression" value={expressing.expression_label} disabled={locked} sx={{ flex: '1 1 180px' }}
        error={! known} helperText={known ? undefined : 'This expression is gone.'}
        onChange={(event) => { revise({ expression_label: event.target.value }) }}
      >
        {known ? null : <MenuItem value={expressing.expression_label} disabled>{expressing.expression_label}</MenuItem>}
        {expressions.map((expression) => <MenuItem key={expression.label} value={expression.label}>{expression.label}</MenuItem>)}
      </TextField>
      <TextField
        select size="small" label="Width" value={expressing.shape} disabled={locked} sx={{ flex: '0 1 110px' }}
        onChange={(event) => { revise({ shape: ExpressingShapeVals.find((shape) => shape === event.target.value) }) }}
      >
        {ExpressingShapeVals.map((shape) => <MenuItem key={shape} value={shape}>{shape}</MenuItem>)}
      </TextField>
      <Button
        size="small" color="error" disabled={locked} aria-label={`Remove column ${expressing.title || expressing.label}`}
        onClick={() => { dispatch({ kind: 'delete_expressing', label: expressing.label }) }}
      >
        Remove
      </Button>
    </Stack>
  )
}
