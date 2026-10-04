'use client'

import { useMemo } from 'react'
import type { Id } from '../../convex/_generated/dataModel'
import type { ShallowHuntT } from '../lib/rows'
import type { HuntAffirmsDNA, QuizAffirmsDNA } from '../models/actions'
import { useIdent } from './use-ident'

/** What this browser affirms of itself on a hunt, and on a quiz of it; each null until known */
export type AffirmsHandle = {
  /** Who it is (`useIdent`), which hunt, and its standing there; null until both who it is and the hunt are known */
  huntAffirms: HuntAffirmsDNA | null
  /** As `huntAffirms`, and the quiz it is reading; null until that is known too */
  quizAffirms: QuizAffirmsDNA | null
}

/**
 * What this browser affirms of itself on `hunt`, sent with every request about it: who it is,
 * which hunt, and its standing there, and for a request about one quiz, that quiz; all as already
 * read. The server checks each one (`convex/authorize`). Each is the same object from render to
 * render while nothing in it changes, so a watch keyed by it keeps its subscription.
 *
 * @param hunt - The hunt, as its screen holds it; null when there is none to affirm.
 * @param quiz_id - The quiz of it being read; null for none.
 * @returns The affirms, each null until what it says is known.
 *
 * @example const { huntAffirms } = useAffirms(hunt, null)  // => { huntAffirms: { ident_id, hunt_id: hunt._id, standing: hunt.role }, quizAffirms: null }
 */
export function useAffirms(hunt: Pick<ShallowHuntT, '_id' | 'role'> | null, quiz_id: Id<'quizzes'> | null): AffirmsHandle {
  const { ident } = useIdent()
  const ident_id = ident?._id ?? null
  const hunt_id = hunt?._id ?? null
  const standing = hunt?.role ?? null
  const huntAffirms = useMemo(() => {
    if (ident_id === null || hunt_id === null || standing === null) { return null }
    return { ident_id, hunt_id, standing }
  }, [ident_id, hunt_id, standing])
  const quizAffirms = useMemo(() => {
    if (ident_id === null || hunt_id === null || standing === null || quiz_id === null) { return null }
    return { ident_id, hunt_id, standing, quiz_id }
  }, [ident_id, hunt_id, standing, quiz_id])
  return { huntAffirms, quizAffirms }
}
