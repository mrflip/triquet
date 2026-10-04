'use client'

import { useEffect } from 'react'
import { useAuthActions, useConvexAuth, type ConvexAuthActionsContext } from '@convex-dev/auth/react'
import * as Postmortem from '../lib/postmortem'

export type SessionHandle = {
  /** Whether this browser is signed in, and the server has accepted its session: until then, nothing asks the server who it is */
  ready: boolean
}

/** The anonymous sign-in on its way, so that every screen asking at once starts only one */
const SigningIn: { pending: Promise<unknown> | null } = { pending: null }

/**
 * This browser's session: signed in anonymously the first time a screen asks and there is none,
 * and kept from then on (Convex Auth holds it in this browser's storage). A session says nothing
 * of who the visitor is; that is the username it asserts (`useIdent`).
 *
 * A sign-in that fails is reported, and tried again the next time a screen asks.
 *
 * @returns Whether the session is ready.
 */
export function useSession(): SessionHandle {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { signIn } = useAuthActions()

  useEffect(() => {
    if (isLoading || isAuthenticated || SigningIn.pending !== null) { return }
    SigningIn.pending = signInAnonymously(signIn)
  }, [isLoading, isAuthenticated, signIn])

  return { ready: isAuthenticated }
}

/** Sign in anonymously, reporting a failure rather than throwing it, and let the next screen that asks try again */
async function signInAnonymously(signIn: ConvexAuthActionsContext['signIn']): Promise<void> {
  try {
    await signIn('anonymous')
  } catch (err) {
    Postmortem.report('sign this browser in', err)
  } finally {
    SigningIn.pending = null
  }
}
