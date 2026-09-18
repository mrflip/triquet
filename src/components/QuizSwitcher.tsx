'use client'

import { useState } from 'react'
import { Button, Stack } from '@mui/material'
import clsx from 'clsx'
import { AppNotices } from '../lib/notices'
import type { QuizT } from '../models/quiz'
import styles from './workbench.module.css'

export type QuizSwitcherProps = {
  quizzes:    readonly QuizT[]
  openQuiz:   QuizT
  onOpen:     (quiz_id: string) => void
  onNew:      () => void
  onDelete:   (quiz_id: string) => void
  onSetLock:  (locked: boolean) => void
}

/**
 * Every round this browser holds, and what can be done to the set of them.
 *
 * None of these is blocked by a lock: switching away, making another round, deleting one and
 * unlocking all stay available, because locking a round must never be a trap.
 */
export function QuizSwitcher({ quizzes, openQuiz, onOpen, onNew, onDelete, onSetLock }: Readonly<QuizSwitcherProps>) {
  const [confirming, setConfirming] = useState(false)
  const isLast = quizzes.length <= 1

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
      <select
        className={clsx(styles.field, styles.fieldData)}
        style={{ width: 'auto', minWidth: 220 }}
        aria-label="Open round"
        value={openQuiz.id}
        onChange={(event) => { onOpen(event.target.value) }}
      >
        {quizzes.map((quiz) => (
          <option key={quiz.id} value={quiz.id}>
            {quiz.locked ? '🔒 ' : ''}{quiz.title === '' ? AppNotices.untitledQuiz : quiz.title}
          </option>
        ))}
      </select>

      <Button size="small" variant="outlined" onClick={onNew}>+ New quiz</Button>

      {confirming ? (
        <>
          <span className={styles.microcopy}>
            Delete &ldquo;{openQuiz.title === '' ? AppNotices.untitledQuiz : openQuiz.title}&rdquo;?
          </span>
          <Button
            size="small" variant="contained" color="error"
            onClick={() => {
              onDelete(openQuiz.id)
              setConfirming(false)
            }}
          >
            Yes
          </Button>
          <Button size="small" variant="outlined" onClick={() => { setConfirming(false) }}>Cancel</Button>
        </>
      ) : (
        <Button
          size="small" variant="outlined" disabled={isLast}
          title={isLast ? 'The last round cannot be deleted' : undefined}
          onClick={() => { setConfirming(true) }}
        >
          Delete quiz
        </Button>
      )}

      <span style={{ flex: 1 }} />

      <Button size="small" variant={openQuiz.locked ? 'contained' : 'outlined'} onClick={() => { onSetLock(! openQuiz.locked) }}>
        {openQuiz.locked ? 'Unlock round' : 'Lock round'}
      </Button>
    </Stack>
  )
}
