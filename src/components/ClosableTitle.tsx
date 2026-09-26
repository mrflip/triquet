'use client'

import { DialogTitle, IconButton } from '@mui/material'

export type ClosableTitleProps = {
  id:       string
  onClose:  () => void
  children: React.ReactNode
}

/**
 * A dialog's title with a close button at its end, so a dialog can always be left by looking for it.
 *
 * @param id - The title's id, for the dialog to be named by.
 * @param onClose - Called when the button is pressed.
 */
export function ClosableTitle({ id, onClose, children }: Readonly<ClosableTitleProps>) {
  return (
    <DialogTitle id={id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <span style={{ flex: 1 }}>{children}</span>
      <IconButton size="small" aria-label="Close" onClick={onClose}>✕</IconButton>
    </DialogTitle>
  )
}

/**
 * What a dialog does when it is asked to close by something other than the person choosing to:
 * a click on the backdrop does nothing, so an edit in progress is not lost to a stray click.
 * Escape and the close button still close it.
 *
 * @param onClose - What closing does.
 * @returns A handler for the dialog's `onClose`.
 */
export function ignoringBackdrop(onClose: () => void): (event: object, reason: string) => void {
  return (_event, reason) => { if (reason !== 'backdropClick') { onClose() } }
}
