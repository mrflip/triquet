'use client'

import { Button, Stack } from '@mui/material'

export type ToolbarProps = {
  locked:        boolean
  onAddQuestion: () => void
  onRenumber:    () => void
}

/** What the author can do to the round as a whole */
export function Toolbar({ locked, onAddQuestion, onRenumber }: Readonly<ToolbarProps>) {
  return (
    <Stack direction="row" spacing={1} sx={{ my: 2, flexWrap: 'wrap' }}>
      <Button size="small" variant="outlined" disabled={locked} onClick={onAddQuestion}>+ Add question</Button>
      <Button size="small" variant="outlined" disabled={locked} onClick={onRenumber}>Renumber Q#</Button>
    </Stack>
  )
}
