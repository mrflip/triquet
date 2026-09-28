'use client'

import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { HuntListingT } from '../lib/rows'

/**
 * Every hunt, each with its realms and their quizzes, live, as the hunts list shows them.
 *
 * @returns The hunts, in the order they were made; null until the server has answered.
 */
export function useHuntsList(): readonly HuntListingT[] | null {
  return useQuery(api.hunts.list) ?? null
}
