'use client'

import { Button, Stack } from '@mui/material'

export type ToolbarProps = {
  locked:        boolean
  onAddQuestion: () => void
  onRenumber:    () => void
  onSortByChain: () => void
}

/** What the author can do to the round as a whole */
export function Toolbar({ locked, onAddQuestion, onRenumber, onSortByChain }: Readonly<ToolbarProps>) {
  return (
    <Stack direction="row" spacing={1} sx={{ my: 2, flexWrap: 'wrap' }}>
      <Button size="small" variant="outlined" disabled={locked} onClick={onAddQuestion}>+ Add question</Button>
      <Button size="small" variant="outlined" disabled={locked} onClick={onSortByChain}>Sort by chain order</Button>
      <Button size="small" variant="outlined" disabled={locked} onClick={onRenumber}>Renumber Q#</Button>
    </Stack>
  )
}
