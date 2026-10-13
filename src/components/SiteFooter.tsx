import { Box, Link, Stack } from '@mui/material'
import NextLink from './NextLink'
import * as Routes from '../lib/routes'

/** Where a person writes to whoever runs Triquet: to ask a question, or to have their data deleted */
export const ContactAddress = 'info@triquet.me'

/** The app's own pages every page links, in the order the footer shows them */
const Pages = [
  { title: 'About',   href: Routes.aboutPath() },
  { title: 'Help',    href: Routes.helpPath() },
  { title: 'Privacy', href: Routes.privacyPath() },
  { title: 'Terms',   href: Routes.termsPath() },
] as const

/**
 * The strip across the foot of every page: About, Help, the privacy policy and the terms, and the address
 * to write to. It sits at the bottom of the window on a short page, and after the content on a long
 * one.
 */
export function SiteFooter() {
  return (
    <Box
      component="footer"
      sx={{ px: 'var(--gutter)', py: 1.5, borderTop: 1, borderColor: 'divider', typography: 'body2', color: 'text.secondary' }}
    >
      <Stack direction="row" component="nav" aria-label="About Triquet" useFlexGap sx={{ flexWrap: 'wrap', columnGap: 2, rowGap: 0.5 }}>
        {Pages.map(({ title, href }) => (
          <Link key={href} component={NextLink} href={href} color="inherit" underline="hover">{title}</Link>
        ))}
        <Link href={`mailto:${ContactAddress}`} color="inherit" underline="hover">{ContactAddress}</Link>
      </Stack>
    </Box>
  )
}
