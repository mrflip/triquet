'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuthActions, useConvexAuth, type ConvexAuthActionsContext } from '@convex-dev/auth/react'
import * as Postmortem from '../lib/postmortem'
import * as Routes from '../lib/routes'

export type SessionHandle = {
  /** Whether this browser is signed in, and the server has accepted its session: until then, nothing asks the server who it is */
  ready: boolean
}

/** The anonymous sign-in on its way, so that every screen asking at once starts only one */
const SigningIn: { pending: Promise<boolean> | null } = { pending: null }

/** How long to wait before trying a failed sign-in again */
const RetryMs = 3000

/**
 * This browser's session: signed in anonymously the first time a screen asks and there is none,
 * and kept from then on (Convex Auth holds it in this browser's storage). A session says nothing
 * of who the visitor is; that is the userlabel its user takes (`useMe`).
 *
 * It never signs in while Convex Auth is still loading, which it is while a browser back from
 * Google exchanges the `?code=` in its address: that exchange is the session it comes back to.
 *
 * A sign-in that fails is reported, and tried again a few seconds later while a screen still asks.
 *
 * @returns Whether the session is ready.
 */
export function useSession(): SessionHandle {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { signIn } = useAuthActions()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (isLoading || isAuthenticated || SigningIn.pending !== null) { return }
    const signing = signInAnonymously(signIn)
    SigningIn.pending = signing
    const pending: { timer: ReturnType<typeof setTimeout> | null, live: boolean } = { timer: null, live: true }
    void signing.then((signedIn) => {
      if (signedIn || ! pending.live) { return }
      pending.timer = setTimeout(() => { setAttempt((count) => count + 1) }, RetryMs)
    })
    return () => {
      pending.live = false
      if (pending.timer !== null) { clearTimeout(pending.timer) }
    }
  }, [isLoading, isAuthenticated, signIn, attempt])

  return { ready: isAuthenticated }
}

/**
 * How to sign this browser out: its session ends (Convex Auth's sign out, which deletes it on the
 * server and forgets it here), and the browser starts afresh at the front door, where `useSession`
 * signs it in anonymously, a new user holding no handle. A whole new page rather than a move within
 * the app, so that nothing the app held of the user signed out outlives it. What else the browser
 * keeps (the hunt histories) stays.
 *
 * @returns Sign out.
 */
export function useSignOut(): () => Promise<void> {
  const { signOut } = useAuthActions()
  return useCallback(async () => {
    await signOut()
    location.assign(Routes.rootPath())
  }, [signOut])
}

/** Sign in anonymously, reporting a failure rather than throwing it; whether it worked */
async function signInAnonymously(signIn: ConvexAuthActionsContext['signIn']): Promise<boolean> {
  try {
    await signIn('anonymous')
    return true
  } catch (err) {
    Postmortem.report('sign this browser in', err)
    return false
  } finally {
    SigningIn.pending = null
  }
}
