'use client'

import { useEffect, useMemo } from 'react'
import { Alert, AlertTitle, Button, Stack, Typography } from '@mui/material'
import * as Postmortem from '../lib/postmortem'
import { AppNotices } from '../lib/notices'
import styles from './workbench.module.css'

export type PageFailedProps = {
  /** What the page threw as it drew itself: most often a read the server could not answer */
  error:  Error & { digest?: string }
  /** Draw the page again, reading afresh */
  retry:  () => void
}

/** The failures already sent to the console, so each goes once, however often React mounts its page (StrictMode, under the dev server, mounts it twice) */
const Reported = new WeakSet<Error>()

/**
 * What a page that failed to draw shows in its place: that it failed, what the failure says
 * (the reason, or the request to look up when the server keeps it to itself), and a way to try
 * again. The whole of it goes to the console as well, once.
 */
export function PageFailed({ error, retry }: Readonly<PageFailedProps>) {
  const postmortem = useMemo(() => Postmortem.of(error), [error])
  useEffect(() => {
    if (Reported.has(error)) { return }
    Reported.add(error)
    Postmortem.report('show this page', error, { page: location.pathname, digest: error.digest ?? null })
  }, [error])

  return (
    <main className={styles.page}>
      <Alert severity="error" sx={{ maxWidth: 760, mx: 'auto' }}>
        <AlertTitle>{AppNotices.pageFailed}</AlertTitle>
        <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
          <Typography variant="body2">{postmortem.summary}</Typography>
          {postmortem.request_id !== null && <Typography variant="caption">Request {postmortem.request_id}{postmortem.fnpath === null ? '' : ` · ${postmortem.fnpath}`}</Typography>}
          <Button variant="outlined" size="small" onClick={retry}>Try again</Button>
        </Stack>
      </Alert>
    </main>
  )
}
