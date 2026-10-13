'use client'

import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { UserlabelHolderT } from '../models/user'
import { useSession } from './use-session'

/** How long a handle must stand untyped before the front door asks who holds it: about a pause between words */
export const HolderSettleMs = 300

/**
 * What holds the handle the front door's field shows (`users.holder`), live: a facet of its own,
 * watched only by the front door, and only once the handle has stood a moment
 * (`HolderSettleMs`), so typing a handle out asks once, not once a keystroke.
 *
 * @param userlabel - The handle in the field, when it is a userlabel (`User.flawIn`); null asks nothing.
 * @returns What holds it (null when it is free); undefined while it is being typed, until the
 *   answer for it has arrived, and for null.
 */
export function useUserlabelHolder(userlabel: string | null): UserlabelHolderT | undefined {
  const { ready } = useSession()
  const [settled, setSettled] = useState<string | null>(null)
  useEffect(() => {
    const timer = setTimeout(() => { setSettled(userlabel) }, HolderSettleMs)
    return () => { clearTimeout(timer) }
  }, [userlabel])
  const asking = ready && settled !== null && settled === userlabel
  const holder = useQuery(api.users.holder, asking ? { userlabel: settled } : 'skip')
  return asking ? holder : undefined
}
