'use client'

import { Button, Select, Stack } from '@mui/material'
import { AppNotices } from '../lib/notices'
import type { QuizT } from '../models/quiz'

export type QuizSwitcherProps = {
  /** The quizzes of the open quiz's realm */
  quizzes:    readonly Pick<QuizT, '_id' | 'title' | 'locked'>[]
  openQuiz:   QuizT
  onOpen:     (quiz_id: string) => void
  onNew:      () => void
  onSetLock:  (locked: boolean) => void
}

/**
 * Every quiz this browser holds, and what can be done to the set of them. Deleting one is the
 * gear's, in its danger zone.
 *
 * None of these is blocked by a lock: switching away, making another quiz and unlocking all stay
 * available, because locking a quiz must never be a trap.
 */
export function QuizSwitcher({ quizzes, openQuiz, onOpen, onNew, onSetLock }: Readonly<QuizSwitcherProps>) {

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
      <Select
        native
        size="small"
        value={openQuiz._id}
        onChange={(event) => { onOpen(event.target.value) }}
        inputProps={{ 'aria-label': 'Open quiz' }}
        sx={{ minWidth: 220, fontFamily: 'var(--font-data)', fontSize: 12 }}
      >
        {quizzes.map((quiz) => (
          <option key={quiz._id} value={quiz._id}>
            {quiz.locked ? '🔒 ' : ''}{quiz.title === '' ? AppNotices.untitledQuiz : quiz.title}
          </option>
        ))}
      </Select>

      <Button size="small" variant="outlined" onClick={onNew}>+ New quiz</Button>

      <span style={{ flex: 1 }} />

      <Button size="small" variant={openQuiz.locked ? 'contained' : 'outlined'} onClick={() => { onSetLock(! openQuiz.locked) }}>
        {openQuiz.locked ? 'Unlock quiz' : 'Lock quiz'}
      </Button>
    </Stack>
  )
}
