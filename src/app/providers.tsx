'use client'

import { useState, type ReactNode } from 'react'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { ConvexReactClient } from 'convex/react'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { AlarmSnackbar } from '../components/AlarmSnackbar'
import { SyncUnconfigured } from '../components/SyncNotices'
import { AlarmsProvider } from '../state/alarms'
import { ShownProvider } from '../state/shown'
import { convexUrl } from '../state/convex-url'
import { theme } from './theme'

/**
 * MUI's styling and theme, which everything on the page draws in, the header included; the
 * page's one alarm, which any screen can raise a failure to (`useRaiseAlarm`); and what the page
 * shows the header, which only the page knows: the hunt and quiz it is about (`useShown`).
 */
export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AlarmsProvider>
          <ShownProvider>
            {children}
          </ShownProvider>
          <AlarmSnackbar />
        </AlarmsProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  )
}

/**
 * The page's connection to its Convex deployment, which every hunt and quiz is read from and
 * written to, with the browser's session (Convex Auth): signed in anonymously on its first visit
 * (`useSession`) and kept in this browser's storage, so that it is the same visitor next time.
 */
export function SyncProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [client] = useState(() => {
    const url = convexUrl()
    return url === undefined ? null : new ConvexReactClient(url)
  })
  if (client === null) { return <SyncUnconfigured /> }
  return (
    <ConvexAuthProvider client={client}>
      {children}
    </ConvexAuthProvider>
  )
}
