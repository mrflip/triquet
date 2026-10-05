'use client'

import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import * as Actor from '../lib/actor'
import type { IdentT } from '../models/ident'
import { useSession } from './use-session'

export type IdentHandle = {
  /** Who this browser is now; null when its session has asserted no username */
  ident:  IdentT | null
  /** Who this browser's requests are from, as the server sees them: the anonymous actor until it has asserted a username, or that is known */
  actor:  Actor.ActorT
  /** Whether the server has answered, and so whether `ident` is known */
  loaded: boolean
}

/**
 * The ident this browser is now: the username its session asserted last, live, so a browser that
 * becomes someone else in another tab follows along; and the actor the server sees in its
 * requests, which a view's claims are built on (`useHunt`). Not known until the session is ready.
 *
 * @returns The ident and the actor, and whether they are known yet.
 */
export function useIdent(): IdentHandle {
  const { ready } = useSession()
  const current = useQuery(api.idents.current, ready ? {} : 'skip')
  if (current === undefined) { return { ident: null, actor: Actor.anonymous, loaded: false } }
  return { ident: current?.ident ?? null, actor: current?.actor ?? Actor.anonymous, loaded: true }
}
