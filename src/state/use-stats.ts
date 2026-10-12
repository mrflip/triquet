'use client'

import { useConvexConnectionState, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { BackfillStatusT } from '../lib/rows'
import { useSession } from './use-session'

/** What the stats page shows of the deployment and of this browser's connection to it */
export type StatsHandle = {
  /** How far each backfill has run (`stats.backfills`); null for a browser that may not see them (no admin, where the deployment does not expose them), undefined until the server has answered */
  backfills: readonly BackfillStatusT[] | null | undefined
  /** Whether the browser holds its socket to the deployment now, and how many times it has opened one */
  connected:   boolean
  connections: number
}

/**
 * The stats page's screen hook: the deployment's backfills, live, and this browser's connection.
 * The backfills are an admin's, or anyone's where the deployment exposes them
 * (`EXPOSE_INTERNAL_STATS_TO_ALL`), and which is decided for whoever the session asserted, so it
 * asks once the browser's session is ready.
 */
export function useStats(): StatsHandle {
  const { ready } = useSession()
  const backfills = useQuery(api.stats.backfills, ready ? {} : 'skip')
  const { isWebSocketConnected, connectionCount } = useConvexConnectionState()
  return { backfills, connected: isWebSocketConnected, connections: connectionCount }
}
