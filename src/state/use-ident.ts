'use client'

import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { IdentT } from '../models/ident'
import { useBrowserKey } from './browser-key'

export type IdentHandle = {
  /** Who this browser is now; null when it has never said */
  ident:  IdentT | null
  /** Whether the server has answered, and so whether `ident` is known */
  loaded: boolean
}

/**
 * The ident this browser is now: the one its newest identing names, live, so a browser that
 * becomes someone else in another tab follows along.
 *
 * @returns The ident, and whether that is known yet.
 */
export function useIdent(): IdentHandle {
  const browser_key = useBrowserKey()
  const ident = useQuery(api.idents.current, browser_key === null ? 'skip' : { browser_key })
  return ident === undefined ? { ident: null, loaded: false } : { ident, loaded: true }
}
