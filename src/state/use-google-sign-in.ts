'use client'

import { useCallback } from 'react'
import { useAuthActions, useConvexAuth, type ConvexAuthActionsContext } from '@convex-dev/auth/react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

export type GoogleSignInHandle = {
  /**
   * Whether to offer signing in with Google now: the deployment offers it (`auth.offered`), and
   * this browser's session is ready, so that the user it is signed in as goes along with it (an
   * anonymous user is upgraded, or merged, rather than left behind). False until both are so.
   */
  offered: boolean
  /** Leave for Google to sign in, coming back to this page (`startGoogleSignIn`) */
  start:   () => Promise<void>
}

/**
 * Signing in with Google, for any door that offers it: whether to offer it, and how to start it.
 * Each door calls this, and nothing else starts a Google sign-in.
 *
 * @returns Whether to offer it, and how to start it.
 */
export function useGoogleSignIn(): GoogleSignInHandle {
  const offers = useQuery(api.auth.offered, {})
  const { isAuthenticated } = useConvexAuth()
  const { signIn } = useAuthActions()
  const start = useCallback(async () => { await startGoogleSignIn(signIn, location) }, [signIn])
  return { offered: isAuthenticated && offers?.google === true, start }
}

/**
 * Start a Google sign-in: Convex Auth sends the browser on to Google, by way of the deployment,
 * and Google sends it back to `here`, where the provider finishes signing in (`?code=`). The
 * browser's session goes with the request, so the sign-in knows whose browser it was.
 *
 * @param signIn - Convex Auth's sign-in, from `useAuthActions`.
 * @param here - The page to come back to.
 *
 * @example await startGoogleSignIn(signIn, location)  // the browser leaves for Google
 */
export async function startGoogleSignIn(signIn: ConvexAuthActionsContext['signIn'], here: Pick<Location, 'pathname' | 'search' | 'hash'>): Promise<void> {
  await signIn('google', { redirectTo: returnPathOf(here) })
}

/**
 * Where a Google sign-in comes back to: the page's path, query and fragment, relative, as Convex
 * Auth sends a browser back only within the app (`SITE_URL`).
 *
 * @example returnPathOf({ pathname: '/~flip_kromer/quiet_otter', search: '?q=1', hash: '' })  // => '/~flip_kromer/quiet_otter?q=1'
 */
export function returnPathOf(here: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  return `${here.pathname}${here.search}${here.hash}`
}
