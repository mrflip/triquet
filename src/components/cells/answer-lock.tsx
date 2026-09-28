'use client'

import { useRef, useState } from 'react'
import { Button, Dialog, DialogActions, DialogTitle, IconButton, Stack, Typography } from '@mui/material'
import { AppNotices } from '../../lib/notices'

export type AnswerLockProps = {
  /** The full answer, hidden until the reviewer chooses to see it */
  answer:    string
  /** Whether the reviewer has revealed it before, here or in another session */
  seen?:     boolean
  /** Told the first time the answer is revealed, and not again however often it is hidden and shown */
  onReveal?: () => void
}

/**
 * The answer, behind a lock a reviewer opens on purpose: confirming once reveals it for this row
 * and this session, and a small lock beside it hides it again without asking, so the question can
 * be handed to someone else. Neither state is stored; `onReveal` hears of the first reveal, for
 * whoever wants to keep it, and a lock the reviewer has opened before says so.
 *
 * @param answer - What to reveal.
 * @param seen - Whether it has been revealed before.
 * @param onReveal - Told of the first reveal.
 */
export function AnswerLock({ answer, seen = false, onReveal }: Readonly<AnswerLockProps>) {
  const [revealed, setRevealed] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const told = useRef(false)

  if (revealed) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{answer}</Typography>
        <IconButton size="small" aria-label="Hide answer" onClick={() => { setRevealed(false) }}>🔓</IconButton>
      </Stack>
    )
  }

  const reveal = () => {
    setRevealed(true)
    setConfirming(false)
    if (told.current) { return }
    told.current = true
    onReveal?.()
  }
  return (
    <>
      <IconButton size="small" aria-label="Reveal answer" onClick={() => { setConfirming(true) }}>🔒</IconButton>
      {seen && <Typography component="span" variant="caption" color="text.secondary">{AppNotices.answerSeen}</Typography>}
      <Dialog open={confirming} onClose={() => { setConfirming(false) }} aria-labelledby="reveal-answer-title">
        <DialogTitle id="reveal-answer-title">Reveal the answer?</DialogTitle>
        <DialogActions>
          <Button onClick={() => { setConfirming(false) }}>Cancel</Button>
          <Button variant="contained" onClick={reveal}>Reveal</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
