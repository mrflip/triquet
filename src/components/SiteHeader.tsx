'use client'

import { usePathname } from 'next/navigation'
import { AppBar, Box, Breadcrumbs, Link, Toolbar } from '@mui/material'
import NextLink from './NextLink'
import { Logo } from './Logo'
import * as Routes from '../lib/routes'
import { useShownHunt } from '../state/shown-hunt'

/**
 * The strip across the top of every page: the logo, which goes home; after it, on a page about a
 * hunt, the hunt's title, which goes to the hunt's own page; and the way to About.
 */
export function SiteHeader() {
  const hunt = useShownHunt()
  const pathname = usePathname()
  const huntPath = hunt === null ? null : Routes.huntPath(hunt.label)
  return (
    <AppBar
      position="static" color="inherit" elevation={0}
      sx={{ bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar variant="dense" disableGutters sx={{ px: 'var(--gutter)', gap: 2 }}>
        <Breadcrumbs aria-label="Where you are" sx={{ minWidth: 0, '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' }, '& .MuiBreadcrumbs-li': { minWidth: 0 } }}>
          <Link component={NextLink} href={Routes.rootPath()} sx={{ display: 'inline-flex' }}>
            <Logo height={28} />
          </Link>
          {hunt !== null && huntPath !== null && (
            <Link
              component={NextLink}
              href={huntPath}
              color="text.primary"
              underline="hover"
              aria-current={pathname === huntPath ? 'page' : undefined}
              sx={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {hunt.title}
            </Link>
          )}
        </Breadcrumbs>
        <Box sx={{ flex: 1 }} />
        <Link component={NextLink} href={Routes.aboutPath()} color="text.secondary" underline="hover" sx={{ py: 0.5 }}>About</Link>
      </Toolbar>
    </AppBar>
  )
}
