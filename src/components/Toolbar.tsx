'use client'

import { Button, Stack } from '@mui/material'
import clsx from 'clsx'
import type { BulkIshesRunT } from '../models/quiz'
import styles from './workbench.module.css'

export type ToolbarProps = {
  locked:          boolean
  /** What the last combined run cost, kept per quiz and across reloads */
  bulkIshesLast:   BulkIshesRunT
  /** Whether a combined run is in flight */
  running:         boolean
  /** The one-off line about a run that did not land */
  runNotice:       string | null
  onAddQuestion:   () => void
  onSortByChain:   () => void
  onRenumber:      () => void
  onRecalculate:   () => void
}

/** What the author can do to the quiz as a whole, and what the last batch run cost */
export function Toolbar({ locked, bulkIshesLast, running, runNotice, onAddQuestion, onSortByChain, onRenumber, onRecalculate }: Readonly<ToolbarProps>) {
  return (
    <Stack direction="row" spacing={1} sx={{ my: 2, flexWrap: 'wrap', alignItems: 'center' }}>
      <Button size="small" variant="outlined" disabled={locked} onClick={onAddQuestion}>+ Add question</Button>
      <Button size="small" variant="outlined" disabled={locked} onClick={onSortByChain}>Sort by chain order</Button>
      <Button size="small" variant="outlined" disabled={locked} onClick={onRenumber}>Renumber Q#</Button>
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
    </Stack>
  )
}
