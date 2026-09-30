'use client'

import { useState } from 'react'
import { Alert, AlertTitle, Snackbar, Typography } from '@mui/material'
import type { AlarmT } from '../lib/alarms'
import { useAlarm } from '../state/alarms'

/**
 * The page's alarm, raised by `useRaiseAlarm`: a filled error alert fixed to the foot of the
 * window, so it is on screen however far the page is scrolled from whatever failed, and over any
 * dialog. It stays until its close button is pressed: no timer takes it down, and neither does a
 * click elsewhere or Escape, which an author typing into the grid presses without looking up.
 * It says what failed, why, and the request to send us when the server kept the reason to itself.
 */
export function AlarmSnackbar() {
  const { alarm, dismiss } = useAlarm()
  // The alarm last raised, still said while the snackbar slides away after it is dismissed.
  const [shown, setShown] = useState<AlarmT | null>(alarm)
  if (alarm !== null && alarm !== shown) { setShown(alarm) }

  return (
    <Snackbar open={alarm !== null} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity="error" variant="filled" onClose={dismiss} sx={{ width: '100%', maxWidth: 640, boxShadow: 6 }}>
        <AlertTitle>{shown?.headline}</AlertTitle>
        {shown?.notice}
        {shown?.request_id ? <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>Request {shown.request_id}</Typography> : null}
      </Alert>
    </Snackbar>
  )
}
