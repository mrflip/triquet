'use client'

import { useEffect } from 'react'
import { useConvexConnectionState } from 'convex/react'

/**
 * Writes each change in the page's connection to its Convex deployment to the console: connected
 * or not, whether it ever has been, how many times it has connected, and how long after the page
 * opened. Renders nothing.
 */
export function SyncLog() {
  const { isWebSocketConnected, hasEverConnected, connectionCount } = useConvexConnectionState()
  useEffect(() => {
    console.warn('Convex connection:', { connected: isWebSocketConnected, hasEverConnected, connectionCount, ms: Math.round(performance.now()) })
  }, [isWebSocketConnected, hasEverConnected, connectionCount])
  return null
}
