'use client'

import { Alert, Button, LinearProgress } from '@mui/material'

/** What the page shows while the browser's Jazz database opens, before anything can read from it */
export function SyncOpening() {
  return <LinearProgress aria-label="Opening your quizzes" />
}

/**
 * What the page shows when the browser's Jazz database would not open.
 *
 * @param onRetry - Tries to open it again.
 */
export function SyncFailed({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <Alert
      severity="error"
      action={<Button color="inherit" size="small" onClick={onRetry}>Try again</Button>}
    >
      Your quizzes could not be opened.
    </Alert>
  )
}

/** What the page shows when the browser's Jazz database opened with no account to open it as */
export function SyncSignedOut() {
  return (
    <Alert severity="error">
      Your quizzes could not be opened: this browser has no account for them.
    </Alert>
  )
}

/** What the page shows when this build was given nowhere to sync to: a mistake in deploying, never in using */
export function SyncUnconfigured() {
  return (
    <Alert severity="error">
      This build has no sync server: set NEXT_PUBLIC_JAZZ_APP_ID and NEXT_PUBLIC_JAZZ_SERVER_URL.
    </Alert>
  )
}
