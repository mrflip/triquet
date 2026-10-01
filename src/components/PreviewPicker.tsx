'use client'

import { MenuItem, Stack, TextField } from '@mui/material'
import type { PreviewBagHandle } from './use-preview-bag'

/**
 * The quiz and question a widget editor's preview is pointed at, as two selects: any quiz of the
 * hunt, and any of its questions in Q# order.
 *
 * @param preview - The picks, from `usePreviewBag`.
 */
export function PreviewPicker({ preview }: Readonly<{ preview: PreviewBagHandle }>) {
  const { quizzes, quiz_id, pickQuiz, ranked, question, pickQuestion } = preview
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}>
      <TextField
        select size="small" label="Preview quiz" value={quiz_id} sx={{ minWidth: 180 }}
        onChange={(event) => { pickQuiz(event.target.value) }}
      >
        {quizzes.map((held) => <MenuItem key={held._id} value={held._id}>{held.title || held.label}</MenuItem>)}
      </TextField>
      <TextField
        select size="small" label="Preview question" value={question?._id ?? ''} sx={{ minWidth: 220 }}
        disabled={ranked.length === 0}
        onChange={(event) => { pickQuestion(event.target.value) }}
      >
        {ranked.map((held) => <MenuItem key={held._id} value={held._id}>{`${held.qnum === '' ? '–' : held.qnum} · ${held.title || held.label}`}</MenuItem>)}
      </TextField>
    </Stack>
  )
}
