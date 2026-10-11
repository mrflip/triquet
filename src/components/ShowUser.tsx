'use client'

import { useMemo } from 'react'
import { useRetitleIdent } from './IdentTitle'
import { useShowAccount } from '../state/shown'
import { useIdent } from '../state/use-ident'

/**
 * Tells the header's account menu who is looking, for every page that connects to the database:
 * their ident, once the server has said, and how to retitle it. Draws nothing.
 */
export function ShowAccount() {
  const { ident, loaded } = useIdent()
  const onRetitle = useRetitleIdent()
  useShowAccount(useMemo(() => (loaded ? { ident, onRetitle } : null), [loaded, ident, onRetitle]))
  return null
}
