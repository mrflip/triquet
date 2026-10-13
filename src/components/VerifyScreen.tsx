'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import * as Actor from '../lib/actor'
import { AppNotices } from '../lib/notices'
import * as Routes from '../lib/routes'
import { useMe } from '../state/use-me'
import { StandaloneAccountPanel } from './StandaloneAccount'
import { OpeningNotice } from './SyncNotices'
import styles from './workbench.module.css'

/**
 * Verifying an account, where a standalone account's *Verify your account* leads: a visitor with a
 * standalone account is told it has limits, and offered a verified account under the same handle
 * (`StandaloneAccountPanel`), which comes back here. Everyone else is
 * sent on at once: a visitor signed in with Google to where the address's `then` points, or to
 * their profile; one holding no handle yet to the front door, which offers both ways in, and sends
 * them on after.
 */
export function VerifyScreen() {
  const router = useRouter()
  const params = useSearchParams()
  const onward = Routes.thenFrom(params.get('then')) ?? Routes.profilePath()
  const { user, actor, loaded } = useMe()
  const sealed = Actor.isSealed(actor)

  useEffect(() => {
    if (! loaded) { return }
    if (user === null) {
      router.replace(Routes.rootPath(onward))
    } else if (! sealed) {
      router.replace(onward)
    }
  }, [loaded, user, sealed, onward, router])

  if (! loaded || user === null || ! sealed) {
    return <OpeningNotice notice={null} waiting={AppNotices.opening} />
  }
  return (
    <main className={styles.page}>
      <StandaloneAccountPanel userlabel={user.userlabel} />
    </main>
  )
}
