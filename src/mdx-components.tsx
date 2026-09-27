import type { MDXComponents } from 'mdx/types'
import { Box, Typography } from '@mui/material'

/**
 * How the markdown under `src/content` is dressed: its paragraphs and code blocks as the rest of
 * the app sets them, so a page written in plain markdown still looks like the tool around it.
 */
const components: MDXComponents = {
  p:   ({ children }) => <Typography variant="body2" sx={{ mb: 1.5 }}>{children}</Typography>,
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
