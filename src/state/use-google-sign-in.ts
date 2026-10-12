'use client'

import { useCallback, useEffect } from 'react'
import { useAuthActions, useAuthToken, useConvexAuth, type ConvexAuthActionsContext } from '@convex-dev/auth/react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { GoogleSignInUnfinished, googleSignInUnfinishedNotice } from '../lib/notices'
import * as Routes from '../lib/routes'
import type { UserT } from '../models/user'
import { useRaiseAlarm } from './alarms'

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

/** Where a tab notes that it has left to sign in with Google: in its own session storage, which outlives the round trip and no other tab reads */
const StartedKey = 'triquet.googleSignInStarted'

/** What Convex Auth names the key it keeps a sign-in's verifier under, in local storage, before the deployment's address */
const VerifierKeyPrefix = '__convexAuthOAuthVerifier'

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
  const token = useAuthToken()
  const start = useCallback(async () => { await startGoogleSignIn(signIn, location, { token, storage: sessionStorage }) }, [signIn, token])
  return { offered: isAuthenticated && offers?.google === true, start }
}

/**
 * Start a Google sign-in: note in this tab that it has left, with a fingerprint of the session it
 * leaves as (`fingerprintOf`), so that coming back it can tell whether the sign-in finished; then
 * Convex Auth sends the browser on to Google, by way of the deployment, and Google sends it back to
 * `here`, where the provider finishes signing in (`?code=`). The browser's session goes with the
 * request, so the sign-in knows whose browser it was. A start that fails takes its note back, as
 * the tab never left.
 *
 * @param signIn - Convex Auth's sign-in, from `useAuthActions`.
 * @param here - The page to come back to.
 * @param leaving - The session's token as it leaves, and the tab's session storage to note it in.
 * @throws What `signIn` throws, the note taken back.
 *
 * @example await startGoogleSignIn(signIn, location, { token, storage: sessionStorage })  // the browser leaves for Google
 */
export async function startGoogleSignIn(signIn: ConvexAuthActionsContext['signIn'], here: Pick<Location, 'pathname' | 'search' | 'hash'>, leaving: { token: string | null, storage: Storage }): Promise<void> {
  leaving.storage.setItem(StartedKey, await fingerprintOf(leaving.token))
  try {
    await signIn('google', { redirectTo: returnPathOf(here) })
  } catch (err) {
    leaving.storage.removeItem(StartedKey)
    throw err
  }
}

/**
 * Tell this browser, once it is back from Google and loaded, if the Google sign-in it started did
 * not finish: cancelled at Google, started too long ago, or refused. It is then still the user it
 * was, on the session it had (a refused exchange keeps it: our patch of Convex Auth), and the
 * page's alarm says so (`googleSignInUnfinishedNotice`), and any verifier Convex Auth left in
 * local storage for the dead sign-in is cleared. Says nothing when no sign-in was started from this
 * tab, or it finished (the session is a new one).
 *
 * @param me - Who this browser is, and whether the server has said yet (`useMe`).
 */
export function useGoogleSignInOutcome(me: { loaded: boolean, user: Pick<UserT, 'userlabel'> | null }): void {
  const { isLoading } = useConvexAuth()
  const token = useAuthToken()
  const raise = useRaiseAlarm()
  const { loaded, user } = me
  useEffect(() => {
    if (isLoading || ! loaded) { return }
    const started = takeStarted(sessionStorage)
    if (started === null) { return }
    void (async () => {
      if (! await isUnfinished(started, token)) { return }
      forgetDeadSignIns(localStorage)
      raise({ headline: GoogleSignInUnfinished, notice: googleSignInUnfinishedNotice(user?.userlabel ?? null), request_id: null })
    })()
  }, [isLoading, loaded, user, token, raise])
}

/**
 * The note a tab left as it started a Google sign-in, taken away as it is read; null when it left
 * none.
 *
 * @example takeStarted(sessionStorage)  // => '3f2a…', once, after startGoogleSignIn
 */
export function takeStarted(storage: Storage): string | null {
  const started = storage.getItem(StartedKey)
  storage.removeItem(StartedKey)
  return started
}

/**
 * Whether a Google sign-in started as the session `started` fingerprints did not finish: the
 * browser's session now is the same one. A finished sign-in always signs the browser in to a new
 * session.
 *
 * @example await isUnfinished(await fingerprintOf(token), token)  // => true
 */
export async function isUnfinished(started: string, token: string | null): Promise<boolean> {
  return started === await fingerprintOf(token)
}

/**
 * A fingerprint of a session's token, to tell the session it is again without keeping the token
 * twice: its SHA-256, in hex; `none` for no session.
 *
 * @example await fingerprintOf(null)  // => 'none'
 */
export async function fingerprintOf(token: string | null): Promise<string> {
  if (token === null) { return 'none' }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Clear what Convex Auth keeps in local storage for a sign-in that will not finish: its verifier,
 * which it would otherwise send with the browser's next sign-in.
 *
 * @example forgetDeadSignIns(localStorage)
 */
export function forgetDeadSignIns(storage: Storage): void {
  const keys = Array.from({ length: storage.length }, (_unused, idx) => storage.key(idx))
  for (const key of keys) {
    if (key?.startsWith(VerifierKeyPrefix)) { storage.removeItem(key) }
  }
}

/**
 * Where a Google sign-in comes back to: the page's path, query and fragment, relative, as Convex
 * Auth sends a browser back only within the app (`SITE_URL`); the front door for a page that does
 * not open the database, which the deployment would refuse to send it back to (`returnUrlFor`).
 *
 * @example returnPathOf({ pathname: '/~flip_kromer/quiet_otter', search: '?q=1', hash: '' })  // => '/~flip_kromer/quiet_otter?q=1'
 * @example returnPathOf({ pathname: '/privacy', search: '', hash: '' })  // => '/'
 */
export function returnPathOf(here: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  const path = `${here.pathname}${here.search}${here.hash}`
  return Routes.isSyncedPath(path) ? path : '/'
}
