'use client'

import { useCallback, useEffect } from 'react'
import { useAuthActions, useAuthToken, useConvexAuth, type ConvexAuthActionsContext } from '@convex-dev/auth/react'
import { useQuery } from 'convex/react'
import { decodeJwt } from 'jose'
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

/** What Convex Auth puts between the user and the session in its token's subject (`<user>|<session>`) */
const SubjectDivider = '|'

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
 * Start a Google sign-in: note in this tab that it has left, with the session it leaves as
 * (`sessionOf`), so that coming back it can tell whether the sign-in finished; then
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
  leaving.storage.setItem(StartedKey, sessionOf(leaving.token))
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
 * tab, or it finished (the session is a new one). It reads the session, not the token, which the
 * Convex client refreshes as a page loads: the same session comes back in a new token.
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
    if (started === null || ! isUnfinished(started, token)) { return }
    forgetDeadSignIns(localStorage)
    raise({ headline: GoogleSignInUnfinished, notice: googleSignInUnfinishedNotice(user?.userlabel ?? null), request_id: null })
  }, [isLoading, loaded, user, token, raise])
}

/**
 * The note a tab left as it started a Google sign-in, taken away as it is read; null when it left
 * none.
 *
 * @example takeStarted(sessionStorage)  // => 'k57a…', the session's id, once, after startGoogleSignIn
 */
export function takeStarted(storage: Storage): string | null {
  const started = storage.getItem(StartedKey)
  storage.removeItem(StartedKey)
  return started
}

/**
 * Whether a Google sign-in started from the session `started` did not finish: the browser's token
 * now is of the same session, however often it has been refreshed since. A finished sign-in always
 * signs the browser in to a new session.
 *
 * @example isUnfinished(sessionOf(token), refreshedToken)  // => true, while the session is the one it left as
 */
export function isUnfinished(started: string, token: string | null): boolean {
  return started === sessionOf(token)
}

/**
 * Which session a Convex Auth token is of: the session's id, after the user's in the token's
 * subject (`<user>|<session>`), read without checking the token's signature, which only the
 * deployment can and does; `none` for no session. A refreshed token keeps it, and a new sign-in
 * changes it. The id is no credential: it names the session, and grants nothing.
 *
 * @example sessionOf(null)  // => 'none'
 * @example sessionOf(token)  // => 'k57a…', for a token whose subject is 'j97b…|k57a…'
 */
export function sessionOf(token: string | null): string {
  if (token === null) { return 'none' }
  const [, session] = decodeJwt(token).sub?.split(SubjectDivider) ?? []
  return session ?? 'none'
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
 * not open the database, where the deployment would send it in any case (`returnUrlFor`).
 *
 * @example returnPathOf({ pathname: '/~flip_kromer/quiet_otter', search: '?q=1', hash: '' })  // => '/~flip_kromer/quiet_otter?q=1'
 * @example returnPathOf({ pathname: '/privacy', search: '', hash: '' })  // => '/'
 */
export function returnPathOf(here: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  const path = `${here.pathname}${here.search}${here.hash}`
  return Routes.isSyncedPath(path) ? path : '/'
}
