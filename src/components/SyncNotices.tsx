'use client'

import { Alert, Box, Button, LinearProgress, Stack } from '@mui/material'
import { AppNotices } from '../lib/notices'
import { CopyButton } from './CopyButton'
import styles from './workbench.module.css'

/** Where Chrome lists the shared workers, the one after a deploy included. A page cannot link there, only show it. */
const WorkersAddress = 'chrome://inspect/#workers'

/**
 * What to try when the quizzes would not open because another tab's Jazz worker holds this
 * browser's database: close that tab, or end its worker. The address is shown to copy, since a
 * page may not open a `chrome://` address.
 */
export function OtherWorkersHelp() {
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <span>{AppNotices.otherWorkers}</span>
      <Box component="code" sx={{ userSelect: 'all' }}>{WorkersAddress}</Box>
      <CopyButton textOf={() => WorkersAddress}>Copy address</CopyButton>
    </Stack>
  )
}

/**
 * What the page shows while it waits for the quizzes, or why they would not open, with what to
 * try when it was the opening that failed.
 *
 * @param notice - Why the quizzes could not be opened; null while they are still on the way.
 */
export function OpeningNotice({ notice }: Readonly<{ notice: string | null }>) {
  return (
    <main className={styles.page}>
      <p className={styles.microcopy}>{notice ?? 'Opening your quizzes…'}</p>
      {notice === AppNotices.loadFailed ? <OtherWorkersHelp /> : null}
    </main>
  )
}

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
      <OtherWorkersHelp />
    </Alert>
  )
}

/** What the page shows when the browser's Jazz database opened with no account to open it as */
export function SyncSignedOut() {
  return (
    <Alert severity="error">
      Your quizzes could not be opened: this browser has no account for them.
      <OtherWorkersHelp />
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
