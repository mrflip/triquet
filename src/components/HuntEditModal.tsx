'use client'

import { useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, Stack, TextField } from '@mui/material'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import * as Labelmaker from '../lib/labelmaker'
import { AppNotices, RefusalNotices } from '../lib/notices'
import type { ListedHuntT } from '../lib/rows'
import type { OuterHuntActionDNA } from '../models/actions'
import { HuntValidators } from '../models/hunt'
import { useOuterHuntActions } from '../state/use-outer-hunt-actions'
import { ClosableTitle, ignoringBackdrop } from './ClosableTitle'
import { GoogleSignInOffer } from './GoogleSignIn'
import { SealedNotice } from './StandaloneAccount'
import styles from './workbench.module.css'

export type HuntEditModalProps = {
  /** The hunt, as the hunts list holds it; the visitor is its smith */
  hunt:        ListedHuntT
  /** Whether the visitor may relabel it (`Approve.mayOffer('relabel_hunt')`): not an anonymous smith, whose sandbox's label is its handle */
  relabelable: boolean
  onClose:     () => void
}

/**
 * The hunts list's gear: a hunt's title, what it is called on screen, and its label, which the
 * address of every quiz in it names it by. Mount it only while it is open, so it starts from the
 * hunt as it is now. Saving closes it once both have landed, and keeps it open, saying why, when
 * the server refuses one (a label another hunt answers to). A smith who may not relabel the hunt
 * (an anonymous one, in its sandbox) is shown no label to change, and told why, with signing in with
 * Google offered.
 */
export function HuntEditModal({ hunt, relabelable, onClose }: Readonly<HuntEditModalProps>) {
  const huntLabel = hunt.label
  const { act, busy, notice } = useOuterHuntActions()
  const [titleDraft, setTitleDraft] = useState(hunt.title)
  const [labelDraft, setLabelDraft] = useState(huntLabel)
  const [titleIssue, setTitleIssue] = useState<string | null>(null)
  const [labelIssue, setLabelIssue] = useState<string | null>(null)
  const title = titleDraft.trim()
  const label = Labelmaker.normalize(labelDraft)
  const unchanged = title === hunt.title && label === huntLabel

  const onSave = async () => {
    const titleOk = HuntValidators.row.shape.title.safeParse(title).success
    const labelOk = label === huntLabel || HuntValidators.newLabel.safeParse(label).success
    setTitleIssue(titleOk ? null : AppNotices.huntTitleTooLong)
    const labelRefusal = Labelmaker.isReserved(label, { toplevel: true }) ? AppNotices.labelReserved : AppNotices.huntLabelShape
    setLabelIssue(labelOk ? null : labelRefusal)
    if (! (titleOk && labelOk)) { return }
    // The label goes first, as the one the server may refuse; the title then waits for a retry.
    const changes: OuterHuntActionDNA[] = [
      ...(label === huntLabel ? [] : [{ kind: 'relabel_hunt', hunt_id: hunt._id, label } as const]),
      ...(title === hunt.title ? [] : [{ kind: 'retitle_hunt', hunt_id: hunt._id, title } as const]),
    ]
    for (const change of changes) {
      const outcome = await act(change)
      if (! outcome.kept) { return }
    }
    onClose()
  }

  return (
    <Dialog
      open
      onClose={ignoringBackdrop(onClose)}
      fullWidth
      maxWidth="sm"
      aria-labelledby="edit-hunt-title"
      slotProps={{ paper: { component: 'form', onSubmit: (event: React.SyntheticEvent) => { event.preventDefault(); void onSave() } } }}
    >
      <ClosableTitle id="edit-hunt-title" onClose={onClose}>Edit hunt</ClosableTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Name"
            value={titleDraft}
            size="small"
            autoFocus
            error={titleIssue !== null}
            helperText={titleIssue ?? 'What the hunt is called on screen.'}
            onChange={(event) => { setTitleDraft(event.target.value); setTitleIssue(null) }}
          />
          {relabelable
            ? (
              <TextField
                label="Label"
                value={labelDraft}
                size="small"
                error={labelIssue !== null}
                helperText={labelIssue ?? <RelabelWarning />}
                onChange={(event) => { setLabelDraft(event.target.value); setLabelIssue(null) }}
              />
            )
            : (
              <Stack spacing={1}>
                <SealedNotice notice={RefusalNotices.sealedRelabel} />
                <GoogleSignInOffer />
              </Stack>
            )}
          {notice !== null && <p className={styles.microcopy} role="alert">{notice}</p>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={busy || unchanged}>Save</Button>
      </DialogActions>
    </Dialog>
  )
}

/** Beneath the label: a relabel moves the address of every quiz in the hunt. The icon and colour are MUI's own for a warning, as its Alert shows one. */
function RelabelWarning() {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <ReportProblemOutlinedIcon color="warning" fontSize="small" aria-hidden />
      {AppNotices.huntRelabelMoves}
    </Box>
  )
}
