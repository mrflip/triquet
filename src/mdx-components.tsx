import type { ReactNode } from 'react'
import type { MDXComponents } from 'mdx/types'
import { Box, Link, Typography } from '@mui/material'
import NextLink from './components/NextLink'

/**
 * How the markdown under `src/content` is dressed: its headings, paragraphs, lists, links and code
 * blocks as the rest of the app sets them, so a page written in plain markdown still looks like the
 * tool around it. A link to one of the app's own pages (`/privacy`) goes there as the app's other
 * links do, without loading the page afresh.
 */
const components: MDXComponents = {
  h2:  ({ children }) => <Typography variant="h6" component="h2" sx={{ mt: 3, mb: 1 }}>{children}</Typography>,
  h3:  ({ children }) => <Typography variant="subtitle1" component="h3" sx={{ mt: 2, mb: 0.5, fontWeight: 600 }}>{children}</Typography>,
  p:   ({ children }) => <Typography variant="body2" sx={{ mb: 1.5 }}>{children}</Typography>,
  ul:  ({ children }) => <Box component="ul" sx={{ mt: 0, mb: 1.5, pl: 3 }}>{children}</Box>,
  ol:  ({ children }) => <Box component="ol" sx={{ mt: 0, mb: 1.5, pl: 3 }}>{children}</Box>,
  li:  ({ children }) => <Typography variant="body2" component="li" sx={{ mb: 0.5 }}>{children}</Typography>,
  a:   ({ href, children }: Readonly<{ href?: string, children?: ReactNode }>) => (
    href?.startsWith('/')
      ? <Link component={NextLink} href={href}>{children}</Link>
      : <Link href={href}>{children}</Link>
  ),
  pre: ({ children }) => (
    <Box
      component="pre"
      sx={{ m: 0, p: 1.5, overflowX: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.8125rem', borderRadius: 1, bgcolor: 'action.hover' }}
    >
      {children}
    </Box>
  ),
}

/** The components Next.js hands every markdown file it compiles; required by `@next/mdx` in the App Router */
export function useMDXComponents(): MDXComponents {
  return components
}
