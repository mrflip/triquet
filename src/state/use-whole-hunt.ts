'use client'

import { useCallback, useState } from 'react'
import { useConvex } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { ShallowHuntT } from '../lib/rows'
import type { HuntT } from '../models/hunt'
import type { QuizT } from '../models/quiz'
import { useBrowserKey } from './browser-key'

/** The Export box's hunt: what was read, whether a read is on its way, and how to ask for one */
export type WholeHuntAsk = {
  /** The hunt, every quiz whole, as read for the screen as it now stands; null until asked, and again once the screen changes */
  whole:   HuntT | null
  /** True while a read is on its way */
  asking:  boolean
  /** True when the last read, for the screen as it now stands, failed or found no such hunt */
  failed:  boolean
  /** Read the hunt now */
  prepare: () => void
}

/** The screen a read was asked for: the hunt and the open quiz, as the screen held them */
type Screen = { hunt: Pick<ShallowHuntT, '_id'>, openQuiz: QuizT }

/** How the last read came out, and the screen it was for */
type Outcome = Screen & { whole: HuntT | null }

/**
 * `hunt`, every quiz whole, as the Export box emits it: read only when the author asks, never
 * subscribed to. A whole hunt is the largest thing the app reads, and only the export needs it.
 * A read holds only while the screen is the one it was read for: once the hunt or the open quiz
 * on screen changes, anyone's edit included, it is withdrawn, so the box never holds an export
 * behind what the author sees. An edit to another quiz of the hunt, which the screen does not
 * show, leaves it standing.
 *
 * @param hunt - The hunt, as the screen holds it.
 * @param openQuiz - The quiz on screen.
 * @returns The read, and a way to ask for one.
 */
export function useWholeHunt(hunt: Pick<ShallowHuntT, '_id'>, openQuiz: QuizT): WholeHuntAsk {
  const convex = useConvex()
  const browser_key = useBrowserKey()
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [asking, setAsking] = useState(false)

  const prepare = useCallback(() => {
    const ask = async () => {
      setAsking(true)
      try {
        const whole = browser_key === null ? null : await convex.query(api.hunts.whole, { hunt_id: hunt._id, browser_key })
        setOutcome({ hunt, openQuiz, whole })
      } catch (err) {
        console.error('Export: the hunt could not be read', err)
        setOutcome({ hunt, openQuiz, whole: null })
      } finally {
        setAsking(false)
      }
    }
    void ask()
  }, [convex, browser_key, hunt, openQuiz])

  const current = outcome?.hunt === hunt && outcome.openQuiz === openQuiz ? outcome : null
  return { whole: current?.whole ?? null, asking, failed: current !== null && current.whole === null, prepare }
}
