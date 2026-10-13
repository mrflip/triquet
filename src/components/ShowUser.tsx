'use client'

import { useMemo } from 'react'
import { useRetitleUser } from './UserTitle'
import { useShowUser } from '../state/shown'
import { useGoogleSignIn, useGoogleSignInOutcome } from '../state/use-google-sign-in'
import { useMe } from '../state/use-me'
import { useOwnUser } from '../state/use-own-user'
import { useSignOut } from '../state/use-session'

/**
 * Tells the header's user menu, and the page beneath it (`useShown`), who is looking, for every
 * page that connects to the database: their user, once the server has said, and how to retitle
 * it; what they are told of themselves alone (`useOwnUser`); whether to offer signing in with
 * Google, and how (`useGoogleSignIn`); and how to sign out. Tells the page's alarm when a Google
 * sign-in this tab started did not finish. Draws nothing.
 */
export function ShowUser() {
  const { user, loaded } = useMe()
  const { own } = useOwnUser()
  const onRetitle = useRetitleUser()
  const onSignOut = useSignOut()
  const { offered, start } = useGoogleSignIn()
  const google = useMemo(() => ({ offered, start }), [offered, start])
  useGoogleSignInOutcome({ loaded, user })
  useShowUser(useMemo(() => (loaded ? { user, onRetitle, own, google, onSignOut } : null), [loaded, user, onRetitle, own, google, onSignOut]))
  return null
}
