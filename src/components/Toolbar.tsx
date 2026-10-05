'use client'

import { Button, Stack } from '@mui/material'
import { VizChoices } from './ConfirmViz'
import type { QuestionViz } from '../models/question'

export type ToolbarProps = {
  /** Whether the questions are left as they are: adding, selecting, sorting and renumbering not offered */
  locked:          boolean
  /** Whether the grid is in batch mode, its questions showing checkboxes */
  batching:        boolean
  /** How many questions are checked, in batch mode */
  checkedCount:    number
  onBatch:         (on: boolean) => void
  /** Shows the checked questions as `viz` says: archiving asks first, the caller's to ask */
  onVizChecked:    (viz: QuestionViz) => void
  onAddQuestion:   () => void
  onSortByChain:   () => void
  onRenumber:      () => void
  onEditLibrary:   () => void
}

/** What batch mode offers for the checked questions, in the order its buttons stand */
const BatchVizzes: readonly QuestionViz[] = ['archived', 'secondary', 'normal']

/** What the author can do to the quiz as a whole, and in batch mode to the questions checked */
export function Toolbar({ locked, batching, checkedCount, onBatch, onVizChecked, onAddQuestion, onSortByChain, onRenumber, onEditLibrary }: Readonly<ToolbarProps>) {
  return (
    <Stack direction="row" spacing={1} sx={{ my: 2, flexWrap: 'wrap', alignItems: 'center' }}>
      <Button size="small" variant="outlined" disabled={locked} onClick={onAddQuestion}>+ Add question</Button>
      {batching ? (
        <>
          {BatchVizzes.map((viz) => {
            const { actname, Icon, color } = VizChoices[viz]
            return (
              <Button key={viz} size="small" variant={viz === 'archived' ? 'contained' : 'outlined'} color={color} startIcon={<Icon />} disabled={checkedCount === 0} onClick={() => { onVizChecked(viz) }}>
                {viz === 'archived' ? 'Archive selected' : actname} ({checkedCount})
              </Button>
            )
          })}
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
