'use client'

import { useEffect } from 'react'
import { useJazzAuth } from 'jazz-tools/react'
import type { SyncSettings } from '../db/sync-settings'

/** The session state last written to the console, so a log mounted by the next view repeats nothing */
const Logged = { key: '' }

/**
 * Writes each change in the browser's Jazz session to the console: starting, ready, signed out
 * or failed, the account it is for, and how long after the page opened. Renders nothing.
 *
 * The Jazz provider shows one of its views at a time (opening, failed, signed out, or the app),
 * so each of them mounts one of these.
 */
export function SyncLog() {
  const { status, account, error, recovery } = useJazzAuth()
  useEffect(() => {
    const key = [status, account?.id, error?.message].join('|')
    if (key === Logged.key) { return }
    Logged.key = key
    const detail = { account: account?.id ?? null, recovery: recovery ?? null, ms: Math.round(performance.now()) }
    if (error) {
      console.error('Jazz session:', status, detail, error)
    } else {
      console.warn('Jazz session:', status, detail)
    }
  }, [status, account, error, recovery])
  return null
}

/**
 * Writes where this build syncs to the console, with the names (never the values) of what Jazz
 * keeps in this browser's localStorage, so a report says which account and worker it was.
 *
 * @param settings - What this build was given to sync with.
 */
export function announceSync(settings: SyncSettings): void {
  const kept = Object.keys(localStorage).filter((key) => key.startsWith('jazz')).toSorted((left, right) => left.localeCompare(right))
  console.warn('Jazz sync:', { ...settings, localStorageKeys: kept })
}
