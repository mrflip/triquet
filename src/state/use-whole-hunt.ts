'use client'

import { useCallback, useState } from 'react'
import { useConvex } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { ShallowHuntT } from '../lib/rows'
import type { HuntT } from '../models/hunt'
import type { QuizT } from '../models/quiz'

/** The Export box's hunt: what was read, whether a read is on its way, and how to ask for one */
export type WholeHuntAsk = {
  /** The hunt, every quiz whole, as read for the screen as it now stands; null until asked, and again once the screen changes */
  whole:   HuntT | null
  /** True while a read is on its way */
  asking:  boolean
  /** True when the last read failed, or found no such hunt */
  failed:  boolean
  /** Read the hunt now */
  prepare: () => void
}

/** A read of the whole hunt, and the screen it was read for */
type Prepared = { hunt: Pick<ShallowHuntT, '_id'>, openQuiz: QuizT, whole: HuntT }

/**
 * `hunt`, every quiz whole, as the Export box emits it: read only when the author asks, never
 * subscribed to. A whole hunt is the largest thing the app reads, and only the export needs it.
 * A read holds only while the screen is the one it was read for: once the hunt or the open quiz
 * changes, anyone's edit included, it is withdrawn, so the box never holds an export behind what
 * the author sees.
 *
 * @param hunt - The hunt, as the screen holds it.
 * @param openQuiz - The quiz on screen.
 * @returns The read, and a way to ask for one.
 */
export function useWholeHunt(hunt: Pick<ShallowHuntT, '_id'>, openQuiz: QuizT): WholeHuntAsk {
  const convex = useConvex()
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [asking, setAsking] = useState(false)
  const [failed, setFailed] = useState(false)

  const prepare = useCallback(() => {
    const ask = async () => {
      setAsking(true)
      setFailed(false)
      try {
        const whole = await convex.query(api.hunts.whole, { hunt_id: hunt._id })
        if (whole) { setPrepared({ hunt, openQuiz, whole }) } else { setFailed(true) }
      } catch (err) {
        console.error('Export: the hunt could not be read', err)
        setFailed(true)
      } finally {
        setAsking(false)
      }
    }
    void ask()
  }, [convex, hunt, openQuiz])

  const current = prepared?.hunt === hunt && prepared.openQuiz === openQuiz
  return { whole: current ? prepared.whole : null, asking, failed, prepare }
}
