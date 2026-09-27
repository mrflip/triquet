'use client'

import { useEffect, useMemo, type ReactNode } from 'react'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { JazzProvider } from 'jazz-tools/react'
import { syncSettings } from '../db/sync-settings'
import { SyncFailed, SyncOpening, SyncSignedOut, SyncUnconfigured } from '../components/SyncNotices'
import { SyncLog, announceSync } from '../components/SyncLog'
import { theme } from './theme'

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SyncProvider>{children}</SyncProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  )
}

/**
 * The browser's Jazz database, opened under a local-first account: one made silently on first
 * visit and kept in this browser, with no login. Each view it can show logs the session's
 * state as it changes.
 */
function SyncProvider({ children }: Readonly<{ children: ReactNode }>) {
  const settings = useMemo(() => syncSettings(), [])
  useEffect(() => {
    if (settings) { announceSync(settings) }
  }, [settings])
  if (! settings) { return <SyncUnconfigured /> }
  return (
    <JazzProvider
      {...settings}
      initial="local-first"
      loading={<><SyncLog /><SyncOpening /></>}
      signedOut={<><SyncLog /><SyncSignedOut /></>}
      error={(state) => <><SyncLog /><SyncFailed onRetry={() => { void state.retry() }} /></>}
    >
      <SyncLog />
      {children}
    </JazzProvider>
  )
}
