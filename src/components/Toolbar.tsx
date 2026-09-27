'use client'

import { Button, Stack } from '@mui/material'
import clsx from 'clsx'
import { ErrBadge } from './cells/ErrBadge'
import { bulkRunFailedNotice } from '../lib/notices'
import type { LastErrT } from '../models/ask'
import type { BulkIshesRunT } from '../models/quiz'
import styles from './workbench.module.css'

export type ToolbarProps = {
  locked:          boolean
  /** What the last combined run cost, kept per quiz and across reloads */
  bulkIshesLast:   BulkIshesRunT
  /** Whether a combined run is in flight */
  running:         boolean
  /** The one-off line about a run that had nothing to do */
  runNotice:       string | null
  /** Why the last run did not land; it belongs here, never on the cells */
  runFailure:      LastErrT | null
  /** Whether the grid is in batch mode, its questions showing checkboxes */
  batching:        boolean
  /** How many questions are checked, in batch mode */
  checkedCount:    number
  onBatch:         (on: boolean) => void
  /** Asks to delete the checked questions; the asking-first is the caller's */
  onDeleteChecked: () => void
  onAddQuestion:   () => void
  onSortByChain:   () => void
  onRenumber:      () => void
  onRecalculate:   () => void
  onEditExpressions: () => void
}

/** What the author can do to the quiz as a whole, and what the last batch run cost */
export function Toolbar({ locked, bulkIshesLast, running, runNotice, runFailure, batching, checkedCount, onBatch, onDeleteChecked, onAddQuestion, onSortByChain, onRenumber, onRecalculate, onEditExpressions }: Readonly<ToolbarProps>) {
  return (
    <Stack direction="row" spacing={1} sx={{ my: 2, flexWrap: 'wrap', alignItems: 'center' }}>
      <Button size="small" variant="outlined" disabled={locked} onClick={onAddQuestion}>+ Add question</Button>
      {batching ? (
        <>
          <Button size="small" variant="contained" color="error" disabled={checkedCount === 0} onClick={onDeleteChecked}>
            Delete checked ({checkedCount})
          </Button>
          <Button size="small" variant="outlined" onClick={() => { onBatch(false) }}>Done selecting</Button>
        </>
      ) : (
        <Button size="small" variant="outlined" disabled={locked} onClick={() => { onBatch(true) }}>Select questions</Button>
      )}
      <Button size="small" variant="outlined" disabled={locked} onClick={onSortByChain}>Sort by chain order</Button>
      <Button size="small" variant="outlined" disabled={locked} onClick={onRenumber}>Renumber Q#</Button>
      {/* Not disabled by a lock: the expressions belong to the hunt, not to this quiz. */}
      <Button size="small" variant="outlined" onClick={onEditExpressions}>Edit expressions</Button>
      <span style={{ flex: 1 }} />
      <Button size="small" variant="contained" disabled={locked || running} onClick={onRecalculate}>
        {running ? 'Recalculating…' : 'Recalculate all ishes'}
      </Button>
      {bulkIshesLast === null ? null : (
        <span
          className={clsx(styles.pill, styles.pillQuiet)}
          title={new Date(bulkIshesLast.updated_at).toLocaleString()}
        >
          ~{bulkIshesLast.approx_tokens.toLocaleString('en-US')} tok last time ({bulkIshesLast.text_count} texts)
        </span>
      )}
      {runNotice === null ? null : <span className={clsx(styles.pill, styles.pillBad)} role="status">{runNotice}</span>}
      {runFailure === null ? null : (
        <span className={clsx(styles.pill, styles.pillBad)} role="status">
          {bulkRunFailedNotice(runFailure.message)}
          <ErrBadge err={runFailure} inline />
        </span>
      )}
    </Stack>
  )
}
