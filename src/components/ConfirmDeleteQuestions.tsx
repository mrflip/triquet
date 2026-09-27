'use client'

import { useRef } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, List, ListItem, ListItemText } from '@mui/material'
import type { QuestionT } from '../models/question'

/** How many of the doomed questions are named before the rest are only counted */
const NamedQty = 8

export type ConfirmDeleteQuestionsProps = {
  /** The questions to delete, in the grid's order; at least one */
  doomed:    readonly QuestionT[]
  onConfirm: () => void
  onClose:   () => void
}

/**
 * Asks before questions are deleted, naming them and saying what goes with them. Keeping them
 * is what the dialog opens on, so a stray Enter deletes nothing.
 *
 * @param doomed - What would be deleted.
 * @param onConfirm - Called only on the delete.
 * @param onClose - Called on keeping them, Escape, or a click away.
 */
export function ConfirmDeleteQuestions({ doomed, onConfirm, onClose }: Readonly<ConfirmDeleteQuestionsProps>) {
  const keepRef = useRef<HTMLButtonElement>(null)
  const single = doomed.length === 1
  const unnamed = doomed.length - NamedQty
  return (
    <Dialog
      open onClose={onClose} aria-labelledby="delete-questions-title" aria-describedby="delete-questions-consequence"
      slotProps={{ transition: { onEntering: () => { keepRef.current?.focus() } } }}
    >
      <DialogTitle id="delete-questions-title">{single ? 'Delete this question?' : `Delete ${String(doomed.length)} questions?`}</DialogTitle>
      <DialogContent>
        <List dense disablePadding>
          {doomed.slice(0, NamedQty).map((question) => (
            <ListItem key={question.id} disableGutters>
              <ListItemText primary={question.title || question.label} secondary={question.qnum === '' ? null : `Q# ${question.qnum}`} />
            </ListItem>
          ))}
          {unnamed > 0 && <ListItem disableGutters><ListItemText secondary={`and ${String(unnamed)} more`} /></ListItem>}
        </List>
        <DialogContentText id="delete-questions-consequence">
          {single ? 'Its players’ replies go with it, and a chain to it is cleared.' : 'Their players’ replies go with them, and a chain to any of them is cleared.'}
          {' '}There is no undo.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button ref={keepRef} onClick={onClose}>{single ? 'Keep it' : 'Keep them'}</Button>
        <Button color="error" variant="contained" onClick={onConfirm}>Delete</Button>
      </DialogActions>
    </Dialog>
  )
}
