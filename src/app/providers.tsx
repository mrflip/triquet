'use client'

import { useState, type ReactNode } from 'react'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { SyncUnconfigured } from '../components/SyncNotices'
import { SyncLog } from '../components/SyncLog'
import { convexUrl } from '../state/convex-url'
import { theme } from './theme'

/** MUI's styling and theme, which everything on the page draws in, the header included */
export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  )
}

/**
 * The page's connection to its Convex deployment, which every hunt and quiz is read from and
 * written to. There is no account and no login: a browser says who it is by a key it keeps.
 */
export function SyncProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [client] = useState(() => {
    const url = convexUrl()
    return url === undefined ? null : new ConvexReactClient(url)
  })
  if (client === null) { return <SyncUnconfigured /> }
  return (
    <ConvexProvider client={client}>
      <SyncLog />
      {children}
    </ConvexProvider>
  )
}
