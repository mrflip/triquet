'use client'

import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import * as Actor from '../lib/actor'
import type { UserT } from '../models/user'
import { useSession } from './use-session'

export type MeHandle = {
  /** The user this browser is now; null while it holds no userlabel */
  user:   UserT | null
  /** Who this browser's requests are from, as the server sees them: the unlabelled actor until its user holds a userlabel, or that is known */
  actor:  Actor.ActorT
  /** Whether the server has answered, and so whether `user` is known */
  loaded: boolean
}

/**
 * The user this browser is now: the user its session is signed in as, once it holds a userlabel,
 * live, so a retitle in another tab follows along; and the actor the server sees in its requests,
 * which a view's claims are built on (`useHunt`). Not known until the session is ready.
 *
 * @returns The user and the actor, and whether they are known yet.
 */
export function useMe(): MeHandle {
  const { ready } = useSession()
  const current = useQuery(api.users.current, ready ? {} : 'skip')
  if (current === undefined) { return { user: null, actor: Actor.unlabelled, loaded: false } }
  return { user: current?.user ?? null, actor: current?.actor ?? Actor.unlabelled, loaded: true }
}
