import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import styles from './workbench.module.css'

/**
 * A page of prose, as About, Privacy and Terms are: its title as the page's one heading, then what
 * is written on it, most often markdown from `src/content`, set in a column a reader can follow.
 *
 * @param title - The page's heading.
 * @param children - What the page says.
 */
export function ProsePage({ title, children }: Readonly<{ title: string, children: ReactNode }>) {
  return (
    <Box component="main" className={styles.page} sx={{ maxWidth: 880, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>{title}</Typography>
      {children}
    </Box>
  )
}
