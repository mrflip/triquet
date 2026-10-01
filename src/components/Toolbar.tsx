'use client'

import { Button, Stack } from '@mui/material'

export type ToolbarProps = {
  locked:          boolean
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
  onEditLibrary:   () => void
}

/** What the author can do to the quiz as a whole */
export function Toolbar({ locked, batching, checkedCount, onBatch, onDeleteChecked, onAddQuestion, onSortByChain, onRenumber, onEditLibrary }: Readonly<ToolbarProps>) {
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
      {/* Not disabled by a lock: the library belongs to no quiz. */}
      <Button size="small" variant="outlined" onClick={onEditLibrary}>Widget library</Button>
    </Stack>
  )
}
