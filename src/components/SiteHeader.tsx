'use client'

import { AppBar, Box, Link, Toolbar } from '@mui/material'
import NextLink from './NextLink'
import { Logo } from './Logo'
import * as Routes from '../lib/routes'

/** The strip across the top of every page: the logo, which goes home, and the way to About */
export function SiteHeader() {
  return (
    <AppBar
      position="static" color="inherit" elevation={0}
      sx={{ bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar variant="dense" disableGutters sx={{ px: 'var(--gutter)', gap: 2 }}>
        <Link component={NextLink} href={Routes.rootPath()} sx={{ display: 'inline-flex' }}>
          <Logo height={28} />
        </Link>
        <Box sx={{ flex: 1 }} />
        <Link component={NextLink} href={Routes.aboutPath()} color="text.secondary" underline="hover" sx={{ py: 0.5 }}>About</Link>
      </Toolbar>
    </AppBar>
  )
}
