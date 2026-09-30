'use client'

import { useRef, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogTitle, IconButton, Stack, Typography } from '@mui/material'
import { MarkdownText } from './markdown'
import { AppNotices } from '../../lib/notices'
import styles from '../workbench.module.css'

export type AnswerLockProps = {
  /** The full answer, hidden until the reviewer chooses to see it */
  answer:    string
  /** Whether the reviewer has revealed it before, here or in another session */
  seen?:     boolean
  /** Told the first time the answer is revealed, and not again however often it is hidden and shown */
  onReveal?: () => void
}

/** The padding around the lock, the same in either state, so the lock stays put as the answer comes and goes */
const LockSx = { p: 0.5, minWidth: 0 } as const

/**
 * The answer, behind a lock a reviewer opens on purpose: confirming once reveals it, rendered from its markdown, for this row
 * and this session, and the lock beside it hides it again without asking, so the question can
 * be handed to someone else. The lock sits first and the answer to its right, so it stays put
 * either way. Neither state is stored; `onReveal` hears of the first reveal, for whoever wants
 * to keep it, and a lock the reviewer has opened before says so.
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
        <IconButton size="small" aria-label="Hide answer" sx={LockSx} onClick={() => { setRevealed(false) }}><LockGlyph glyph="🔓" /></IconButton>
        <Typography component="div" className={styles.prose} sx={{ pt: 0.5, minWidth: 0 }}><MarkdownText text={answer} /></Typography>
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
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
      <Button
        color="inherit"
        onClick={() => { setConfirming(true) }}
        sx={{ ...LockSx, gap: 1, textTransform: 'none', fontWeight: 'normal', color: 'text.secondary' }}
      >
        <LockGlyph glyph="🔒" />{AppNotices.answerLocked}
      </Button>
      {seen && <Typography component="span" variant="caption" color="text.secondary">{AppNotices.answerSeen}</Typography>}
      <Dialog open={confirming} onClose={() => { setConfirming(false) }} aria-labelledby="reveal-answer-title">
        <DialogTitle id="reveal-answer-title">Reveal the answer?</DialogTitle>
        <DialogActions>
          <Button onClick={() => { setConfirming(false) }}>Cancel</Button>
          <Button variant="contained" onClick={reveal}>Reveal</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

/** The lock itself, drawn the same size inside either of the buttons that carry it */
function LockGlyph({ glyph }: Readonly<{ glyph: string }>) {
  return <Box component="span" aria-hidden sx={{ display: 'inline-flex', alignItems: 'center', height: 24, fontSize: '1.125rem' }}>{glyph}</Box>
}
