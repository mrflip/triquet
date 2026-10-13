import type { ReactNode } from 'react'
import { SyncProvider } from '../providers'
import { NameChoiceDialog } from '../../components/NameChoiceDialog'
import { ShowUser } from '../../components/ShowUser'

/**
 * The pages that work on hunts and quizzes, and so connect to the database, telling the header's
 * user menu who is looking, and asking the name choice a merge left them, on whichever page they
 * are. Pages outside this group, like About, show at once and never touch it.
 */
export default function SyncedLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SyncProvider>
      <ShowUser />
      <NameChoiceDialog />
      {children}
    </SyncProvider>
  )
}
