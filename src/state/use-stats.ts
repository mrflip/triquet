'use client'

import { useConvexConnectionState, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { BackfillStatusT } from '../lib/rows'

/** What the stats page shows of the deployment and of this browser's connection to it */
export type StatsHandle = {
  /** How far each backfill has run (`stats.backfills`); undefined until the server has answered */
  backfills: readonly BackfillStatusT[] | undefined
  /** Whether the browser holds its socket to the deployment now, and how many times it has opened one */
  connected:   boolean
  connections: number
}

/**
 * The stats page's screen hook: the deployment's backfills, live, and this browser's connection.
 * It asks as no one, without signing in, so a look at the stats leaves no session behind.
 */
export function useStats(): StatsHandle {
  const backfills = useQuery(api.stats.backfills, {})
  const { isWebSocketConnected, connectionCount } = useConvexConnectionState()
  return { backfills, connected: isWebSocketConnected, connections: connectionCount }
}
