'use client'

import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { smithsOf, type HuntOpeningT, type ShallowHuntT, type SmithT } from '../lib/rows'
import { ValidatorKit } from '../lib/validator'
import type { HuntRole } from '../models/hunting'
import { useSession } from './use-session'

/**
 * Where finding the hunt an address names stands: still looking, looked and it is not there,
 * there but not this visitor's to see, or found
 */
export type HuntFinding = 'waiting' | 'missing' | 'refused' | 'found'

export type HuntOpeningHandle = {
  /** Whether the hunt has been found, is not there to find, or is not this visitor's to see */
  finding: HuntFinding
  /** The hunt, with its quizzes, wheel and members; null until it is found */
  hunt:    ShallowHuntT | null
  /** What this browser's ident does on the hunt; null when it is not on it, or the hunt has not arrived */
  role:    HuntRole | null
  /** Who could put this visitor on the hunt; empty until the hunt has arrived */
  smiths:  readonly SmithT[]
}

/**
 * Where finding the hunt stands, from what the server said of it.
 *
 * @param askable - Whether the address's label could name a hunt at all.
 * @param opening - What the server said of the hunt; undefined until it has.
 *
 * @example findingOf(true, { why: 'notOnHunt', hunt: null, smiths: [] })  // => 'refused'
 */
export function findingOf(askable: boolean, opening: HuntOpeningT | undefined): HuntFinding {
  if (! askable) { return 'missing' }
  if (opening === undefined) { return 'waiting' }
  if (opening.why === 'notOnHunt') { return 'refused' }
  return opening.why === 'noSuchHunt' ? 'missing' : 'found'
}

/**
 * The hunt of the org `orglabel` labelled `hunt_label`, live, as a screen about the whole hunt
 * holds it: its quizzes, its wheel, who is on it and this visitor's role. Someone not on the hunt
 * is shown none of it, only who could add them.
 *
 * @param orglabel - The org the address names; null for an old address, which names none.
 * @param hunt_label - The hunt the address names.
 * @returns The hunt, and where finding it stands.
 */
export function useHuntOpening(orglabel: string | null, hunt_label: string): HuntOpeningHandle {
  const { ready } = useSession()
  // A label that cannot be one names no hunt, and is not asked about.
  const askable = ValidatorKit.label.safeParse(hunt_label).success
  const opening = useQuery(api.hunts.open, askable && ready ? { orglabel, hunt_label } : 'skip')
  const hunt = opening?.hunt ?? null
  const smiths = opening?.why === 'notOnHunt' ? opening.smiths : smithsOf(hunt?.members ?? [])
  return { finding: findingOf(askable, opening), hunt, role: hunt?.role ?? null, smiths }
}
