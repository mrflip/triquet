'use client'

import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { IdentT } from '../models/ident'
import { useSession } from './use-session'

export type IdentHandle = {
  /** Who this browser is now; null when its session has asserted no username */
  ident:  IdentT | null
  /** Whether the server has answered, and so whether `ident` is known */
  loaded: boolean
}

/**
 * The ident this browser is now: the username its session asserted last, live, so a browser that
 * becomes someone else in another tab follows along. Not known until the session is ready.
 *
 * @returns The ident, and whether that is known yet.
 */
export function useIdent(): IdentHandle {
  const { ready } = useSession()
  const ident = useQuery(api.idents.current, ready ? {} : 'skip')
  return ident === undefined ? { ident: null, loaded: false } : { ident, loaded: true }
}
