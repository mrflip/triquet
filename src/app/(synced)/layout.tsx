import type { ReactNode } from 'react'
import { SyncProvider } from '../providers'

/**
 * The pages that work on hunts and quizzes, and so connect to the database. Pages outside this
 * group, like About, show at once and never touch it.
 */
export default function SyncedLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SyncProvider>{children}</SyncProvider>
}
