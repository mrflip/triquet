import type { ReactNode } from 'react'
import { SyncProvider } from '../providers'
import { ShowUser } from '../../components/ShowUser'

/**
 * The pages that work on hunts and quizzes, and so connect to the database, telling the header's
 * user menu who is looking. Pages outside this group, like About, show at once and never touch
 * it.
 */
export default function SyncedLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SyncProvider>
      <ShowUser />
      {children}
    </SyncProvider>
  )
}
