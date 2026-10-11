'use client'

import { useMemo } from 'react'
import { useRetitleIdent } from './IdentTitle'
import { useShowUser } from '../state/shown'
import { useIdent } from '../state/use-ident'

/**
 * Tells the header's user menu who is looking, for every page that connects to the database:
 * their ident, once the server has said, and how to retitle it. Draws nothing.
 */
export function ShowUser() {
  const { ident, loaded } = useIdent()
  const onRetitle = useRetitleIdent()
  useShowUser(useMemo(() => (loaded ? { ident, onRetitle } : null), [loaded, ident, onRetitle]))
  return null
}
