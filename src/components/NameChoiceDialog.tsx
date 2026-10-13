'use client'

import { useId, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogContentText } from '@mui/material'
import { AppNotices, nameChoiceQuestion } from '../lib/notices'
import { useShown } from '../state/shown'
import { useUserActions } from '../state/use-user-actions'
import { ClosableTitle, ignoringBackdrop } from './ClosableTitle'
import styles from './workbench.module.css'

/**
 * The name choice a merge left the user who is looking, asked on whichever page they are on: this
 * browser was one handle, and the Google account it signed in to is another; keep which? Keeping
 * either settles it (`settle_name_choice`): the one not kept is retired, and no hunt's address
 * changes. Until it is settled, the Google account's handle stands; *Decide later* puts it off in
 * this tab, and it is asked again on the next page load. Settled in another tab, it goes from this
 * one too, and a second pending choice, if any, follows the first. Draws nothing while none is
 * pending.
 */
export function NameChoiceDialog() {
  const choice = useShown().user?.own?.nameChoice ?? null
  const { act, busy, notice } = useUserActions()
  // The handle of the choice put off in this tab, so that another one pending is still asked
  const [putOff, setPutOff] = useState<string | null>(null)
  const titleId = useId()
  if (choice === null || putOff === choice.merged.userlabel) { return null }
  const { merged, own } = choice
  const later = () => { setPutOff(merged.userlabel) }
  const keep = (userlabel: string) => { void act({ kind: 'settle_name_choice', merged: merged.userlabel, keep: userlabel }) }
  return (
    <Dialog open onClose={ignoringBackdrop(later)} aria-labelledby={titleId} maxWidth="xs" fullWidth>
      <ClosableTitle id={titleId} onClose={later} about={AppNotices.nameChoiceAbout}>{AppNotices.nameChoiceTitle}</ClosableTitle>
      <DialogContent>
        <DialogContentText>{nameChoiceQuestion(merged.userlabel, own.userlabel)}</DialogContentText>
        {notice !== null && <p className={styles.microcopy} role="alert">{notice}</p>}
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={later}>{AppNotices.nameChoiceLater}</Button>
        <Button variant="outlined" disabled={busy} onClick={() => { keep(merged.userlabel) }}>Keep {merged.userlabel}</Button>
        <Button variant="outlined" disabled={busy} onClick={() => { keep(own.userlabel) }}>Keep {own.userlabel}</Button>
      </DialogActions>
    </Dialog>
  )
}
