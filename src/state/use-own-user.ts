'use client'

import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { OwnUserT } from '../models/user'
import { useSession } from './use-session'

export type OwnUserHandle = {
  /** What this browser's user is told of itself and nobody else is; null with no session */
  own:    OwnUserT | null
  /** Whether the server has answered, and so whether `own` is known */
  loaded: boolean
}

/**
 * What this browser's user is told of itself and nobody else is (`users.own`): whether it is
 * signed in with Google, the email Google sent, the handle the front door offers it, and a name
 * choice a merge left it. Live, so a name choice settled in another tab goes from this one too.
 * Watched once, for the header and the page alike (`ShowUser`); not known until the session is
 * ready.
 *
 * @returns What it is told, and whether that is known yet.
 */
export function useOwnUser(): OwnUserHandle {
  const { ready } = useSession()
  const own = useQuery(api.users.own, ready ? {} : 'skip')
  return own === undefined ? { own: null, loaded: false } : { own, loaded: true }
}
