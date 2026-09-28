'use client'

import { Alert } from '@mui/material'
import styles from './workbench.module.css'

/**
 * What the page shows while it waits for the quizzes, or why they could not be opened.
 *
 * @param notice - Why the quizzes could not be opened; null while they are still on the way.
 * @param waiting - What to say while they are on the way.
 */
export function OpeningNotice({ notice, waiting = 'Opening your quizzes…' }: Readonly<{ notice: string | null, waiting?: string }>) {
  return (
    <main className={styles.page}>
      <p className={styles.microcopy}>{notice ?? waiting}</p>
    </main>
  )
}

/** What the page shows when this build was given no database to open: a mistake in deploying, never in using */
export function SyncUnconfigured() {
  return (
    <Alert severity="error">
      This build has no database: set NEXT_PUBLIC_CONVEX_URL.
    </Alert>
  )
}
