'use client'

import { useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, Divider, Stack, TextField, Typography } from '@mui/material'
import { ClosableTitle } from './ClosableTitle'

export type DangerousAct = {
  /** What the act is, on its button and its row: "Delete this quiz" */
  actname: string
  /** What happens, and what is lost */
  blurb:   string
  /** What must be typed to confirm it: the label of what is lost */
  confirm: string
  onAct:   () => void
}

/**
 * How wide the zone must be for an act's button to sit beside what it costs, rather than below,
 * as MUI's container-query shorthand. The zone measures itself, as it sits in a dialog.
 */
const RoomFor = { sideBySide: '@560' } as const

/**
 * The acts that cannot be undone, fenced off at the foot of a page in red, one row each: what the
 * act is and what it costs on the left, its button on the right. Each asks the person to type the
 * label of what they are about to lose before it goes ahead.
 */
export function DangerZone({ acts }: Readonly<{ acts: readonly DangerousAct[] }>) {
  const [confirming, setConfirming] = useState<DangerousAct | null>(null)
  return (
    <section aria-labelledby="danger-zone-title">
      <Typography id="danger-zone-title" variant="h6" component="h3" sx={{ mb: 1 }}>Danger Zone</Typography>
      <Box sx={{ border: 1, borderColor: 'error.main', borderRadius: 1, containerType: 'inline-size' }}>
        <Stack divider={<Divider sx={{ borderColor: 'error.light' }} />}>
          {acts.map((act) => (
            <Stack
              key={act.actname} useFlexGap spacing={2}
              sx={{ p: 2, flexDirection: { '@': 'column', [RoomFor.sideBySide]: 'row' }, alignItems: { [RoomFor.sideBySide]: 'center' } }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>{act.actname}</Typography>
                <Typography variant="body2" color="text.secondary">{act.blurb}</Typography>
              </Box>
              <Button
                variant="outlined" color="error" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={() => { setConfirming(act) }}
              >
                {act.actname}
              </Button>
            </Stack>
          ))}
        </Stack>
      </Box>
      {confirming && <ConfirmByTyping act={confirming} onClose={() => { setConfirming(null) }} />}
    </section>
  )
}

/** Asks for the label of what is about to be lost, and goes ahead only once it has been typed exactly */
function ConfirmByTyping({ act, onClose }: Readonly<{ act: DangerousAct, onClose: () => void }>) {
  const [typed, setTyped] = useState('')
  const matches = typed === act.confirm
  const goAhead = () => {
    if (! matches) { return }
    act.onAct()
    onClose()
  }
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="confirm-danger-title">
      <ClosableTitle id="confirm-danger-title" onClose={onClose}>{act.actname}?</ClosableTitle>
      <DialogContent>
        <Stack
          component="form" spacing={2}
          onSubmit={(event) => { event.preventDefault(); goAhead() }}
        >
          <Typography variant="body2">{act.blurb} This cannot be undone.</Typography>
          <TextField
            size="small" autoFocus fullWidth value={typed}
            label={`Type “${act.confirm}” to confirm`}
            onChange={(event) => { setTyped(event.target.value) }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" disabled={! matches} onClick={goAhead}>{act.actname}</Button>
      </DialogActions>
    </Dialog>
  )
}
