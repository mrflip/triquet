'use client'

import { useMemo } from 'react'
import { useRetitleUser } from './UserTitle'
import { useShowUser } from '../state/shown'
import { useMe } from '../state/use-me'

/**
 * Tells the header's user menu who is looking, for every page that connects to the database:
 * their user, once the server has said, and how to retitle it. Draws nothing.
 */
export function ShowUser() {
  const { user, loaded } = useMe()
  const onRetitle = useRetitleUser()
  useShowUser(useMemo(() => (loaded ? { user, onRetitle } : null), [loaded, user, onRetitle]))
  return null
}
