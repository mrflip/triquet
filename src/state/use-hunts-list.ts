'use client'

import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { ListedHuntT } from '../lib/rows'
import { useBrowserKey } from './browser-key'

/**
 * The hunts this browser's ident is on, each with its realms and their quizzes and the ident's
 * role there, live, as the hunts list shows them.
 *
 * @returns The hunts, in the order they were made; null until the server has answered.
 */
export function useHuntsList(): readonly ListedHuntT[] | null {
  const browser_key = useBrowserKey()
  return useQuery(api.hunts.list, browser_key === null ? 'skip' : { browser_key }) ?? null
}
