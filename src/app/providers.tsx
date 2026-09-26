'use client'

import type { ReactNode } from 'react'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { JazzProvider } from 'jazz-tools/react'
import { syncSettings } from '../db/sync-settings'
import { SyncFailed, SyncOpening, SyncUnconfigured } from '../components/SyncNotices'
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
 * visit and kept in this browser, with no login.
 */
function SyncProvider({ children }: Readonly<{ children: ReactNode }>) {
  const settings = syncSettings()
  if (! settings) { return <SyncUnconfigured /> }
  return (
    <JazzProvider
      {...settings}
      initial="local-first"
      loading={<SyncOpening />}
      error={(state) => <SyncFailed onRetry={() => { void state.retry() }} />}
    >
      {children}
    </JazzProvider>
  )
}
