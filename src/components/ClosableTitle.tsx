'use client'

import { DialogTitle, IconButton } from '@mui/material'
import { InfoTip } from './InfoTip'

export type ClosableTitleProps = {
  id:       string
  onClose:  () => void
  /** What the dialog is and does, behind an (i) after its title (`InfoTip`, its topic the title) */
  about?:   React.ReactNode
  children: React.ReactNode
}

/**
 * A dialog's title with a close button at its end, so a dialog can always be left by looking for it.
 *
 * @param id - The title's id, for the dialog to be named by.
 * @param onClose - Called when the button is pressed.
 * @param about - What the dialog is, behind an (i) after its title, if it needs saying.
 */
export function ClosableTitle({ id, onClose, about, children }: Readonly<ClosableTitleProps>) {
  return (
    <DialogTitle id={id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <span>{children}</span>
      {about === undefined ? null : <InfoTip topic={typeof children === 'string' ? `the ${children.toLowerCase()}` : 'this dialog'}>{about}</InfoTip>}
      <span style={{ flex: 1 }} />
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
